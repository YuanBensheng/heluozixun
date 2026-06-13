// api/verify-key.js
// ⚡ 100% 继承 booking.js 的原生 fetch 架构，零第三方包依赖，纯净秒级同步

import crypto from 'crypto'; // 引入 Node.js 原生高强度加密模块

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

        // 1. 核心防御：在后端云端进行算法比对，彻底隐藏核心盐值
        // 强烈建议：未来您可以把这个盐值也配置到 Vercel 的环境变量 (process.env.SECRET_SALT) 中
        const SECRET_SALT = process.env.SECRET_SALT || "HeLuoGuoxue2026#@!QuantumKeyCenter";
        const stringToCheck = type + client + SECRET_SALT;
        
        const fullHash = crypto.createHash('sha256').update(stringToCheck).digest('hex').toUpperCase();
        const expectedCheckDigit = fullHash.charAt(0);

        // 如果算出来的校验码和用户输入的不一致，直接打回，不消耗 Redis 资源
        if (providedCheckDigit !== expectedCheckDigit) {
            return res.status(400).json({ success: false, message: '密钥未与当前时空对齐，请核对或联系咨询师！' });
        }

        // 2. 原子锁熔断：密码为真后，向 Redis 申请全局唯一锁
        const redisKey = `burnt_key:${pwd}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(["SET", redisKey, "activated", "NX", "EX", "7200"])
        });
        
        const data = await response.json();

        if (data.result === "OK") {
            return res.status(200).json({ success: true, type: type, message: "因果锁定成功，密钥全网熔断生效" });
        } else {
            return res.status(400).json({ success: false, message: "该时空密钥已被其他节点熔断，无法二次冒领！" });
        }
    } catch (error) {
        console.error('云端锁单异常:', error);
        return res.status(500).json({ success: false, message: "高维星图链接闪烁: " + error.message });
    }
}
