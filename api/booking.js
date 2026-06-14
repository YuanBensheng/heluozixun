export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    const { slot, user, caseReport, authKey, displayTime } = req.body;

    // ==========================================
    // 1. 这里保留您原来的 Redis 锁单/鉴权逻辑 
    // ==========================================
    // (请保持这一段与您之前的数据库写入逻辑一模一样，不要改动)
    
    // ==========================================
    // 2. 极致异步核心：0秒响应前端，直接弹窗成功！
    // ==========================================
    // 代码运行到这里，直接告诉前端“成功了”，让客户的页面瞬间跳出成功提示，不转圈！
    res.status(200).json({ success: true, message: "时空锁定成功！" });

    // ==========================================
    // 3. 后台静默发送：双保险推送 (完全不影响前端)
    // ==========================================
    const runBackgroundTasks = async () => {
        const pushToken = process.env.PUSHPLUS_TOKEN;
        const resendKey = process.env.RESEND_API_KEY;

        // 统一构造高清无广告的排版内容
        const htmlContent = `
            <div style="font-family: sans-serif; line-height: 1.8; color: #2c3e50; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="margin-top: 0; color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📌 案卷锁定通知</h2>
                <p><strong>锁定时间：</strong> ${displayTime || slot}</p>
                <p><strong>客户名称：</strong> ${user}</p>
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <p style="margin: 0; font-weight: bold; color: #4a5568;">案卷详情：</p>
                    <p style="margin-top: 8px; white-space: pre-wrap;">${caseReport}</p>
                </div>
            </div>
        `;

        const tasks = [];

        // 【通道一】微信 PushPlus 推送 (即时震动提醒)
        if (pushToken) {
            tasks.push(
                fetch('https://www.pushplus.plus/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: pushToken,
                        title: `【新案卷】${user} 已锁定`,
                        content: htmlContent,
                        template: 'html'
                    })
                }).catch(e => console.error("微信推送异常:", e))
            );
        }

        // 【通道二】Resend 专业邮件通道 (无广告、防丢单底线)
        if (resendKey) {
            tasks.push(
                fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'onboarding@resend.dev',
                        to: 'yuanbensheng18@gmail.com', // ⚠️ 沙盒规定：必须发给您的注册邮箱
                        subject: `【新局锁定】${displayTime || slot} - ${user}`,
                        html: htmlContent
                    })
                }).catch(e => console.error("邮件推送异常:", e))
            );
        }

        // 让两个任务在后台同时跑，互不拖累
        await Promise.allSettled(tasks);
    };

    // 启动后台任务 (注意前面没有 await，这就是0延迟的秘诀)
    runBackgroundTasks();
}
