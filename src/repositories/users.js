const { getDB } = require('../services/db');
const { ObjectId } = require('mongodb');
const { nanoid } = require('../utils/nanoid');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

function fromRow(r) {
    if (!r) return null;
    return {
        _id: r.id,
        username: r.username,
        passwordHash: r.passwordHash,
        role: r.role,
        theme: r.theme ?? '',
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
    };
}

async function findByUsername(username) {
    if (isMongo()) return getDB().collection('users').findOne({ username });
    return fromRow(getDB().prepare('SELECT * FROM users WHERE username = ?').get(username));
}

async function findById(id) {
    if (isMongo()) return getDB().collection('users').findOne({ _id: new ObjectId(id) });
    return fromRow(getDB().prepare('SELECT * FROM users WHERE id = ?').get(id));
}

async function listAll() {
    if (isMongo()) {
        return getDB().collection('users')
            .find({}, { projection: { passwordHash: 0 } })
            .sort({ createdAt: 1 })
            .toArray();
    }
    return getDB().prepare('SELECT id, username, role, theme, createdAt, updatedAt FROM users ORDER BY createdAt ASC')
        .all().map(r => ({ ...fromRow({ ...r, passwordHash: '' }), passwordHash: undefined }));
}

async function count() {
    if (isMongo()) return getDB().collection('users').countDocuments();
    return getDB().prepare('SELECT COUNT(*) as n FROM users').get().n;
}

async function create(username, passwordHash, role) {
    const now = new Date();
    if (isMongo()) {
        const result = await getDB().collection('users').insertOne({
            username, passwordHash, role, createdAt: now, updatedAt: now,
        });
        return result.insertedId.toString();
    }
    const id = nanoid();
    getDB().prepare(`
        INSERT INTO users (id, username, passwordHash, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, passwordHash, role, now.toISOString(), now.toISOString());
    return id;
}

async function update(id, fields) {
    if (isMongo()) {
        return getDB().collection('users').updateOne({ _id: new ObjectId(id) }, { $set: fields });
    }
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
        if (k === 'updatedAt') { sets.push('updatedAt = ?'); vals.push(v.toISOString()); }
        else { sets.push(`${k} = ?`); vals.push(v); }
    }
    vals.push(id);
    getDB().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

async function remove(id) {
    if (isMongo()) return getDB().collection('users').deleteOne({ _id: new ObjectId(id) });
    getDB().prepare('DELETE FROM users WHERE id = ?').run(id);
}

module.exports = { findByUsername, findById, listAll, count, create, update, remove };
