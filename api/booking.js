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
                    // 🚀 启动异步微信推送星图 (2秒熔断赛跑机制)
                    // 🚀 启动异步微信推送 (处理好换行符的逻辑)
                            try {
                                const pushToken = process.env.PUSHPLUS_TOKEN; 

                                if (pushToken) {
                                    const ts = caseReport.timeSpace || {};
                                    const fr = caseReport.fiveRelations || {};
                                    const ce = caseReport.careerEdu || {};
                                    
                                    // 【核心修改】定义换行处理函数，将文本中的 \n 替换为 HTML 换行标签 <br>
                                    const formatText = (text) => (text || '').replace(/\n/g, '<br>');

                                    const htmlContent = `
<div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #333333; line-height: 1.8; font-size: 15px; padding: 10px;">
    <h2 style="text-align: center; font-size: 18px; font-weight: bold; border-bottom: 2px solid #333333; padding-bottom: 10px; margin-bottom: 20px;">
        河洛咨询 · 局象拓扑
    </h2>
    <h3 style="font-size: 16px; font-weight: bold; margin-top: 15px; border-bottom: 1px dashed #cccccc; padding-bottom: 5px;">
        【锁定凭证】
    </h3>
    <p style="margin: 5px 0;"><strong>预约姓名：</strong> ${ts.name || user.name}</p>
    <p style="margin: 5px 0;"><strong>微信号码：</strong> ${user.wechat}</p>
    <p style="margin: 5px 0;"><strong>预约时空：</strong> ${req.body.displayTime || slot.replace('_', ' ')}</p>

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

                            // ⚡【核心改造：PushPlus 微信推送 + Promise 赛跑机制】⚡
                            // 赛道 1：向 PushPlus 发送 POST 请求
                            const pushTask = fetch('https://www.pushplus.plus/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    token: pushToken,
                                    title: `【新局锁定】${slot.replace('_', ' ')} `,
                                    content: htmlContent,
                                    template: 'html' // 明确告诉 PushPlus 这是 HTML 格式
                                })
                            }).catch(err => {
                                console.error("PushPlus 推送异常:", err);
                            });

                            // 赛道 2：两秒死亡倒计时
                            const timeoutTask = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000));

                            // 发令枪响：两者谁先执行完，系统都将立刻往下放行
                            await Promise.race([pushTask, timeoutTask]);
                        } else {
                            console.error("注意：Vercel 环境中未检测到 PUSHPLUS_TOKEN，推送中止。");
                        }
                    } catch (pushSetupError) {
                        console.error("推送逻辑配置未通过，熔断保护启用:", pushSetupError);
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
