export default async function handler(req, res) {
    // 1. 防盗链
    const referer = req.headers.referer || '';
    if (!referer.includes('heluo.pro')) {
        return res.status(403).send('Forbidden');
    }

    // 2. 读取环境变量中的原始 m3u8 地址
    const M3U8_ORIGIN = process.env.M3U8_ORIGIN_URL;
    if (!M3U8_ORIGIN) {
        return res.status(500).send('M3U8 origin not configured');
    }

    try {
        // 3. 从 COS 拉取原始 m3u8 文件
        const m3u8Resp = await fetch(M3U8_ORIGIN);
        if (!m3u8Resp.ok) throw new Error('上游 M3U8 加载失败');
        let m3u8Content = await m3u8Resp.text();

        // 4. 把分片路径从相对路径改成绝对路径
        const basePath = M3U8_ORIGIN.substring(0, M3U8_ORIGIN.lastIndexOf('/') + 1);
        m3u8Content = m3u8Content.replace(/(segment_\d+\.ts)/g, basePath + '$1');

        // 5. 生成动态 Token（2 分钟有效）
        const crypto = await import('crypto');
        const secret = process.env.TOKEN_SECRET;
        if (!secret) throw new Error('TOKEN_SECRET not configured');

        const expires = Date.now() + 2 * 60 * 1000;
        const payload = Buffer.from(JSON.stringify({ exp: expires })).toString('base64');
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        const token = `${payload}.${signature}`;

        // 6. 替换 m3u8 中的密钥 URI，追加 token 参数
        m3u8Content = m3u8Content.replace(
            /URI="([^"]*)"/,
            `URI="$1?token=${token}"`
        );

        // 7. 返回加工后的 m3u8
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(m3u8Content);
    } catch (e) {
        console.error('get-m3u8 error:', e);
        res.status(500).send('M3U8 代理失败');
    }
}
