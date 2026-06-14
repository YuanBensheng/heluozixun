module.exports = async function(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    const pushPlusToken = process.env.PUSH_PLUS_TOKEN; // 读取刚才你新建的变量

    if (req.method === 'POST') {
        const { slot, user, caseReport } = req.body;
        
        try {
            // 1. 抢占时空
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SADD", "booked_slots", slot])
            });
            const data = await response.json();

            if (data.result === 1) {
                // 2. 推送逻辑
                const content = `【河洛订单】姓名:${user.name} 诉求:${caseReport.coreFocus}`;
                
                await fetch('https://www.pushplus.plus/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: pushPlusToken, // 这里自动读取刚才新建的环境变量
                        title: "河洛订单提醒",
                        content: content
                    })
                });

                return res.status(200).json({ success: true, message: "时空已锁定，推送已发出" });
            } else {
                return res.status(400).json({ success: false, message: "该时段已被抢占" });
            }
        } catch (error) {
            return res.status(500).json({ error: "系统异常: " + error.message });
        }
    }
    return res.status(405).json({ error: "方法错误" });
}
