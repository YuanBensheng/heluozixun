// api/verify-key.js
// 💡 切换为高兼容性的 require 语法，彻底对齐基础环境
const { Redis } = require('@upstash/redis');

// 自动读取您在 Vercel 中配置的 Upstash Redis 环境变量
const redis = Redis.fromEnv(); 

module.exports = async function handler(req, res) {
    // 严格限制只接受 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: '请求路径不匹配' });
    }

    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ success: false, message: '维度密钥为空' });
    }

    try {
        const redisKey = `burnt_key:${key}`;
        
        // 【⚔️ 原子拦截锁】：确保全球唯一性，2小时（7200秒）全自动湮灭
        const isLockAcquired = await redis.set(redisKey, "activated", { nx: true, ex: 7200 });

        if (isLockAcquired === "OK" || isLockAcquired === true) {
            return res.status(200).json({ success: true, message: '因果锁定成功，密钥全网熔断生效' });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: '该时空契约密钥已被全球其他因果节点熔断，无法二次冒领！' 
            });
        }
    } catch (error) {
        console.error('云端锁单异常:', error);
        return res.status(500).json({ success: false, message: '高维星图链接闪烁，请稍后重试' });
    }
}
