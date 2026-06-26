const nodemailer = require('nodemailer');

export default async function handler(req, res) {
    // 仅允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { name, contact, intent, message } = req.body;

    // 配置 Gmail 传输器
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER, // 您的邮箱地址
            pass: process.env.GMAIL_PASS  // Gmail 的应用专用密码
        }
    });

    // 构建干净的文本邮件内容（无需复杂HTML，方便手机快速阅读）
    const mailText = `
【河洛咨询 - 公域线索提醒】
收到新的时空对接意向，详情如下：

- 客户称呼：${name}
- 联络方式：${contact}
- 核心诉求：${intent}
- 背景简述：${message || '未填写'}

时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
    `;

    const mailOptions = {
        from: `"河洛系统" <${process.env.GMAIL_USER}>`,
        to: 'burujushi@gmail.com', // 发送到您指定的邮箱
        subject: `【新线索】河洛咨询公域意向 - ${name}`,
        text: mailText
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: '邮件发送成功' });
    } catch (error) {
        console.error('公域表单发送失败:', error);
        res.status(500).json({ success: false, error: '发送失败' });
    }
}
