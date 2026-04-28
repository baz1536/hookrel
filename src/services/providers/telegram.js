const { decrypt } = require('../encryption');

async function sendTelegram(config, text) {
    const { telegram } = config;
    if (!telegram) throw new Error('Telegram configuration missing');

    const token = decrypt(telegram.botToken);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: telegram.chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram error: ${data.description || 'Unknown error'}`);
    return data;
}

module.exports = { sendTelegram };
