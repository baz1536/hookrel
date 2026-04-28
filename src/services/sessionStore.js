const { Store } = require('express-session');
const { getDB } = require('./db');

// Minimal express-session store backed by SQLite (better-sqlite3)
class SqliteSessionStore extends Store {
    constructor({ ttl = 86400 } = {}) {
        super();
        this.ttl = ttl;
        this._ensureTable();
        // Prune expired sessions every 15 minutes
        setInterval(() => this._prune(), 15 * 60 * 1000).unref();
    }

    _ensureTable() {
        getDB().exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid     TEXT PRIMARY KEY,
                data    TEXT NOT NULL,
                expires INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
        `);
    }

    _prune() {
        try {
            getDB().prepare('DELETE FROM sessions WHERE expires <= ?').run(Math.floor(Date.now() / 1000));
        } catch {}
    }

    get(sid, cb) {
        try {
            const row = getDB().prepare('SELECT data, expires FROM sessions WHERE sid = ?').get(sid);
            if (!row) return cb(null, null);
            if (row.expires <= Math.floor(Date.now() / 1000)) {
                this.destroy(sid, () => {});
                return cb(null, null);
            }
            cb(null, JSON.parse(row.data));
        } catch (err) {
            cb(err);
        }
    }

    set(sid, session, cb) {
        try {
            const expires = Math.floor(Date.now() / 1000) + this.ttl;
            const data = JSON.stringify(session);
            getDB().prepare(`
                INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
                ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires
            `).run(sid, data, expires);
            cb(null);
        } catch (err) {
            cb(err);
        }
    }

    destroy(sid, cb) {
        try {
            getDB().prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
            cb(null);
        } catch (err) {
            cb(err);
        }
    }

    touch(sid, session, cb) {
        try {
            const expires = Math.floor(Date.now() / 1000) + this.ttl;
            getDB().prepare('UPDATE sessions SET expires = ? WHERE sid = ?').run(expires, sid);
            cb(null);
        } catch (err) {
            cb(err);
        }
    }
}

module.exports = SqliteSessionStore;
