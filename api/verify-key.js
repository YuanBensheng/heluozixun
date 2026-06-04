// api/verify-key.js
// ⚡ 引入您项目正在使用的 Upstash Redis 客户端（与您的日历系统保持环境对齐）
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); 

export default async function handler(req, res) {
    // 严格限制只接受前端发来的 POST 安全请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: '请求路径不匹配' });
    }

    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ success: false, message: '维度密钥为空' });
    }

    try {
        // 在全球唯一的 Redis 数据库中为这把钥匙挂号
        const redisKey = `burnt_key:${key}`;
        
        // 【⚔️ 量子级原子拦截锁】：SET key value NX EX 7200
        // nx: true -> 只有当这个密码在数据库里【不存在】的时候，才能设置成功！
        // ex: 7200 -> 2小时（7200秒）后这行记录在云端全自动湮灭，无需人工清理数据库。
        const isLockAcquired = await redis.set(redisKey, "activated", { nx: true, ex: 7200 });

        if (isLockAcquired === "OK" || isLockAcquired === true) {
            // 返回 true 说明此前全球没有任何人盖过这个章，现在成功熔断，放行！
            return res.status(200).json({ success: true, message: '因果锁定成功，密钥全网熔断生效' });
        } else {
            // 返回 null 说明这个密码早就被别人或者自己之前的浏览器用过了，云端防线直接拒绝！
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
