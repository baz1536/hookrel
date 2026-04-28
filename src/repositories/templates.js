const { getDB } = require('../services/db');
const { ObjectId } = require('mongodb');
const { nanoid } = require('../utils/nanoid');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

function fromRow(r) {
    if (!r) return null;
    return {
        _id: r.id,
        name: r.name,
        sourceId: r.sourceId || null,
        subject: r.subject || '',
        bodyHtml: r.bodyHtml || r.body || '',
        bodyPlain: r.bodyPlain || '',
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
    };
}

async function findAll() {
    if (isMongo()) {
        return getDB().collection('templates').find({}).sort({ name: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM templates ORDER BY name ASC').all().map(fromRow);
}

async function findById(id) {
    if (isMongo()) {
        return getDB().collection('templates').findOne({ _id: new ObjectId(id) });
    }
    return fromRow(getDB().prepare('SELECT * FROM templates WHERE id = ?').get(id));
}

async function create(doc) {
    if (isMongo()) {
        const result = await getDB().collection('templates').insertOne(doc);
        return { ...doc, _id: result.insertedId };
    }
    const id = nanoid();
    getDB().prepare(`
        INSERT INTO templates (id, name, sourceId, subject, bodyHtml, bodyPlain, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, doc.name, doc.sourceId || null,
        doc.subject || '', doc.bodyHtml || '', doc.bodyPlain || '',
        doc.createdAt.toISOString(), doc.updatedAt.toISOString());
    return { ...doc, _id: id };
}

async function update(id, fields) {
    if (isMongo()) {
        const result = await getDB().collection('templates').updateOne(
            { _id: new ObjectId(id) },
            { $set: fields }
        );
        return result.matchedCount;
    }
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
        if (k === 'updatedAt' || k === 'createdAt') { sets.push(`${k} = ?`); vals.push(v.toISOString()); }
        else { sets.push(`${k} = ?`); vals.push(v == null ? null : v); }
    }
    vals.push(id);
    const result = getDB().prepare(`UPDATE templates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return result.changes;
}

async function remove(id) {
    if (isMongo()) {
        const result = await getDB().collection('templates').deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount;
    }
    return getDB().prepare('DELETE FROM templates WHERE id = ?').run(id).changes;
}

async function isUsedByRule(id) {
    if (isMongo()) {
        return !!(await getDB().collection('rules').findOne({ templateId: new ObjectId(id) }));
    }
    return !!getDB().prepare('SELECT 1 FROM rules WHERE templateId = ? LIMIT 1').get(id);
}

async function count() {
    if (isMongo()) return getDB().collection('templates').countDocuments();
    return getDB().prepare('SELECT COUNT(*) as n FROM templates').get().n;
}

module.exports = { findAll, findById, create, update, remove, isUsedByRule, count };
