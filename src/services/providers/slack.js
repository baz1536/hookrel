async function sendSlack(config, text) {
    const { slack } = config;
    if (!slack) throw new Error('Slack configuration missing');
    if (!slack.webhookUrl) throw new Error('Slack webhook URL is required');

    const res = await fetch(slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Slack error ${res.status}: ${body}`);
    }
}

module.exports = { sendSlack };
