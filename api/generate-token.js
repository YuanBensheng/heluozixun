import crypto from 'crypto';

export default function handler(req, res) {
    // 仅允许自己域名访问（可选，加强安全）
    const referer = req.headers.referer || '';
    if (!referer.includes('heluo.pro')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const secret = process.env.TOKEN_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Token secret not configured' });
    }

    // 生成 token：包含过期时间（2分钟后）
    const expires = Date.now() + 2 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ exp: expires })).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = `${payload}.${signature}`;

    res.status(200).json({ token });
}
