export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const referer = req.headers.referer || '';
    // 如果没有 Referer，直接拒绝 (拦截迅雷等下载器)
    if (!referer.includes('heluo.pro') && !referer.includes('localhost')) {
        return res.status(403).send('Forbidden: No Referer');
    }

    const token = req.query.token;
    if (!token) return res.status(403).send('Missing token');

    const secret = process.env.TOKEN_SECRET || 'HeLuoSecret2026';
    const [payloadBase64, signature] = token.split('.');
    
    if (!payloadBase64 || !signature) return res.status(403).send('Invalid token format');

    try {
        // 校验签名
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payloadBase64));
        const expectedSig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        if (expectedSig !== signature) return res.status(403).send('Invalid token signature');

        // 解码并校验是否过期
        const jsonStr = decodeURIComponent(escape(atob(payloadBase64)));
        const payload = JSON.parse(jsonStr);

        if (!payload.exp || Date.now() > payload.exp) {
            return res.status(403).send('Token expired');
        }

        // 下发 AES 密钥 (请确保这是你 openssl 手动加密时的那个 16进制 KEY)
        const KEY_HEX = '1c8d09694ee6b4c5b4d2c3b8e6dbe5e6'; 
        const keyBytes = new Uint8Array(KEY_HEX.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.send(keyBytes);
    } catch (err) {
        return res.status(403).send('Token payload error');
    }
}
