async function sendDiscord(config, text) {
    const { discord } = config;
    if (!discord) throw new Error('Discord configuration missing');
    if (!discord.webhookUrl) throw new Error('Discord webhook URL is required');

    const res = await fetch(discord.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Discord error ${res.status}: ${body}`);
    }
}

module.exports = { sendDiscord };
