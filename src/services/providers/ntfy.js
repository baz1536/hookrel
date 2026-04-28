async function sendNtfy(config, title, message) {
    const { ntfy } = config;
    if (!ntfy) throw new Error('ntfy configuration missing');
    if (!ntfy.serverUrl) throw new Error('ntfy server URL is required');
    if (!ntfy.topic) throw new Error('ntfy topic is required');

    const url = `${ntfy.serverUrl.replace(/\/$/, '')}/${ntfy.topic.trim()}`;

    const headers = {
        'Content-Type': 'text/plain',
        'X-Title': title,
    };

    if (ntfy.priority && ntfy.priority !== 'default') {
        headers['X-Priority'] = ntfy.priority;
    }

    if (ntfy.token) {
        headers['Authorization'] = `Bearer ${ntfy.token}`;
    }

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: message,
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`ntfy error ${res.status}: ${body}`);
    }
}

module.exports = { sendNtfy };
