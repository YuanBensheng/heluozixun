// api/verify-key.js
// ⚡ 100% 继承 booking.js 的原生 fetch 架构，零第三方包依赖，纯净秒级同步

export default async function handler(req, res) {
    // 完美复用您已在 Vercel 配置好的环境变量
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

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

    try {
        const redisKey = `burnt_key:${key}`;

        // ====================================================================
        // 【核心原子锁】：直接用原生 fetch 向 Redis 发送最高权限的指令
        // 指令翻译：SET 密钥名 activated NX EX 7200
        // (NX: 如果不存在才允许写入。 EX 7200: 2小时后自动灰飞烟灭)
        // ====================================================================
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(["SET", redisKey, "activated", "NX", "EX", "7200"])
        });
        
        const data = await response.json();

        // Redis 规则：如果返回 "OK" 代表全网没人用过，现在归你了；如果别人用过，会返回 null
        if (data.result === "OK") {
            return res.status(200).json({ success: true, message: "因果锁定成功，密钥全网熔断生效" });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: "该时空契约密钥已被全球其他因果节点熔断，无法二次冒领！" 
            });
        }
    } catch (error) {
        console.error('云端锁单异常:', error);
        return res.status(500).json({ success: false, message: "高维星图链接闪烁: " + error.message });
    }
}
