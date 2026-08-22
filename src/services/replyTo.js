const { render } = require('./templateEngine');
const logger = require('../utils/logger');

// A deliberately loose check — nodemailer and Graph both do their own strict
// parsing. This only needs to catch the common failure: an unresolved
// {{token}} left in place because the payload had no such field.
const ADDRESS_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

// Renders a reply-to template against the payload and returns a clean
// comma-separated address string, or null if nothing usable resolved.
//
// Never throws: a malformed reply-to must not cost the notification. An
// unresolved token would otherwise reach nodemailer as the literal
// "{{user.email}}" and fail the entire send.
function resolveReplyTo(template, payload) {
    if (!template || typeof template !== 'string') return null;

    let rendered;
    try {
        rendered = render(template, payload);
    } catch (err) {
        logger.warn(`Reply-to render failed for "${template}": ${err.message}`);
        return null;
    }

    const valid = [];
    for (const part of rendered.split(',')) {
        const addr = part.trim();
        if (!addr) continue;
        if (ADDRESS_RE.test(addr)) valid.push(addr);
        else logger.warn(`Reply-to discarded invalid address: "${addr}"`);
    }

    return valid.length ? valid.join(', ') : null;
}

module.exports = { resolveReplyTo, ADDRESS_RE };
