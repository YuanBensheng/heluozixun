const crypto = require('crypto');

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = req.query.token;
    if (!token) return res.status(403).send('Forbidden: Missing Token'); // 拦截迅雷、小米直接扒取

    try {
        const secret = process.env.TOKEN_SECRET || 'HeLuoSecret2026';
        const [payloadBase64, signature] = token.split('.');
        if (!payloadBase64 || !signature) throw new Error('Invalid format');
        
        // 1. 验证签名防伪造
        const expectedSig = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
        if (expectedSig !== signature) throw new Error('Signature mismatch');

        // 2. 验证时间防重放
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        if (Date.now() > payload.exp) throw new Error('Token Expired');

        // 3. 下发真实 AES 密钥
        const KEY_HEX = '1c8d09694ee6b4c5b4d2c3b8e6dbe5e6'; // 你视频切片用的真实 16 进制密码
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.send(Buffer.from(KEY_HEX, 'hex'));
    } catch (e) {
        return res.status(403).send('Forbidden: Token Authentication Failed');
    }
}
