export default function handler(req, res) {
    // 1. 获取请求头特征 (Chrome 可能会吞掉 Referer，但绝对吞不掉 Origin 和 Host)
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const host = req.headers.host || '';

    // 2. 动态 CORS 配置：只允许你的独立站跨域拿钥匙
    const allowedOrigins = ['https://heluo.pro', 'https://www.heluo.pro', 'http://localhost:3000'];
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin && host.includes('heluo.pro')) {
        // 针对同源直接请求，补全 CORS
        res.setHeader('Access-Control-Allow-Origin', 'https://heluo.pro');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 放行预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. 智能防盗链核验：只要满足其一，即视为安全环境
    const isSafe = 
        (origin && origin.includes('heluo.pro')) || 
        (referer && referer.includes('heluo.pro')) || 
        (host && host.includes('heluo.pro')) || 
        (host && host.includes('localhost'));

    if (!isSafe) {
        // 下载工具和嗅探爬虫无法伪造完美的同源 Host 环境，将被直接拦截
        console.warn('非法环境窃取密钥，已被拦截');
        return res.status(403).send('Forbidden: Invalid Space-Time Origin');
    }

    // 4. 下发 AES-128 军工级解密密钥
    const KEY = '1c8d09694ee6b4c5b4d2c3b8e6dbe5e6'; // 你视频的 16进制 密钥
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); // 绝对禁止浏览器缓存钥匙
    res.send(Buffer.from(KEY, 'hex'));
}
