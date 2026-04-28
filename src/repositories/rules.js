const { getDB } = require('../services/db');
const { ObjectId } = require('mongodb');
const { nanoid } = require('../utils/nanoid');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

function fromRow(r) {
    if (!r) return null;
    // Normalise providerIds: stored as JSON array; fall back to legacy providerId column
    let providerIds = [];
    if (r.providerIds) {
        providerIds = typeof r.providerIds === 'string' ? JSON.parse(r.providerIds) : (r.providerIds || []);
    } else if (r.providerId) {
        providerIds = [r.providerId];
    }
    return {
        _id: r.id,
        name: r.name,
        active: r.active === 1 || r.active === true,
        groupId: r.groupId || '',
        sourceId: r.sourceId || null,
        eventType: r.eventType || '*',
        conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : (r.conditions || []),
        conditionMode: r.conditionMode || 'and',
        providerIds,
        templateId: r.templateId || null,
        order: r.order ?? 0,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
    };
}

async function findAll() {
    if (isMongo()) {
        return getDB().collection('rules').find({}).sort({ order: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM rules ORDER BY `order` ASC').all().map(fromRow);
}

async function findAllActive() {
    if (isMongo()) {
        return getDB().collection('rules').find({ active: true }).sort({ order: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM rules WHERE active = 1 ORDER BY `order` ASC').all().map(fromRow);
}

async function findByGroup(groupId) {
    if (isMongo()) {
        return getDB().collection('rules').find({ groupId }).sort({ order: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM rules WHERE groupId = ? ORDER BY `order` ASC').all(groupId).map(fromRow);
}

async function findById(id) {
    if (isMongo()) {
        return getDB().collection('rules').findOne({ _id: new ObjectId(id) });
    }
    return fromRow(getDB().prepare('SELECT * FROM rules WHERE id = ?').get(id));
}

async function findMaxOrderInGroup(groupId) {
    if (isMongo()) {
        const last = await getDB().collection('rules').findOne({ groupId }, { sort: { order: -1 } });
        return last?.order ?? -1;
    }
    const row = getDB().prepare('SELECT MAX(`order`) as m FROM rules WHERE groupId = ?').get(groupId);
    return row.m ?? -1;
}

async function isProviderInUse(providerId) {
    const idStr = providerId.toString();
    if (isMongo()) {
        return !!(await getDB().collection('rules').findOne({ providerIds: idStr }));
    }
    // Use JSON contains pattern with quotes to avoid substring false-positives
    return !!getDB().prepare(`SELECT 1 FROM rules WHERE providerIds LIKE ? OR providerId = ? LIMIT 1`).get(`%"${idStr}"%`, idStr);
}

async function isSourceInUse(sourceId) {
    const idStr = sourceId.toString();
    if (isMongo()) {
        return !!(await getDB().collection('rules').findOne({ sourceId: idStr }));
    }
    return !!getDB().prepare(`SELECT 1 FROM rules WHERE sourceId = ? LIMIT 1`).get(idStr);
}

async function create(doc) {
    if (isMongo()) {
        const result = await getDB().collection('rules').insertOne(doc);
        return { ...doc, _id: result.insertedId };
    }
    const id = nanoid();
    getDB().prepare(`
        INSERT INTO rules (id, name, active, groupId, sourceId, eventType, conditions, conditionMode, providerIds, templateId, \`order\`, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, doc.name, doc.active !== false ? 1 : 0,
        doc.groupId || '',
        doc.sourceId ? doc.sourceId.toString() : null,
        doc.eventType || '*',
        JSON.stringify(doc.conditions || []),
        doc.conditionMode || 'and',
        JSON.stringify(doc.providerIds || []),
        doc.templateId ? doc.templateId.toString() : null,
        doc.order ?? 0,
        doc.createdAt.toISOString(), doc.updatedAt.toISOString());
    return { ...doc, _id: id };
}

async function update(id, fields) {
    if (isMongo()) {
        const result = await getDB().collection('rules').updateOne(
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
        else if (k === 'conditions') { sets.push('conditions = ?'); vals.push(JSON.stringify(v)); }
        else if (k === 'providerIds') { sets.push('providerIds = ?'); vals.push(JSON.stringify(v)); }
        else if (k === 'sourceId' || k === 'templateId') {
            sets.push(`${k} = ?`);
            vals.push(v ? v.toString() : null);
        }
        else { sets.push(`${k} = ?`); vals.push(v == null ? null : v); }
    }
    vals.push(id);
    const result = getDB().prepare(`UPDATE rules SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return result.changes;
}

async function remove(id) {
    if (isMongo()) {
        const result = await getDB().collection('rules').deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount;
    }
    return getDB().prepare('DELETE FROM rules WHERE id = ?').run(id).changes;
}

async function removeByGroup(groupId) {
    if (isMongo()) {
        const result = await getDB().collection('rules').deleteMany({ groupId });
        return result.deletedCount;
    }
    return getDB().prepare('DELETE FROM rules WHERE groupId = ?').run(groupId).changes;
}

async function countByGroup(groupId) {
    if (isMongo()) return getDB().collection('rules').countDocuments({ groupId });
    return getDB().prepare('SELECT COUNT(*) as n FROM rules WHERE groupId = ?').get(groupId).n;
}

async function count() {
    if (isMongo()) return getDB().collection('rules').countDocuments({ active: true });
    return getDB().prepare('SELECT COUNT(*) as n FROM rules WHERE active = 1').get().n;
}

module.exports = { findAll, findAllActive, findByGroup, findById, findMaxOrderInGroup, isProviderInUse, isSourceInUse, create, update, remove, removeByGroup, countByGroup, count };
