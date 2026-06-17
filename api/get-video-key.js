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

    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    } catch {
        return res.status(403).send('Invalid token payload');
    }

    if (!payload.exp || Date.now() > payload.exp) {
        return res.status(403).send('Token expired');
    }

    const KEY = '1c8d09694ee6b4c5b4d2c3b8e6dbe5e6';
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(KEY, 'hex'));
}
