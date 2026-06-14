module.exports = async function(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: "数据库配置缺失" });
    }

    if (req.method === 'POST') {
        const { slot, user, caseReport, authKey } = req.body;
        
        try {
            // 1. 验证密钥
            const checkKey = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["EXISTS", `burnt_key:${(authKey || '').toUpperCase()}`])
            });
            const keyData = await checkKey.json();
            if (!keyData.result || keyData.result !== 1) return res.status(403).json({ message: "无效密钥" });

            // 2. 抢占时空
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SADD", "booked_slots", slot])
            });
            const data = await response.json();

            if (data.result === 1) {
                // 3. 推送逻辑 (强制捕获所有网络异常)
                const content = `【河洛新局】姓名:${user.name} 时间:${req.body.displayTime} 诉求:${caseReport.coreFocus}`;
                
                const pushRes = await fetch('https://www.pushplus.plus/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: "c35c800c9d784fc9bf1da2d4b9c73b32",
                        title: "新订单",
                        content: content
                    })
                });
                
                const pushStatus = await pushRes.json();
                
                // 返回推送结果给前端，如果推送失败，前端会弹出错误
                if (pushStatus.code !== 200) {
                    return res.status(500).json({ success: false, message: "推送接口拒绝: " + JSON.stringify(pushStatus) });
                }

                return res.status(200).json({ success: true, message: "时空锁定且已推送！" });
            } else {
                return res.status(400).json({ success: false, message: "该时段已被抢占" });
            }
        } catch (error) {
            return res.status(500).json({ error: "系统异常: " + error.message });
        }
    }
    return res.status(405).json({ error: "Method not allowed" });
}
