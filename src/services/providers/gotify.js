async function sendGotify(config, title, message) {
    const { gotify } = config;
    if (!gotify) throw new Error('Gotify configuration missing');
    if (!gotify.serverUrl) throw new Error('Gotify server URL is required');
    if (!gotify.appToken) throw new Error('Gotify app token is required');

    const url = `${gotify.serverUrl.replace(/\/$/, '')}/message?token=${encodeURIComponent(gotify.appToken)}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title,
            message,
            priority: parseInt(gotify.priority) || 5,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gotify error ${res.status}: ${body}`);
    }
}

module.exports = { sendGotify };
