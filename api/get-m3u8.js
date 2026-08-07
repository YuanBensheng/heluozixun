export default async function handler(req, res) {
    const referer = req.headers.referer || '';
    // 允许本地测试和线上域名
    const isSafeOrigin = referer.includes('heluo.pro') || referer.includes('localhost');
    if (!isSafeOrigin) {
        return res.status(403).send('Forbidden: Invalid Space-Time Origin');
    }

    // 这里写死你腾讯云上那个 W 视频的真实 output.m3u8 地址
    const M3U8_ORIGIN = process.env.M3U8_ORIGIN_URL || "https://heluo-video-1440667177.cos.ap-guangzhou.myqcloud.com/output_hls/output.m3u8";

    try {
        const m3u8Resp = await fetch(M3U8_ORIGIN);
        if (!m3u8Resp.ok) throw new Error('上游 M3U8 加载失败');
        let m3u8Content = await m3u8Resp.text();

        // 1. 补全 .ts 分片的绝对路径
        const basePath = M3U8_ORIGIN.substring(0, M3U8_ORIGIN.lastIndexOf('/') + 1);
        m3u8Content = m3u8Content.replace(/(segment_\d+\.ts)/g, basePath + '$1');

        // 2. 生成动态防盗 Token (2分钟有效期)
        const secret = process.env.TOKEN_SECRET || 'HeLuoSecret2026';
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const expires = Date.now() + 2 * 60 * 1000;
        const payloadJson = JSON.stringify({ exp: expires });
        
        // 用 btoa 替代 Buffer
        const payloadBase64 = btoa(unescape(encodeURIComponent(payloadJson)));
        const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payloadBase64));
        const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const token = `${payloadBase64}.${signature}`;

        // 3. 把 Token 塞进寻找解密钥匙的 URL 里
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
