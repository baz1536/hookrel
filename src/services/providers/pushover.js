const { decrypt } = require('../encryption');

const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

async function sendPushover(config, title, message) {
    const { pushover } = config;
    if (!pushover) throw new Error('Pushover configuration missing');

    const body = new URLSearchParams({
        token: decrypt(pushover.apiToken),
        user: pushover.userKey,
        title,
        message,
        priority: pushover.priority || '0',
        ...(pushover.device && { device: pushover.device }),
        ...(pushover.sound && pushover.sound !== 'default' && { sound: pushover.sound }),
    });

    const res = await fetch(PUSHOVER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    const data = await res.json();
    if (data.status !== 1) throw new Error(`Pushover error: ${(data.errors || []).join(', ')}`);
    return data;
}

module.exports = { sendPushover };
