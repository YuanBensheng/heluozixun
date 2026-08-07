const crypto = require('crypto');

export default async function handler(req, res) {
    // 你的腾讯云 W 视频原始地址
    const M3U8_ORIGIN = process.env.M3U8_ORIGIN_URL || "https://heluo-video-1440667177.cos.ap-guangzhou.myqcloud.com/output_hls/output.m3u8";

    try {
        const m3u8Resp = await fetch(M3U8_ORIGIN);
        if (!m3u8Resp.ok) throw new Error('COS 响应失败');
        let m3u8Content = await m3u8Resp.text();

        // 1. 补全 TS 分片绝对路径
        const basePath = M3U8_ORIGIN.substring(0, M3U8_ORIGIN.lastIndexOf('/') + 1);
        m3u8Content = m3u8Content.replace(/(segment_\d+\.ts)/g, basePath + '$1');

        // 2. 生成 2 分钟寿命的动态 Token (Node.js 原生写法，绝对不崩)
        const secret = process.env.TOKEN_SECRET || 'HeLuoSecret2026';
        const expires = Date.now() + 2 * 60 * 1000; 
        const payloadBase64 = Buffer.from(JSON.stringify({ exp: expires })).toString('base64');
        const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
        const token = `${payloadBase64}.${signature}`;

        // 3. 把钥匙路径改为指向你的独立站，并挂上 Token
        m3u8Content = m3u8Content.replace(/URI="([^"]*)"/, `URI="/api/get-video-key?token=${token}"`);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(m3u8Content);
    } catch (e) {
        console.error('get-m3u8 代理报错:', e);
        res.status(500).send('Proxy Error');
    }
}
