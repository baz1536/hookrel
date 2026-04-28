// Extracts a dot-notation path from a nested object, e.g. "series.title"
// Supports array index notation: episodes[0].title
// Returns undefined if the path doesn't exist
function resolvePath(obj, path) {
    if (obj === null || obj === undefined) return undefined;
    // Normalise episodes[0].title → episodes.0.title
    const normalised = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalised.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

// Flattens a nested object into dot-notation token paths, e.g. { "series.title": "Breaking Bad" }
function extractTokenPaths(obj, prefix = '', result = {}) {
    if (obj === null || obj === undefined) return result;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
        result[prefix] = obj;
        return result;
    }
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            extractTokenPaths(value, path, result);
        } else {
            result[path] = value;
        }
    }
    return result;
}

// Derives a string event type from a payload using a list of candidate paths (checked in order)
// Falls back to 'unknown' if none resolve to a non-null primitive
function getEventType(payload, eventTypePaths = []) {
    for (const path of eventTypePaths) {
        const val = resolvePath(payload, path);
        if (val !== null && val !== undefined && typeof val !== 'object') return String(val);
    }
    return 'unknown';
}

module.exports = { resolvePath, extractTokenPaths, getEventType };
