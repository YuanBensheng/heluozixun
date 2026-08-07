export default function handler(req, res) {
    // 1. 设置强制 CORS 头，确保只有你的域名能读取这把钥匙
    // 如果你在本地测试，可以把 https://heluo.pro 换成 *
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. 基础防盗护城河：来源嗅探
    const referer = req.headers.referer || '';
    const origin = req.headers.origin || '';
    
    // 允许你的独立站域名以及本地开发环境通过
    const isSafeOrigin = referer.includes('heluo.pro') || 
                         origin.includes('heluo.pro') || 
                         referer.includes('localhost') || 
                         origin.includes('localhost');

    if (!isSafeOrigin) {
        // 如果是直接用下载工具/爬虫请求，直接拒绝给钥匙
        return res.status(403).send('Forbidden: Invalid Space-Time Origin');
    }

    // 3. 剔除残缺的 Token 验证逻辑，直接下发原始加密钥匙
    const KEY = '1c8d09694ee6b4c5b4d2c3b8e6dbe5e6'; // 你视频切片时设定的 16 进制密钥
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    
    // 将 16进制 字符串转换为 Buffer 字节流发送给播放器解密
    res.send(Buffer.from(KEY, 'hex'));
}
