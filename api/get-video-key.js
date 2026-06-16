

export default function handler(req, res) {
    const referer = req.headers.referer || '';
    if (!referer.includes('heluo.pro')) {
        return res.status(403).send('Forbidden');
    }
    const KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // 替换成你用ffmpeg生成的32位密钥
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(KEY, 'hex'));
}
