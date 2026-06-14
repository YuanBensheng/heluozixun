module.exports = async function(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: "云端数据库钥匙未配置。" });
    }

    if (req.method === 'GET') {
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(["SMEMBERS", "booked_slots"])
        });
        const data = await response.json();
        return res.status(200).json({ bookedSlots: data.result || [] });
    }

    if (req.method === 'POST') {
        const { slot, user, caseReport, authKey } = req.body;
        if (!slot) return res.status(400).json({ error: "未选择时间段" });

        try {
            // 1. 验证密钥是否合法
            const checkKey = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["EXISTS", `burnt_key:${(authKey || '').toUpperCase()}`])
            });
            const keyData = await checkKey.json();
            if (!keyData.result || keyData.result !== 1) {
                return res.status(403).json({ success: false, message: "非法请求：密钥未激活或不存在！" });
            }

            // 2. 尝试抢占时空
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SADD", "booked_slots", slot])
            });
            const data = await response.json();

            if (data.result === 1) {
                // 3. 数据持久化备份
                await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: JSON.stringify(["SET", `case_backup:${slot}`, JSON.stringify({ user, caseReport, timestamp: Date.now() })])
                });

                // 4. 秒级微信推送
                const ts = caseReport.timeSpace || {};
                const fr = caseReport.fiveRelations || {};
                const content = `【河洛新局】\n姓名: ${ts.name || user.name}\n时间: ${req.body.displayTime}\n诉求: ${caseReport.coreFocus}\n---\n五伦: 伴侣:${fr.spouse} | 亲子:${fr.parentchild}\n补充: ${caseReport.extraNotes || '无'}`;
                
                fetch('https://www.pushplus.plus/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: process.env.PUSH_PLUS_TOKEN,
                        title: "河洛咨询新订单",
                        content: content,
                        template: "txt"
                    })
                }).catch(err => console.error("推送异常:", err));

                return res.status(200).json({ success: true, message: "时空锁定成功！" });
            } else {
                return res.status(400).json({ success: false, message: "该时间段已被抢占！" });
            }
        } catch (error) {
            return res.status(500).json({ error: "系统异常: " + error.message });
        }
    }
    return res.status(405).json({ error: "不支持的操作" });
}
