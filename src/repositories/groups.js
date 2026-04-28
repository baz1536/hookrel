const { getDB } = require('../services/db');
const { ObjectId } = require('mongodb');
const { nanoid } = require('../utils/nanoid');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

function fromRow(r) {
    if (!r) return null;
    return {
        _id: r.id,
        name: r.name,
        description: r.description || '',
        active: r.active === 1 || r.active === true,
        matchMode: r.matchMode || 'all',
        order: r.order ?? 0,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
    };
}

async function findAll() {
    if (isMongo()) {
        return getDB().collection('groups').find({}).sort({ order: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM groups ORDER BY `order` ASC').all().map(fromRow);
}

async function findAllActive() {
    if (isMongo()) {
        return getDB().collection('groups').find({ active: true }).sort({ order: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM groups WHERE active = 1 ORDER BY `order` ASC').all().map(fromRow);
}

async function findById(id) {
    if (isMongo()) {
        return getDB().collection('groups').findOne({ _id: new ObjectId(id) });
    }
    return fromRow(getDB().prepare('SELECT * FROM groups WHERE id = ?').get(id));
}

async function findMaxOrder() {
    if (isMongo()) {
        const last = await getDB().collection('groups').findOne({}, { sort: { order: -1 } });
        return last?.order ?? -1;
    }
    const row = getDB().prepare('SELECT MAX(`order`) as m FROM groups').get();
    return row.m ?? -1;
}

async function create(doc) {
    if (isMongo()) {
        const result = await getDB().collection('groups').insertOne(doc);
        return { ...doc, _id: result.insertedId };
    }
    const id = nanoid();
    getDB().prepare(`
        INSERT INTO groups (id, name, description, active, matchMode, \`order\`, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, doc.name, doc.description || '', doc.active !== false ? 1 : 0,
        doc.matchMode || 'all', doc.order ?? 0,
        doc.createdAt.toISOString(), doc.updatedAt.toISOString());
    return { ...doc, _id: id };
}

async function update(id, fields) {
    if (isMongo()) {
        const result = await getDB().collection('groups').updateOne(
            { _id: new ObjectId(id) },
            { $set: fields }
        );
        return result.matchedCount;
    }
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
        if (k === 'updatedAt') { sets.push('updatedAt = ?'); vals.push(v.toISOString()); }
        else if (k === 'active') { sets.push('active = ?'); vals.push(v ? 1 : 0); }
        else if (k === 'order') { sets.push('`order` = ?'); vals.push(v); }
        else { sets.push(`${k} = ?`); vals.push(v == null ? null : v); }
    }
    vals.push(id);
    const result = getDB().prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return result.changes;
}

async function remove(id) {
    if (isMongo()) {
        const result = await getDB().collection('groups').deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount;
    }
    return getDB().prepare('DELETE FROM groups WHERE id = ?').run(id).changes;
}

async function hasRules(id) {
    if (isMongo()) {
        return !!(await getDB().collection('rules').findOne({ groupId: id }));
    }
    return !!getDB().prepare('SELECT 1 FROM rules WHERE groupId = ? LIMIT 1').get(id);
}

async function count() {
    if (isMongo()) return getDB().collection('groups').countDocuments();
    return getDB().prepare('SELECT COUNT(*) as n FROM groups').get().n;
}

module.exports = { findAll, findAllActive, findById, findMaxOrder, create, update, remove, hasRules, count };
