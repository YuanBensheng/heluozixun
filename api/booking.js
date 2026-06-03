// api/booking.js
// 这是一个无需安装任何第三方包、直接用公网秒级同步的后端接口

export default async function handler(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    // 检查 Vercel 环境变量是否成功绑定
    if (!url || !token) {
        return res.status(500).json({ error: "云端数据库钥匙未配置，请检查 Vercel 绑定状态。" });
    }

    // 1. 读取逻辑：任何人打开网页时，获取所有已被锁定的时间段
    if (req.method === 'GET') {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SMEMBERS", "booked_slots"])
            });
            const data = await response.json();
            return res.status(200).json({ bookedSlots: data.result || [] });
        } catch (error) {
            return res.status(500).json({ error: "读取云端数据失败: " + error.message });
        }
    }

    // 2. 锁定逻辑：有人点击正式锁定时，尝试全网霸占该时间段
    if (req.method === 'POST') {
        const { slot } = req.body;
        if (!slot) {
            return res.status(400).json({ error: "未选择具体的时间段" });
        }

        try {
            // 使用 Redis 的 SADD 命令，利用其排他性实现全自动垄断
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SADD", "booked_slots", slot])
            });
            const data = await response.json();

            // Redis 规则：如果返回 1 代表之前没人占过，现在归你了；返回 0 代表别人早就占了
            if (data.result === 1) {
                return res.status(200).json({ success: true, message: "时空锁定成功！" });
            } else {
                return res.status(400).json({ success: false, message: "该时间段已被抢占！" });
            }
        } catch (error) {
            return res.status(500).json({ error: "提交云端锁定失败: " + error.message });
        }
    }

    return res.status(405).json({ error: "不支持的操作" });
}
