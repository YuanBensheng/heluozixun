module.exports = async function(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    const pushToken = process.env.PUSH_PLUS_TOKEN;

    if (req.method === 'POST') {
        const { slot, user, caseReport } = req.body;
        
        // 1. 抢占时空
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(["SADD", "booked_slots", slot])
        });
        const data = await response.json();

        if (data.result === 1) {
            // 2. 只做微信推送
            await fetch('https://www.pushplus.plus/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: pushToken,
                    title: "新订单",
                    content: `预约者:${user.name}, 时段:${slot}`
                })
            });
            return res.status(200).json({ success: true, message: "时空锁定成功" });
        } else {
            return res.status(400).json({ success: false, message: "时段已被抢占" });
        }
    }
    return res.status(405).json({ error: "Method not allowed" });
}
