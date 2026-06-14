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
        const { slot, user, caseReport, authKey } = req.body;
        if (!slot) {
            return res.status(400).json({ error: "未选择具体的时间段" });
        }

        try {
            // 🛡️ 防御：去云端查验该密钥是否被合法“永久燃烧”
            const checkKey = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["EXISTS", `burnt_key:${(authKey || '').toUpperCase()}`])
            });
            const keyData = await checkKey.json();
            if (!keyData.result || keyData.result !== 1) {
                return res.status(403).json({ success: false, message: "非法请求：密钥未激活或不存在！" });
            }

            // 锁定该时段
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
                        const pushToken = process.env.PUSHPLUS_TOKEN; 
                        const resendKey = process.env.RESEND_API_KEY;

                        // 提取原版深层嵌套数据
                        const ts = caseReport.timeSpace || {};
                        const fr = caseReport.fiveRelations || {};
                        const ce = caseReport.careerEdu || {};
                        
                        const formatText = (text) => (text || '').replace(/\n/g, '<br>');

                        // ⚡ 核心新增：自动时空推算引擎 ⚡
                        const parseTime = (slotStr) => {
                            try {
                                let currentYear = new Date().getFullYear();
                                let datePart = slotStr.split('_')[0] || ''; 
                                let timePart = slotStr.split('_')[1] || ''; 

                                let year = currentYear, month = '', day = '';
                                let parts = datePart.split('-');
                                
                                if (parts.length === 3) {
                                    year = parts[0];
                                    month = parts[1];
                                    day = parts[2];
                                } else if (parts.length === 2) {
                                    month = parts[0];
                                    day = parts[1];
                                } else {
                                    return { titleTime: slotStr, detailTime: slotStr };
                                }

                                // 确保两位数
                                month = month.padStart(2, '0');
                                day = day.padStart(2, '0');

                                // 推算周几
                                let dateObj = new Date(`${year}-${month}-${day}`);
                                let days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                                let weekday = days[dateObj.getDay()];

                                // 推算时间段
                                let timeRange = timePart;
                                if (timePart.toUpperCase() === 'AM') timeRange = '09:00-12:00';
                                if (timePart.toUpperCase() === 'PM') timeRange = '14:00-17:00';

                                let titleTime = `${year}年${month}月${day}日 ${timePart}`;
                                let detailTime = `${year}年${month}月${day}日 ${weekday} ${timeRange}`;

                                return { titleTime, detailTime };
                            } catch (e) {
                                return { titleTime: slotStr, detailTime: slotStr };
                            }
                        };

                        const timeInfo = parseTime(slot);
                        const unifiedTitle = `【新局锁定】${timeInfo.titleTime}`;

                        // ⚡ 完美照搬您原本的排版设计，仅将顶部替换为极简大标题和详细时空 ⚡
                        const htmlContent = `
<div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #333333; line-height: 1.8; font-size: 15px; padding: 10px;">
    <h2 style="text-align: center; font-size: 18px; font-weight: bold; border-bottom: 2px solid #333333; padding-bottom: 10px; margin-bottom: 20px;">
        ${unifiedTitle}
    </h2>
    <h3 style="font-size: 16px; font-weight: bold; margin-top: 15px; border-bottom: 1px dashed #cccccc; padding-bottom: 5px;">
        【锁定凭证】
    </h3>
    <p style="margin: 5px 0;"><strong>预约姓名：</strong> ${ts.name || user.name || '未填'}</p>
    <p style="margin: 5px 0;"><strong>微信号码：</strong> ${user.wechat || '未填'}</p>
    <p style="margin: 5px 0;"><strong>预约时空：</strong> ${timeInfo.detailTime}</p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #cccccc; padding-bottom: 5px;">
        【一、核心诉求】
    </h3>
    <p style="margin: 5px 0;"><strong>本次推演聚焦：</strong> ${caseReport.coreFocus || '未选定'}</p>
    
    <h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #cccccc; padding-bottom: 5px;">
        【二、时空结构】
    </h3>
    <p style="margin: 5px 0;"><strong>填表称呼：</strong> ${ts.name || '未填'} （身份：${ts.role || '未填'}）</p>
    <p style="margin: 5px 0;"><strong>常住成员：</strong> ${ts.members || '未填'}</p>
    <p style="margin: 5px 0;"><strong>核心生辰：</strong><br><span style="background: #f9f9f9; padding: 5px; display: block; border: 1px solid #eeeeee;">${formatText(ts.birthInfo)}</span></p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #cccccc; padding-bottom: 5px;">
        【三、事业学业】
    </h3>
    <p style="margin: 5px 0;"><strong>行业职向：</strong> ${ce.career || '未填'}</p>
    <p style="margin: 5px 0;"><strong>子女学业：</strong> ${ce.edu || '未填'}</p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #cccccc; padding-bottom: 5px;">
        【四、五伦关系】
    </h3>
    <p style="margin: 5px 0;"><strong>夫妇有别：</strong> ${fr.spouse || '未明'}</p>
    <p style="margin: 5px 0;"><strong>父子有亲：</strong> ${fr.parentchild || '未明'}</p>
    <p style="margin: 5px 0;"><strong>君臣有义：</strong> ${fr.workplace || '未明'}</p>
    <p style="margin: 5px 0;"><strong>长幼有序：</strong> ${fr.originfamily || '未明'}</p>
    <p style="margin: 5px 0;"><strong>朋友有信：</strong> ${fr.social || '未明'}</p>

    <h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; border-bottom: 1px dashed #cccccc; padding-bottom: 5px;">
        【五、其他补充】
    </h3>
    <p style="margin: 5px 0; background: #f9f9f9; padding: 5px; border: 1px solid #eeeeee;">${formatText(caseReport.extraNotes)}</p>
</div>
`;

                        const tasks = [];

                        // 赛道 1：PushPlus 微信推送
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
                                }).catch(err => console.error("PushPlus 推送异常:", err))
                            );
                        }

                        // 赛道 2：Resend 邮件推送
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
                                        to: 'yuanbensheng18@gmail.com', 
                                        subject: unifiedTitle,
                                        html: htmlContent
                                    })
                                }).catch(e => console.error("邮件推送异常:", e))
                            );
                        }

                        // 并行等待，确保 Vercel 将双通道消息成功发出
                        if (tasks.length > 0) {
                            await Promise.allSettled(tasks);
                        }

                    } catch (pushSetupError) {
                        console.error("推送逻辑配置未通过:", pushSetupError);
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
