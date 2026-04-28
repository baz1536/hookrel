const { getDB } = require('../services/db');
const { ObjectId } = require('mongodb');
const { nanoid } = require('../utils/nanoid');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

function fromRow(r) {
    if (!r) return null;
    const config = JSON.parse(r.config || '{}');
    return {
        _id: r.id,
        name: r.name,
        type: r.type,
        recipients: r.recipients || '',
        cc: r.cc || '',
        bcc: r.bcc || '',
        [r.type]: config,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
    };
}

async function findAll() {
    if (isMongo()) {
        return getDB().collection('providers').find({}).sort({ name: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM providers ORDER BY name ASC').all().map(fromRow);
}

async function findById(id) {
    if (isMongo()) {
        return getDB().collection('providers').findOne({ _id: new ObjectId(id) });
    }
    return fromRow(getDB().prepare('SELECT * FROM providers WHERE id = ?').get(id));
}

async function create(doc) {
    if (isMongo()) {
        const result = await getDB().collection('providers').insertOne(doc);
        return { ...doc, _id: result.insertedId };
    }
    const id = nanoid();
    const { name, type, recipients, cc, bcc, createdAt, updatedAt } = doc;
    const config = doc[type] || {};
    getDB().prepare(`
        INSERT INTO providers (id, name, type, recipients, cc, bcc, config, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, recipients || '', cc || '', bcc || '',
        JSON.stringify(config), createdAt.toISOString(), updatedAt.toISOString());
    return { ...doc, _id: id };
}

async function update(id, fields, type) {
    if (isMongo()) {
        const result = await getDB().collection('providers').updateOne(
            { _id: new ObjectId(id) },
            { $set: fields }
        );
        return result.matchedCount;
    }
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
        if (k === 'updatedAt') { sets.push('updatedAt = ?'); vals.push(v.toISOString()); }
        else if (k === type) { sets.push('config = ?'); vals.push(JSON.stringify(v)); }
        else { sets.push(`${k} = ?`); vals.push(v); }
    }
    vals.push(id);
    const result = getDB().prepare(`UPDATE providers SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return result.changes;
}

async function remove(id) {
    if (isMongo()) {
        const result = await getDB().collection('providers').deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount;
    }
    return getDB().prepare('DELETE FROM providers WHERE id = ?').run(id).changes;
}

async function count() {
    if (isMongo()) return getDB().collection('providers').countDocuments();
    return getDB().prepare('SELECT COUNT(*) as n FROM providers').get().n;
}

module.exports = { findAll, findById, create, update, remove, count };
