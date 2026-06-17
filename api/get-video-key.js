
```javascript
export default async function handler(req, res) {
    const referer = req.headers.referer || '';
    if (!referer.includes('heluo.pro')) {
        return res.status(403).send('Forbidden');
    }

    const token = req.query.token;
    if (!token) {
        return res.status(403).send('Missing token');
    }

    const secret = process.env.TOKEN_SECRET;
    if (!secret) {
        return res.status(500).send('Server config error');
    }

    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) {
        return res.status(403).send('Invalid token format');
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payloadBase64));
    const expectedSig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (expectedSig !== signature) {
        return res.status(403).send('Invalid token signature');
    }

    // 不用 Buffer，手动 base64 解码
    let payload;
    try {
        const jsonStr = decodeURIComponent(escape(atob(payloadBase64)));
        payload = JSON.parse(jsonStr);
    } catch {
        return res.status(403).send('Invalid token payload');
    }

    if (!payload.exp || Date.now() > payload.exp) {
        return res.status(403).send('Token expired');
    }

    // 返回密钥（hex 转二进制不用 Buffer）
    const KEY_HEX = '1c8d09694ee6b4c5b4d2c3b8e6dbe5e6';
    const keyBytes = new Uint8Array(KEY_HEX.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.send(keyBytes);
}
