const { resolvePath } = require('./payloadParser');

// Token syntax: {{token.path}} or {{token.path | fallback text}}
// Supports array index notation: episodes[0].title
const TOKEN_RE = /\{\{\s*([\w.[\]]+)\s*(?:\|\s*((?:[^}]|\}(?!\}))*?)\s*)?\}\}/g;

// Renders a template string against a payload object.
// Unresolved tokens use their fallback if provided, otherwise are left as-is.
function renderOnce(template, payload) {
    return template.replace(TOKEN_RE, (match, path, fallback) => {
        const value = resolvePath(payload, path);
        if (value === undefined || value === null) {
            return fallback !== undefined ? fallback : match;
        }
        return String(value);
    });
}

function render(template, payload) {
    if (!template || !payload) return template || '';
    // Two passes so tokens embedded in fallback text (e.g. {{a | {{b}}}}) resolve correctly
    return renderOnce(renderOnce(template, payload), payload);
}

// Returns all unique token paths referenced in a template string
function extractTokens(template) {
    const tokens = new Set();
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(template)) !== null) {
        tokens.add(m[1]);
    }
    return [...tokens];
}

module.exports = { render, extractTokens };
