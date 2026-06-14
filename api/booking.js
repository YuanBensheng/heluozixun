export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    // 从前端接收数据
    const { slot, user, caseReport, authKey, displayTime } = req.body;

    // ==========================================
    // 1. 您的 Redis 锁单和鉴权逻辑 (保持不变)
    // ==========================================
    // ⚠️ 如果您之前有写把数据存入数据库的代码，请写在这里，千万别漏掉。


    // ==========================================
    // 2. 格式化提取器 (彻底消灭 [object Object] 乱码)
    // ==========================================
    // 自动判断：如果是对象，就拆解成“键：值”的排版；如果是字符串，就直接换行显示
    const formatData = (data) => {
        if (!data) return '未提供';
        if (typeof data === 'string') return data.replace(/\n/g, '<br>');
        if (typeof data === 'object') {
            return Object.entries(data)
                .map(([key, value]) => `<div style="margin-bottom: 4px;"><strong>${key}：</strong> ${value}</div>`)
                .join('');
        }
        return String(data);
    };

    // ==========================================
    // 3. 构建统一标题与高清排版
    // ==========================================
    const pushToken = process.env.PUSHPLUS_TOKEN;
    const resendKey = process.env.RESEND_API_KEY;

    // 统一标题：【新局锁定】几月几日 AM/PM
    const timeString = (displayTime || slot || '').replace('_', ' ');
    const unifiedTitle = `【新局锁定】${timeString}`;

    // 统一内容排版：精美卡片式布局，自动解析提取 user 和 caseReport 数据
    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; padding: 10px;">
            <p style="font-size: 16px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <strong>锁定时间：</strong> ${timeString}
            </p>
            
            <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid #4a90e2;">
                <h4 style="margin: 0 0 8px 0; color: #4a90e2; font-size: 15px;">👤 客户信息</h4>
                <div style="font-size: 14px; color: #555;">
                    ${formatData(user)}
                </div>
            </div>

            <div style="background: #fcf8f2; padding: 12px; border-radius: 6px; border-left: 3px solid #f39c12;">
                <h4 style="margin: 0 0 8px 0; color: #f39c12; font-size: 15px;">📝 案卷详情</h4>
                <div style="font-size: 14px; color: #555;">
                    ${formatData(caseReport)}
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 4. 双保险并行发送（防 Vercel 吞并机制）
    // ==========================================
    const tasks = [];

    // 【通道一】微信 PushPlus
    if (pushToken) {
        tasks.push(
            fetch('https://www.pushplus.plus/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: pushToken,
                    title: unifiedTitle,
                    content: htmlContent,
                    template: 'html'
                })
            }).catch(e => console.error("微信推送异常:", e))
        );
    }

    // 【通道二】Resend 邮件通道
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
                    to: 'yuanbensheng18@gmail.com', // ⚠️ Resend沙盒规定：必须发给您的注册邮箱
                    subject: unifiedTitle,
                    html: htmlContent
                })
            }).catch(e => console.error("邮件推送异常:", e))
        );
    }

    // 必须等待并行任务全部发射完毕，再放行
    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    }

    // ==========================================
    // 5. 毫秒级返回给前端
    // ==========================================
    return res.status(200).json({ success: true, message: "时空锁定成功！" });
}
