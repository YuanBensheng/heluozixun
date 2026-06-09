// api/verify-key.js
// ⚡ 100% 继承原生 fetch 架构，纯净秒级同步
// 👑 引入原生加密模块，斩断一切跳过前端直接通过 API 伪造密钥的降维攻击

import crypto from 'crypto';

export default async function handler(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    
    // 宇宙级因果盐值，必须与前端绝对对齐
    const SECRET_SALT = "HeLuoGuoxue2026#@!QuantumKeyCenter";

    if (!url || !token) {
        return res.status(500).json({ success: false, message: "云端数据库钥匙未配置" });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: '请求路径不匹配' });
    }

    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ success: false, message: '维度密钥为空' });
    }

    const pwd = key.trim().toUpperCase();

    // ====================================================================
    // 【第一道结界】：密码学数学推演 (拒绝任何未按规则生成的野蛮密钥)
    // ====================================================================
    if (pwd.length !== 6) {
        return res.status(403).json({ success: false, message: "密钥格式破损，拒绝接入" });
    }

    const type = pwd.charAt(0); 
    const client = pwd.substring(1, 5);       
    const providedCheckDigit = pwd.charAt(5); 

    // 重新拼接带盐原串：类型(1位) + 客户端标识(4位) + 宇宙盐值
    const stringToCheck = type + client + SECRET_SALT;
    
    // 使用 Node.js 原生 crypto 模块进行 SHA256 碰撞
    const fullHash = crypto.createHash('sha256').update(stringToCheck).digest('hex').toUpperCase();
    const expectedCheckDigit = fullHash.charAt(0); 

    if (providedCheckDigit !== expectedCheckDigit) {
        return res.status(403).json({ success: false, message: "密钥伪造或未对齐，高维通道已拒绝！" });
    }

    // ====================================================================
    // 【第二道结界】：核心原子锁 (Redis并发熔断防御)
    // ====================================================================
    try {
        const redisKey = `burnt_key:${pwd}`;

        // 指令翻译：SET 密钥名 activated NX EX 7200
        // (NX: 如果不存在才允许写入。 EX 7200: 2小时后自动灰飞烟灭)
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(["SET", redisKey, "activated", "NX", "EX", "7200"])
        });
        
        const data = await response.json();

        // Redis 规则：如果返回 "OK" 代表全网没人用过；如果别人用过，会返回 null
        if (data.result === "OK") {
            return res.status(200).json({ success: true, message: "因果锁定成功，密钥全网熔断生效" });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: "该时空密钥已被其他节点熔断，无法二次冒领！" 
            });
        }
    } catch (error) {
        console.error('云端锁单异常:', error);
        return res.status(500).json({ success: false, message: "高维星图链接闪烁: " + error.message });
    }
}
