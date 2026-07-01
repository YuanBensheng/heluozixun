// api/verify-key.js
// ⚡ 100% 继承原生 fetch 架构，集成“云端绝对时间戳”与“海外课程双轨制动态设备指纹锁”

import crypto from 'crypto'; 

export default async function handler(req, res) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ success: false, message: "云端数据库钥匙未配置" });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: '请求路径不匹配' });
    }

    // 👉 【安全升级】：接收前端传入的密码、通道标识，以及极度核心的设备指纹 deviceId
    const { key, portalType, deviceId } = req.body;
    if (!key || key.length !== 6) {
        return res.status(400).json({ success: false, message: '维度密钥格式异常' });
    }

    try {
        const pwd = key.toUpperCase();
        const type = pwd.charAt(0); 
        const client = pwd.substring(1, 5); 
        const providedCheckDigit = pwd.charAt(5);

        // ==========================================
        // 🛡️ 1. 核心防御：密码盘算法校验（底层防线绝对不变）
        // ==========================================
        const SECRET_SALT = process.env.SECRET_SALT || "HeLuoGuoxue2026#@!QuantumKeyCenter";
        const stringToCheck = type + client + SECRET_SALT;
        const fullHash = crypto.createHash('sha256').update(stringToCheck).digest('hex').toUpperCase();
        const expectedCheckDigit = fullHash.charAt(0);

        if (providedCheckDigit !== expectedCheckDigit) {
            return res.status(400).json({ success: false, message: '密钥未与当前时空对齐，请核对或联系咨询师！' });
        }

        // ==========================================
        // 🔀 2. 架构分叉：双轨制通道识别
        // ==========================================
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const ua = req.headers['user-agent'] || 'unknown';
        const now = Date.now();
        const redisKey = `burnt_key:${pwd}`;

        // 智能识别：排除公域VIP，剩下的自动分配至海外课程通道
        const isCourse = !['E', 'F', 'W', 'P', 'V'].includes(type);

        if (!isCourse) {
            // ----------------------------------------------------
            // 轨道路线 A：公域/VIP通道 —— 极严苛“一机一密，云端绝对倒计时”
            // ----------------------------------------------------
            // 公域咨询依然强绑定物理IP与网络环境，防止异地秒转
            const fingerprintStr = ip + ua; 
            const deviceFingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["SET", redisKey, deviceFingerprint, "EX", 1800, "NX"]) // 30分钟
            });
            const data = await response.json();

            if (data.result === "OK") {
                return res.status(200).json({ success: true, type: type, message: "因果锁定成功，密钥全网熔断生效", remainingSeconds: 1800 });
            } else {
                const getResp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(["GET", redisKey]) });
                const getData = await getResp.json();
                
                if (getData.result === deviceFingerprint) {
                    const ttlResp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(["TTL", redisKey]) });
                    const ttlData = await ttlResp.json();
                    const ttl = parseInt(ttlData.result, 10);

                    if (ttl > 0) {
                        return res.status(200).json({ success: true, type: type, message: "通道已恢复，请继续观看", remainingSeconds: ttl });
                    } else {
                        return res.status(400).json({ success: false, message: "该时空密钥能量已耗尽，请重新获取！" });
                    }
                } else {
                    return res.status(400).json({ success: false, message: "该时空密钥已被其他节点熔断，无法二次冒领！" });
                }
            }
        } else {
            // ----------------------------------------------------
            // 轨道路线 B：海外课程通道 —— 终极防无痕碰撞的弹性高维沙盒
            // ----------------------------------------------------
            // 🎯【核心修复】：彻底抛弃单纯 UA 判定。强制提取前端 UUID 进行防篡改哈希
            // 如果有人恶意发包绕过前端，则兜底使用 IP+UA 的强哈希，将其直接逼入死胡同
            const fingerprintStr = deviceId || (ip + ua); 
            const deviceFingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
            
            const targetCourse = portalType || 'unknown';

            const getResp = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(["GET", redisKey])
            });
            const getData = await getResp.json();

            let courseData = null;
            if (getData.result) {
                try {
                    courseData = JSON.parse(getData.result);
                } catch (e) {
                    courseData = {
                        currentDevice: getData.result,
                        devices: [getData.result],
                        lastNewDeviceTime: 0,
                        lastIp: ip,
                        boundCourse: targetCourse 
                    };
                }
            }

            if (!courseData) {
                // 👉 场景 1：全新课程密钥，首次激活
                const newCourseData = {
                    currentDevice: deviceFingerprint,
                    devices: [deviceFingerprint], // 占用第 1 个设备槽位
                    lastNewDeviceTime: 0,       
                    lastIp: ip,
                    boundCourse: targetCourse     
                };
                await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: JSON.stringify(["SET", redisKey, JSON.stringify(newCourseData), "EX", 31536000]) // 1年有效期
                });
                return res.status(200).json({ success: true, type: type, message: "课程鉴权成功，设备已首发绑定（有效期一年）" });
            } else {
                // 👉 场景 2：已有记录，进行鉴权或拦截
                
                // 🛡️ 跨课白嫖拦截
                const originallyBoundCourse = courseData.boundCourse || courseData.authorizedCourse;
                if (originallyBoundCourse && originallyBoundCourse !== targetCourse) {
                    return res.status(400).json({ success: false, message: "安全拦截：该时空密钥与当前课程因果不匹配，禁止跨课访问！" });
                }

                if (courseData.lastNewDeviceTime === undefined) {
                    courseData.lastNewDeviceTime = courseData.lastSwitchTime || 0;
                }

                // 🟢 验证当前数字指纹是否已在白名单（无痕模式每次都会是一个新指纹，直接进入下方新设备判定）
                if (courseData.devices.includes(deviceFingerprint)) {
                    courseData.currentDevice = deviceFingerprint;
                    courseData.lastIp = ip;
                    if (!courseData.boundCourse) courseData.boundCourse = targetCourse;

                    await fetch(url, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: JSON.stringify(["SET", redisKey, JSON.stringify(courseData), "KEEPTTL"])
                    });
                    return res.status(200).json({ success: true, type: type, message: "欢迎回归，授权设备通道已为您畅通" });
                } else {
                    // 🚨 尝试绑定【新设备】（无痕模式滥用者将在此被快速消耗殆尽）
                    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

                    // 【防线 1：设备槽位上限拦截】
                    if (courseData.devices.length >= 3) {
                        return res.status(400).json({ success: false, message: "安全拦截：该密钥绑定的设备总数已达上限（3台），禁止越权分享。" });
                    }

                    // 【防线 2：48小时绝对冷冻期】
                    if (now - courseData.lastNewDeviceTime < FORTY_EIGHT_HOURS) {
                        const timeLeft = Math.ceil((FORTY_EIGHT_HOURS - (now - courseData.lastNewDeviceTime)) / 3600000);
                        return res.status(400).json({ success: false, message: `系统防线：绑定新设备处于安全冷冻期，请在 ${timeLeft} 小时后重试。` });
                    }

                    // 🟢 通过所有风控，正式追加新指纹
                    courseData.currentDevice = deviceFingerprint;
                    courseData.devices.push(deviceFingerprint); 
                    courseData.lastNewDeviceTime = now; 
                    courseData.lastIp = ip; 
                    if (!courseData.boundCourse) courseData.boundCourse = targetCourse;

                    await fetch(url, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: JSON.stringify(["SET", redisKey, JSON.stringify(courseData), "KEEPTTL"]) 
                    });

                    return res.status(200).json({ success: true, type: type, message: `新设备授权成功！当前已绑定 ${courseData.devices.length}/3 台设备。` });
                }
            }
        }
    } catch (error) {
        console.error('云端锁单异常:', error);
        return res.status(500).json({ success: false, message: "高维星图链接闪烁: " + error.message });
    }
}
