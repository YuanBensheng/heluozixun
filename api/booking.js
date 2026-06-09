import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: "云端数据库钥匙未配置，请检查 Vercel 绑定状态。" });
    }

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

    if (req.method === 'POST') {
        const { slot, user, caseReport } = req.body;
        if (!slot) {
            return res.status(400).json({ error: "未选择具体的时间段" });
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SADD", "booked_slots", slot])
            });
            const data = await response.json();

            // 若抢占成功
            if (data.result === 1) {
                if (user && caseReport) {
                    try {
                        const transporter = nodemailer.createTransport({
                            host: 'smtp.163.com',
                            port: 465,
                            secure: true, 
                            auth: {
                                user: process.env.SMTP_USER || 'burujushi@163.com',
                                pass: process.env.SMTP_PASS   
                            }
                        });

                        // 结构化解构前端传来的新 Schema，防止 undefined
                        const ts = caseReport.timeSpace || {};
                        const fr = caseReport.fiveRelations || {};
                        const ce = caseReport.careerEdu || {};

                        const mailOptions = {
                            from: `"河洛前置系统" <${process.env.SMTP_USER || 'burujushi@163.com'}>`,
                            to: 'heluopro@163.com',
                            subject: `【新局锁定】${ts.name || user.name} 预约了 ${slot.replace('_', ' ')}`,
                            html: `
                            <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; background: #010614; color: #00ffcc; padding: 30px; border: 1px solid #10b981; border-radius: 8px;">
                                <h2 style="text-align: center; border-bottom: 1px solid rgba(16,185,129,0.3); padding-bottom: 15px; letter-spacing: 2px;">河洛咨询 · 局象案卷</h2>
                                
                                <h3 style="color: #10b981; margin-top: 25px; border-left: 4px solid #00ffcc; padding-left: 10px;">【锁定凭证】</h3>
                                <p style="color: #7ebdae; font-size: 15px;">预约时空：<strong style="color: #fff;">${slot.replace('_', ' ')}</strong></p>
                                <p style="color: #7ebdae; font-size: 15px;">微信号码：<strong style="color: #fff;">${user.wechat}</strong></p>

                                <h3 style="color: #10b981; margin-top: 25px; border-left: 4px solid #00ffcc; padding-left: 10px;">【一、时空结构】</h3>
                                <p style="color: #7ebdae; font-size: 15px;">填表称呼：${ts.name || '未填'} <span style="color:#527a6e; font-size:12px;">(家庭身份：${ts.role || '未填'})</span></p>
                                <p style="color: #7ebdae; font-size: 15px;">常住成员：${ts.members || '未填'}</p>
                                <p style="color: #7ebdae; font-size: 15px;">核心生辰定格：</p>
                                <div style="background: rgba(0,255,204,0.05); padding: 12px; border: 1px dashed #2e7a68; color: #fff; line-height: 1.6; white-space: pre-wrap;">${ts.birthInfo || '客户未留下生辰信息'}</div>

                                <h3 style="color: #10b981; margin-top: 25px; border-left: 4px solid #00ffcc; padding-left: 10px;">【二、五伦关系】</h3>
                                <table style="width: 100%; color: #7ebdae; font-size: 14px; text-align: left; border-collapse: collapse;">
                                    <tr><td style="padding: 6px 0; width: 35%;">夫妇有别 (伴侣)：</td><td style="color: #fff;">${fr.spouse || '未明'}</td></tr>
                                    <tr><td style="padding: 6px 0;">父子有亲 (代际)：</td><td style="color: #fff;">${fr.parentchild || '未明'}</td></tr>
                                    <tr><td style="padding: 6px 0;">君臣有义 (职场)：</td><td style="color: #fff;">${fr.workplace || '未明'}</td></tr>
                                    <tr><td style="padding: 6px 0;">长幼有序 (原生)：</td><td style="color: #fff;">${fr.originfamily || '未明'}</td></tr>
                                    <tr><td style="padding: 6px 0;">朋友有信 (社交)：</td><td style="color: #fff;">${fr.social || '未明'}</td></tr>
                                </table>

                                <h3 style="color: #10b981; margin-top: 25px; border-left: 4px solid #00ffcc; padding-left: 10px;">【三、事业学业】</h3>
                                <p style="color: #7ebdae; font-size: 15px;">行业职向：${ce.career || '未填'}</p>
                                <p style="color: #7ebdae; font-size: 15px;">子女学业：${ce.edu || '未填'}</p>

                                <h3 style="color: #10b981; margin-top: 25px; border-left: 4px solid #00ffcc; padding-left: 10px;">【四、核心诉求】</h3>
                                <p style="color: #f43f5e; font-size: 18px; font-weight: bold; padding: 10px; background: rgba(244, 63, 94, 0.1); border-radius: 4px;">
                                    🎯 ${caseReport.coreFocus || '未选定'}
                                </p>

                                <h3 style="color: #10b981; margin-top: 25px; border-left: 4px solid #00ffcc; padding-left: 10px;">【五、余绪微言】</h3>
                                <div style="background: #000; padding: 15px; border: 1px solid #0d211c; border-radius: 4px; color: #7ebdae; line-height: 1.8;">
                                    ${(caseReport.extraNotes || '客户未留下额外言辞').replace(/\n/g, '<br>')}
                                </div>
                                
                                <p style="text-align: center; margin-top: 40px; font-size: 12px; color: #2e7a68; border-top: 1px solid #0d211c; padding-top: 20px;">
                                    此案卷由河洛数字高维节点全自动生成 · 阅后请即妥善封存
                                </p>
                            </div>
                            `
                        };

                        await transporter.sendMail(mailOptions);
                    } catch (emailError) {
                        console.error("邮件投递遭受干扰，但时空沙盘已锁定：", emailError);
                    }
                }
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
