export default async function handler(req, res) {
    const referer = req.headers.referer || '';
    if (!referer.includes('heluo.pro')) {
        return res.status(403).send('Forbidden');
    }

    const M3U8_ORIGIN = process.env.M3U8_ORIGIN_URL;
    if (!M3U8_ORIGIN) {
        return res.status(500).send('M3U8 origin not configured');
    }

    try {
        const m3u8Resp = await fetch(M3U8_ORIGIN);
        if (!m3u8Resp.ok) throw new Error('上游 M3U8 加载失败');
        let m3u8Content = await m3u8Resp.text();

        const basePath = M3U8_ORIGIN.substring(0, M3U8_ORIGIN.lastIndexOf('/') + 1);
        m3u8Content = m3u8Content.replace(/(segment_\d+\.ts)/g, basePath + '$1');

        const secret = process.env.TOKEN_SECRET;
        if (!secret) throw new Error('TOKEN_SECRET not configured');

        // 用 Web Crypto API 代替 Node crypto 模块
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const expires = Date.now() + 2 * 60 * 1000;
        const payload = Buffer.from(JSON.stringify({ exp: expires })).toString('base64');
        const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
        const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const token = `${payload}.${signature}`;

        m3u8Content = m3u8Content.replace(
            /URI="([^"]*)"/,
            `URI="$1?token=${token}"`
        );

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(m3u8Content);
    } catch (e) {
        console.error('get-m3u8 error:', e.message);
        res.status(500).send('M3U8 代理失败');
    }
}
