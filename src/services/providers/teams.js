async function sendTeams(config, title, message) {
    const { teams } = config;
    if (!teams) throw new Error('Teams configuration missing');
    if (!teams.webhookUrl) throw new Error('Teams webhook URL is required');

    const res = await fetch(teams.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            summary: title,
            themeColor: '0078D4',
            sections: [{
                activityTitle: title,
                text: message,
            }],
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Teams error ${res.status}: ${body}`);
    }
}

module.exports = { sendTeams };
