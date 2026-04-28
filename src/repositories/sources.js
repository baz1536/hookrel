const { getDB } = require('../services/db');
const { ObjectId } = require('mongodb');
const { nanoid } = require('../utils/nanoid');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

function fromRow(r) {
    if (!r) return null;
    return {
        _id: r.id,
        name: r.name,
        slug: r.slug,
        catalogueId: r.catalogueId,
        eventTypePaths: JSON.parse(r.eventTypePaths || '[]'),
        learnedTokenPaths: JSON.parse(r.learnedTokenPaths || '[]'),
        token: r.token,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
    };
}

async function findAll() {
    if (isMongo()) {
        return getDB().collection('sources').find({}).sort({ name: 1 }).toArray();
    }
    return getDB().prepare('SELECT * FROM sources ORDER BY name ASC').all().map(fromRow);
}

async function findById(id) {
    if (isMongo()) {
        return getDB().collection('sources').findOne({ _id: new ObjectId(id) });
    }
    return fromRow(getDB().prepare('SELECT * FROM sources WHERE id = ?').get(id));
}

async function findBySlug(slug) {
    if (isMongo()) {
        return getDB().collection('sources').findOne({ slug });
    }
    return fromRow(getDB().prepare('SELECT * FROM sources WHERE slug = ?').get(slug));
}

async function findByName(name) {
    if (isMongo()) {
        return getDB().collection('sources').findOne({ name });
    }
    return fromRow(getDB().prepare('SELECT * FROM sources WHERE name = ?').get(name));
}

async function findByNameExcluding(name, excludeId) {
    if (isMongo()) {
        return getDB().collection('sources').findOne({ name, _id: { $ne: new ObjectId(excludeId) } });
    }
    return fromRow(getDB().prepare('SELECT * FROM sources WHERE name = ? AND id != ?').get(name, excludeId));
}

async function countBySlug(slug) {
    if (isMongo()) {
        return getDB().collection('sources').countDocuments({ slug });
    }
    return getDB().prepare('SELECT COUNT(*) as n FROM sources WHERE slug = ?').get(slug).n;
}

async function create(doc) {
    if (isMongo()) {
        const result = await getDB().collection('sources').insertOne(doc);
        return { ...doc, _id: result.insertedId };
    }
    const id = nanoid();
    getDB().prepare(`
        INSERT INTO sources (id, name, slug, catalogueId, eventTypePaths, learnedTokenPaths, token, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, doc.name, doc.slug, doc.catalogueId,
        JSON.stringify(doc.eventTypePaths || []),
        JSON.stringify(doc.learnedTokenPaths || []),
        doc.token,
        doc.createdAt.toISOString(), doc.updatedAt.toISOString());
    return { ...doc, _id: id };
}

async function update(id, fields) {
    if (isMongo()) {
        const result = await getDB().collection('sources').updateOne(
            { _id: new ObjectId(id) },
            { $set: fields }
        );
        return result.matchedCount;
    }
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
        if (k === 'updatedAt') { sets.push('updatedAt = ?'); vals.push(v.toISOString()); }
        else if (k === 'eventTypePaths' || k === 'learnedTokenPaths') { sets.push(`${k} = ?`); vals.push(JSON.stringify(v)); }
        else { sets.push(`${k} = ?`); vals.push(v); }
    }
    vals.push(id);
    const result = getDB().prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return result.changes;
}

async function addLearnedTokenPaths(id, paths) {
    if (isMongo()) {
        return getDB().collection('sources').updateOne(
            { _id: id },
            { $addToSet: { learnedTokenPaths: { $each: paths } } }
        );
    }
    const source = fromRow(getDB().prepare('SELECT learnedTokenPaths FROM sources WHERE id = ?').get(id.toString()));
    if (!source) return;
    const existing = new Set(source.learnedTokenPaths);
    paths.forEach(p => existing.add(p));
    getDB().prepare('UPDATE sources SET learnedTokenPaths = ? WHERE id = ?')
        .run(JSON.stringify([...existing]), id.toString());
}

async function remove(id) {
    if (isMongo()) {
        const result = await getDB().collection('sources').deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount;
    }
    return getDB().prepare('DELETE FROM sources WHERE id = ?').run(id).changes;
}

async function count() {
    if (isMongo()) return getDB().collection('sources').countDocuments();
    return getDB().prepare('SELECT COUNT(*) as n FROM sources').get().n;
}

module.exports = { findAll, findById, findBySlug, findByName, findByNameExcluding, countBySlug, create, update, addLearnedTokenPaths, remove, count };
