const { resolvePath } = require('./payloadParser');

// Token syntax: {{token.path}} or {{token.path | fallback text}}
// Supports array index notation: episodes[0].title
const TOKEN_RE = /\{\{\s*([\w.[\]]+)\s*(?:\|\s*((?:[^}]|\}(?!\}))*?)\s*)?\}\}/g;

// Block syntax: {{#each path}}...{{/each}}
// Inside the block, use {{item}} for primitive values or {{item.field}} for objects.
const EACH_RE = /\{\{#each\s+([\w.[\]]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;

function renderEach(template, payload) {
    return template.replace(EACH_RE, (_match, path, body) => {
        const arr = resolvePath(payload, path);
        if (!Array.isArray(arr) || arr.length === 0) return '';
        return arr.map(item => {
            return body.replace(/\{\{\s*item(\.[\w.[\]]+)?\s*\}\}/g, (_m, sub) => {
                if (!sub) return item !== null && item !== undefined ? String(item) : '';
                const val = resolvePath(item, sub.slice(1));
                return val !== null && val !== undefined ? String(val) : '';
            });
        }).join('').replace(/\n$/, '');
    });
}

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
    // Resolve #each blocks first, then two token passes for nested fallback resolution
    const afterEach = renderEach(template, payload);
    return renderOnce(renderOnce(afterEach, payload), payload);
}

// Returns all unique token paths referenced in a template string
function extractTokens(template) {
    const tokens = new Set();
    // Extract paths from #each blocks
    let m;
    const eachCopy = template.replace(EACH_RE, (_match, path) => { tokens.add(path); return ''; });
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(eachCopy)) !== null) {
        tokens.add(m[1]);
    }
    return [...tokens];
}

module.exports = { render, extractTokens };
