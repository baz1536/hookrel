const { getDB } = require('../services/db');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

const SETTINGS_ID = 'global';
const DEFAULTS = { retentionDays: 90, templateGroupStartMode: 'collapsed' };

function fromRow(r) {
    if (!r) return null;
    return { _id: r.id, retentionDays: r.retentionDays, templateGroupStartMode: r.templateGroupStartMode ?? 'collapsed' };
}

async function get() {
    if (isMongo()) {
        return (await getDB().collection('settings').findOne({ _id: SETTINGS_ID })) || { _id: SETTINGS_ID, ...DEFAULTS };
    }
    const row = getDB().prepare('SELECT * FROM settings WHERE id = ?').get(SETTINGS_ID);
    return fromRow(row) || { _id: SETTINGS_ID, ...DEFAULTS };
}

async function upsert(fields) {
    if (isMongo()) {
        return getDB().collection('settings').updateOne(
            { _id: SETTINGS_ID },
            { $set: fields },
            { upsert: true }
        );
    }
    const existing = getDB().prepare('SELECT id FROM settings WHERE id = ?').get(SETTINGS_ID);
    if (existing) {
        const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        getDB().prepare(`UPDATE settings SET ${sets} WHERE id = ?`).run(...Object.values(fields), SETTINGS_ID);
    } else {
        const merged = { ...DEFAULTS, ...fields };
        getDB().prepare(`INSERT INTO settings (id, retentionDays, templateGroupStartMode) VALUES (?, ?, ?)`)
            .run(SETTINGS_ID, merged.retentionDays, merged.templateGroupStartMode);
    }
}

async function findForRetention() {
    if (isMongo()) {
        return getDB().collection('settings').findOne({ _id: 'global' });
    }
    return fromRow(getDB().prepare('SELECT * FROM settings WHERE id = ?').get(SETTINGS_ID));
}

module.exports = { get, upsert, findForRetention };
