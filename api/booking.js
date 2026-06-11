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
                            from: `"河洛咨询前置对齐系统" <${process.env.SMTP_USER || 'burujushi@163.com'}>`,
                            to: 'heluopro@163.com',
                            subject: `【新局锁定】${slot.replace('_', ' ')}`,
                            html: `
<div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 700px; margin: 0 auto; color: #333333; line-height: 1.8; font-size: 15px; background-color: #ffffff; padding: 20px;">
    
    <h2 style="text-align: center; font-size: 20px; font-weight: bold; border-bottom: 2px solid #333333; padding-bottom: 15px; margin-bottom: 30px;">
        河洛咨询 · 局象拓扑
    </h2>
    
    <h3 style="font-size: 16px; font-weight: bold; margin-top: 25px; border-bottom: 1px dashed #cccccc; padding-bottom: 8px;">
        【锁定凭证】
    </h3>
    
    <p style="margin: 8px 0;"><strong>预约姓名：</strong> ${ts.name || user.name}</p>
    <p style="margin: 8px 0;"><strong>微信号码：</strong> ${user.wechat}</p>
    <p style="margin: 8px 0;"><strong>预约时空：</strong> ${slot.replace('_', ' ')}</p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 30px; border-bottom: 1px dashed #cccccc; padding-bottom: 8px;">
        【一、核心诉求】
    </h3>
    <p style="margin: 8px 0;"><strong>本次推演聚焦：</strong> ${caseReport.coreFocus || '未选定'}</p>
    
    <h3 style="font-size: 16px; font-weight: bold; margin-top: 30px; border-bottom: 1px dashed #cccccc; padding-bottom: 8px;">
        【二、时空结构】
    </h3>
    <p style="margin: 8px 0;"><strong>填表称呼：</strong> ${ts.name || '未填'} （家庭身份：${ts.role || '未填'}）</p>
    <p style="margin: 8px 0;"><strong>常住成员：</strong> ${ts.members || '未填'}</p>
    <p style="margin: 8px 0;"><strong>核心生辰：</strong></p>
    <p style="margin: 8px 0; white-space: pre-wrap; background: #f9f9f9; padding: 10px; border: 1px solid #eeeeee;">${ts.birthInfo || '未填写'}</p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 30px; border-bottom: 1px dashed #cccccc; padding-bottom: 8px;">
        【三、事业学业】
    </h3>
    <p style="margin: 8px 0;"><strong>行业职向：</strong> ${ce.career || '未填'}</p>
    <p style="margin: 8px 0;"><strong>子女学业：</strong> ${ce.edu || '未填'}</p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 30px; border-bottom: 1px dashed #cccccc; padding-bottom: 8px;">
        【四、五伦关系】
    </h3>
    <p style="margin: 8px 0;"><strong>夫妇有别 (伴侣)：</strong> ${fr.spouse || '未明'}</p>
    <p style="margin: 8px 0;"><strong>父子有亲 (亲子)：</strong> ${fr.parentchild || '未明'}</p>
    <p style="margin: 8px 0;"><strong>君臣有义 (尊卑)：</strong> ${fr.workplace || '未明'}</p>
    <p style="margin: 8px 0;"><strong>长幼有序 (长幼)：</strong> ${fr.originfamily || '未明'}</p>
    <p style="margin: 8px 0;"><strong>朋友有信 (社交)：</strong> ${fr.social || '未明'}</p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 30px; border-bottom: 1px dashed #cccccc; padding-bottom: 8px;">
        【五、其他补充】
    </h3>
    <p style="margin: 8px 0; white-space: pre-wrap; background: #f9f9f9; padding: 10px; border: 1px solid #eeeeee;">${caseReport.extraNotes || '未留言'}</p>
    
    <div style="margin-top: 50px; padding-top: 15px; border-top: 1px solid #dddddd; text-align: center; font-size: 12px; color: #999999;">
        此案卷由河洛咨询前置对齐系统自动汇总生成
    </div>

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
