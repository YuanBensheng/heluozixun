// api/booking.js
import nodemailer from 'nodemailer';

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

    // 2. 锁定与案卷暗传逻辑：有人点击正式锁定时，尝试全网霸占该时间段并投递邮件
    if (req.method === 'POST') {
        // 接收前端默默打包的全量数据
        const { slot, user, caseReport } = req.body;
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
                // ================= 核心增强：案卷暗传机制 =================
                if (user && caseReport) {
                    try {
                        // 建立 SMTP 加密传输通道 (请在 Vercel 环境变量中配置 SMTP_PASS)
                        const transporter = nodemailer.createTransport({
                            host: 'smtp.163.com',
                            port: 465,
                            secure: true, // 使用 SSL
                            auth: {
                                user: process.env.SMTP_USER || 'burujushi@163.com',
                                pass: process.env.SMTP_PASS   // 这里必须填 163 邮箱的“授权码”，非登录密码
                            }
                        });

                        // 组装古朴严密的数字案卷
                        const mailOptions = {
                            from: `"河洛前置系统" <${process.env.SMTP_USER || 'burujushi@163.com'}>`,
                            to: 'heluopro@163.com',
                            subject: `【新局锁定】${user.name} 阁下预约了 ${slot.replace('_', ' ')}`,
                            html: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #010614; color: #00ffcc; padding: 30px; border: 1px solid #10b981; border-radius: 8px;">
                                <h2 style="text-align: center; border-bottom: 1px solid rgba(16,185,129,0.3); padding-bottom: 15px; letter-spacing: 2px;">河洛咨询 · 局象案卷</h2>
                                
                                <h3 style="color: #10b981; margin-top: 25px;">【锁定凭证】</h3>
                                <p style="color: #7ebdae; font-size: 15px;">预约时空：<strong style="color: #fff;">${slot.replace('_', ' ')}</strong></p>
                                <p style="color: #7ebdae; font-size: 15px;">溯源尊称：<strong style="color: #fff;">${user.name}</strong></p>
                                <p style="color: #7ebdae; font-size: 15px;">微信账号：<strong style="color: #fff;">${user.wechat}</strong></p>

                                <h3 style="color: #10b981; margin-top: 25px;">【基础硬要素】</h3>
                                <p style="color: #7ebdae; font-size: 15px;">行业界域：${caseReport.industry || '未留痕'}</p>
                                <p style="color: #7ebdae; font-size: 15px;">主体时空：${caseReport.selfName || '未留痕'} (${caseReport.calendarMode}) ${caseReport.dob || ''}</p>
                                <p style="color: #7ebdae; font-size: 15px;">关联时空：${caseReport.otherInfo || '无'}</p>

                                <h3 style="color: #10b981; margin-top: 25px;">【五伦磁场定性】</h3>
                                <p style="color: #7ebdae; font-size: 15px;">夫妇能量：${caseReport.relations?.spouse || '未明'}</p>
                                <p style="color: #7ebdae; font-size: 15px;">代际能量：${caseReport.relations?.child || '未明'}</p>
                                <p style="color: #7ebdae; font-size: 15px;">职场能量：${caseReport.relations?.boss || '未明'}</p>
                                <p style="color: #7ebdae; font-size: 15px;">合伙/平辈：${caseReport.relations?.friend || '未明'}</p>

                                <h3 style="color: #10b981; margin-top: 25px;">【余绪微言】</h3>
                                <div style="background: #000; padding: 15px; border: 1px solid #0d211c; border-radius: 4px; color: #7ebdae; line-height: 1.8;">
                                    ${(caseReport.notes || '客户未留下额外言辞').replace(/\n/g, '<br>')}
                                </div>
                                
                                <p style="text-align: center; margin-top: 40px; font-size: 12px; color: #2e7a68;">此案卷由河洛数字高维节点全自动生成 · 阅后请即妥善封存</p>
                            </div>
                            `
                        };

                        // Await 是 Serverless 环境中保证邮件成功发射的定海神针
                        await transporter.sendMail(mailOptions);
                    } catch (emailError) {
                        console.error("邮件投递遭受干扰，但时空沙盘已锁定：", emailError);
                        // 容错机制：即便由于邮箱授权码错误导致邮件没发出去，也不应阻断前端客户的预约成功流程
                    }
                }
                // =================================================================

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
