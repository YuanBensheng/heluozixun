// api/verify-key.js
// ⚡ 100% 继承原生 fetch 架构，集成“公域/课程双轨制”与“受控弹性登录风控策略”

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

        // ==========================================
        // 🛡️ 1. 核心防御：密码盘算法校验（底层防线绝对不变）
        // ==========================================
        const SECRET_SALT = process.env.SECRET_SALT || "HeLuoGuoxue2026#@!QuantumKeyCenter";
        const stringToCheck = type + client + SECRET_SALT;
        const fullHash = crypto.createHash('sha256').update(stringToCheck).digest('hex').toUpperCase();
        const expectedCheckDigit = fullHash.charAt(0);

        if (providedCheckDigit !== expectedCheckDigit) {
            return res.status(400).json({ success: false, message: '密钥未与当前时空对齐，请核对或联系咨询师！' });
        }

        // ==========================================
        // 🔀 2. 架构分叉：双轨制通道识别
        // ==========================================
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const ua = req.headers['user-agent'] || 'unknown';
        const now = Date.now();
        const redisKey = `burnt_key:${pwd}`;

        // 智能识别：排除公域VIP，剩下的自动分配至海外课程通道
        const isCourse = !['E', 'F', 'W', 'P', 'V'].includes(type);

        if (!isCourse) {
            // ----------------------------------------------------
            // 轨道路线 A：公域/VIP通道 —— 极严苛“一机一密，拒绝切换”
            // ----------------------------------------------------
            const fingerprintStr = ip + ua; // 强绑定网络环境与设备
            const deviceFingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SET", redisKey, deviceFingerprint, "EX", 1800, "NX"]) // 30分钟
            });
            const data = await response.json();

            if (data.result === "OK") {
                return res.status(200).json({ success: true, type: type, message: "因果锁定成功，密钥全网熔断生效" });
            } else {
                const getResp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(["GET", redisKey]) });
                const getData = await getResp.json();
                
                if (getData.result === deviceFingerprint) {
                    return res.status(200).json({ success: true, type: type, message: "通道已恢复，请继续观看" });
                } else {
                    return res.status(400).json({ success: false, message: "该时空密钥已被其他节点熔断，无法二次冒领！" });
                }
            }
        } else {
            // ----------------------------------------------------
            // 轨道路线 B：海外课程通道 —— 高维“受控弹性登录”系统
            // ----------------------------------------------------
            const fingerprintStr = ua; // 仅绑定设备指纹，允许手机跨WiFi/5G迁移
            const deviceFingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
            
            // 读取云端全息记录
            const getResp = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["GET", redisKey])
            });
            const getData = await getResp.json();

            let courseData = null;
            if (getData.result) {
                try {
                    courseData = JSON.parse(getData.result);
                } catch (e) {
                    // 兼容旧代码：如果之前存的是纯字符串，自动平滑升级为 JSON 对象
                    courseData = {
                        currentDevice: getData.result,
                        devices: [getData.result],
                        lastSwitchTime: 0,
                        switchHistory: [],
                        lastIp: ip
                    };
                }
            }

            if (!courseData) {
                // 👉 场景 1：全新课程密钥，首次激活
                const newCourseData = {
                    currentDevice: deviceFingerprint,
                    devices: [deviceFingerprint], // 占用第 1 个设备槽位
                    lastSwitchTime: 0,
                    switchHistory: [],
                    lastIp: ip
                };
                await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: JSON.stringify(["SET", redisKey, JSON.stringify(newCourseData), "EX", 31536000]) // 1年有效期
                });
                return res.status(200).json({ success: true, type: type, message: "课程鉴权成功，设备已绑定（有效期一年）" });
            } else {
                // 👉 场景 2：已有记录，进行鉴权或拦截
                if (courseData.currentDevice === deviceFingerprint) {
                    // 本人同设备回归，直接放行
                    return res.status(200).json({ success: true, type: type, message: "欢迎回归，课程通道已为您恢复" });
                } else {
                    // 🚨 尝试新设备登录，触发“受控弹性登录”多重风控防线
                    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
                    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

                    // 【防线 1：48小时绝对冷冻期】—— 打碎分销密钥的商业模式
                    if (now - courseData.lastSwitchTime < FORTY_EIGHT_HOURS) {
                        const timeLeft = Math.ceil((FORTY_EIGHT_HOURS - (now - courseData.lastSwitchTime)) / 3600000);
                        return res.status(400).json({ success: false, message: `触发安全风控：换绑设备冷却中，请在 ${timeLeft} 小时后重试。` });
                    }

                    // 【防线 2：设备槽位上限拦截】—— 终生不得超过 3 台独立设备
                    if (!courseData.devices.includes(deviceFingerprint) && courseData.devices.length >= 3) {
                        return res.status(400).json({ success: false, message: "安全拦截：该密钥绑定的设备总数已达上限（3台），禁止迁移权限。" });
                    }

                    // 【防线 3：30天高频监测】—— 自动预警机制
                    // 清理出30天内的切换记录
                    courseData.switchHistory = (courseData.switchHistory || []).filter(time => now - time < THIRTY_DAYS);
                    if (courseData.switchHistory.length >= 5) {
                        return res.status(400).json({ success: false, message: "系统防线预警：近期设备切换异常频繁。为保护数字资产，该密钥已被锁定。" });
                    }

                    // 🟢 通过所有风控考核，执行优雅迁移
                    courseData.currentDevice = deviceFingerprint;
                    if (!courseData.devices.includes(deviceFingerprint)) {
                        courseData.devices.push(deviceFingerprint); // 占用新槽位
                    }
                    courseData.lastSwitchTime = now; // 写入新冷冻期起点
                    courseData.switchHistory.push(now); // 计入监控史
                    courseData.lastIp = ip; // 刷新上下文

                    await fetch(url, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: JSON.stringify(["SET", redisKey, JSON.stringify(courseData), "EX", 31536000]) // 覆盖更新数据，依然是1年期
                    });

                    return res.status(200).json({ success: true, type: type, message: "设备迁移授权成功！原设备通行证已失效。" });
                }
            }
        }
    } catch (error) {
        console.error('云端锁单异常:', error);
        return res.status(500).json({ success: false, message: "高维星图链接闪烁: " + error.message });
    }
}
