

export default function handler(req, res) {
    const referer = req.headers.referer || '';
    if (!referer.includes('heluo.pro')) {
        return res.status(403).send('Forbidden');
    }
    const KEY = '82a72e8d3160e9b5fd03ed452574a6c0'; // 替换成你用ffmpeg生成的32位密钥
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(KEY, 'hex'));
}
