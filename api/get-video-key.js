

export default function handler(req, res) {
    const referer = req.headers.referer || '';
    if (!referer.includes('heluo.pro')) {
        return res.status(403).send('Forbidden');
    }
    const KEY = '1c8d09694ee6b4c5b4d2c3b8e6dbe5e6'; // 替换成你用ffmpeg生成的32位密钥
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(KEY, 'hex'));
}
