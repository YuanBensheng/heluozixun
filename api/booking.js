export default async function handler(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) return res.status(500).json({ error: "配置缺失" });

    if (req.method === 'POST') {
        const { slot, user, caseReport, authKey } = req.body;
        // ... (省略 Redis 鉴权与锁定逻辑，请保持您原有的代码不动)

        try {
            // ⚡ 极简格式化引擎 (还原 2026-08-30 格式)
            const formatShortDate = (slotStr) => {
                const datePart = slotStr.split('_')[0]; // 如 2026-08-30
                const timePart = slotStr.split('_')[1]; // 如 AM
                return `${datePart} ${timePart}`;
            };

            const formatText = (text) => (text || '').replace(/\n/g, '<br>');
            const shortDate = formatShortDate(slot);
            const ts = caseReport.timeSpace || {};
            const fr = caseReport.fiveRelations || {};
            const ce = caseReport.careerEdu || {};

            // ⚡ 完全复刻您最满意的 HTML 排版 ⚡
            const htmlContent = `
<div style="font-family: sans-serif; color: #333; line-height: 1.6; font-size: 15px;">
    <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">【新局锁定】 ${shortDate}</h2>
    <div style="border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">河洛咨询 · 局象拓扑</div>
    
    <h3 style="font-size: 15px; font-weight: bold; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">【锁定凭证】</h3>
    <p>预约姓名：${ts.name || user.name || '未填'}<br>
    微信号码：${user.wechat || '未填'}<br>
    预约时空：${shortDate.replace('-', '年').replace('-', '月')}日 ${slot.split('_')[1] === 'AM' ? '08:00-10:00' : '14:00-17:00'}</p>

    <h3 style="font-size: 15px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">【一、核心诉求】</h3>
    <p>本次推演聚焦：${caseReport.coreFocus || '未选定'}</p>

    <h3 style="font-size: 15px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">【二、时空结构】</h3>
    <p>填表称呼：${ts.name || '未填'} （身份：${ts.role || '未填'}）<br>
    常住成员：${ts.members || '未填'}<br>
    核心生辰：<div style="background: #f9f9f9; padding: 5px;">${formatText(ts.birthInfo)}</div></p>

    <h3 style="font-size: 15px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">【三、事业学业】</h3>
    <p>行业职向：${ce.career || '未填'}<br>子女学业：${ce.edu || '未填'}</p>
    
    <h3 style="font-size: 15px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">【四、五伦关系】</h3>
    <p>夫妇有别：${fr.spouse || '未明'}<br>父子有亲：${fr.parentchild || '未明'}<br>君臣有义：${fr.workplace || '未明'}<br>长幼有序：${fr.originfamily || '未明'}<br>朋友有信：${fr.social || '未明'}</p>
    
    <h3 style="font-size: 15px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">【五、其他补充】</h3>
    <p style="background: #f9f9f9; padding: 5px;">${formatText(caseReport.extraNotes)}</p>
</div>`;

            // ⚡ 双通道发送引擎 ⚡
            const tasks = [
                // 微信推送
                fetch('https://www.pushplus.plus/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: process.env.PUSHPLUS_TOKEN, title: `【新局锁定】 ${shortDate}`, content: htmlContent, template: 'html' })
                }),
                // 邮件推送 (核心：发件人名称设为您的品牌名)
                fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: '河洛咨询前置对齐系统 <onboarding@resend.dev>',
                        to: 'yuanbensheng18@gmail.com',
                        subject: `【新局锁定】 ${shortDate}`,
                        html: htmlContent
                    })
                })
            ];

            await Promise.allSettled(tasks);
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }
}
