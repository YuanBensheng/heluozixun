// api/verify-key.js
// ⚡ 100% 继承原生 fetch 架构，集成“公域/课程双通道”与“动态设备鉴权”

import crypto from 'crypto'; 

export default async function handler(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ success: false, message: "云端数据库钥匙未配置" });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: '请求路径不匹配' });
    }

    const { key } = req.body;
    if (!key || key.length !== 6) {
        return res.status(400).json({ success: false, message: '维度密钥格式异常' });
    }

    try {
        const pwd = key.toUpperCase();
        const type = pwd.charAt(0); 
        const client = pwd.substring(1, 5); 
        const providedCheckDigit = pwd.charAt(5);

        // 1. 核心防御：密码盘算法校验（保持您原有的高强度验证绝对不变）
        const SECRET_SALT = process.env.SECRET_SALT || "HeLuoGuoxue2026#@!QuantumKeyCenter";
        const stringToCheck = type + client + SECRET_SALT;
        const fullHash = crypto.createHash('sha256').update(stringToCheck).digest('hex').toUpperCase();
        const expectedCheckDigit = fullHash.charAt(0);

        if (providedCheckDigit !== expectedCheckDigit) {
            return res.status(400).json({ success: false, message: '密钥未与当前时空对齐，请核对或联系咨询师！' });
        }

        // ==========================================
        // 🚀 2. 核心架构升级：通道分流与动态设备指纹鉴权
        // ==========================================
        
        // 获取用户的设备与网络特征
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const ua = req.headers['user-agent'] || 'unknown';

        // 智能分流识别：公域/VIP密码以 E, F, W, P 开头，其他的默认归属为海外课程通道
        const isCourse = !['E', 'F', 'W', 'P'].includes(type);

        // 动态指纹与有效期设定：
        // - 公域/VIP：30分钟(1800秒)，严格绑定 IP + UserAgent（防随意分享）
        // - 海外课程：1年(31536000秒)，仅绑定 UserAgent（允许客户在同一台手机的WiFi/5G间切换，但不能换设备分享）
        const fingerprintStr = isCourse ? ua : (ip + ua);
        const deviceFingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
        const expireSeconds = isCourse ? 31536000 : 1800; 

        const redisKey = `burnt_key:${pwd}`;

        // 3. 原子锁写入（带过期时间 EX 和 不存在则写入 NX）
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(["SET", redisKey, deviceFingerprint, "EX", expireSeconds, "NX"])
        });
        const data = await response.json();

        if (data.result === "OK") {
            // 首次激活成功
            const msg = isCourse ? "课程鉴权成功，设备已绑定（有效期一年）" : "因果锁定成功，密钥全网熔断生效";
            return res.status(200).json({ success: true, type: type, message: msg });
        } else {
            // 4. 防误伤/防刷新机制：锁已经存在，去查一下这是谁上的锁？
            const getResp = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["GET", redisKey])
            });
            const getData = await getResp.json();
            
            // 指纹比对：如果是同一个人的设备（或不小心刷新了页面），直接放行
            if (getData.result === deviceFingerprint) {
                const msg = isCourse ? "欢迎回归，课程通道已为您恢复" : "通道已恢复，请继续观看";
                return res.status(200).json({ success: true, type: type, message: msg });
            } else {
                // 指纹不匹配：抓到冒领者！
                const blockMsg = isCourse ? "该课程密钥已在其他设备激活，禁止多端共享访问！" : "该时空密钥已被其他节点熔断，无法二次冒领！";
                return res.status(400).json({ success: false, message: blockMsg });
            }
        }
    } catch (error) {
        console.error('云端锁单异常:', error);
        return res.status(500).json({ success: false, message: "高维星图链接闪烁: " + error.message });
    }
}
