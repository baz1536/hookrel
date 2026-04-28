const { getDB } = require('../services/db');
const { ObjectId } = require('mongodb');
const { nanoid } = require('../utils/nanoid');
const isMongo = () => (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'mongodb';

function inboundFromRow(r) {
    if (!r) return null;
    return {
        _id: r.id,
        sourceId: r.sourceId || null,
        sourceName: r.sourceName || '',
        slug: r.slug || '',
        eventType: r.eventType || '',
        payload: JSON.parse(r.payload || '{}'),
        tokens: JSON.parse(r.tokens || '{}'),
        receivedAt: new Date(r.receivedAt),
        dispatchStatus: r.dispatchStatus || 'pending',
    };
}

function outboundFromRow(r) {
    if (!r) return null;
    return {
        _id: r.id,
        inboundId: r.inboundId || null,
        ruleId: r.ruleId || null,
        ruleName: r.ruleName || '',
        providerId: r.providerId || null,
        providerName: r.providerName || '',
        status: r.status || 'pending',
        error: r.error || null,
        sentAt: new Date(r.sentAt),
    };
}

// ── Inbound ───────────────────────────────────────────────────────────────────

async function createInbound(doc) {
    if (isMongo()) {
        const result = await getDB().collection('inbound_logs').insertOne(doc);
        return result.insertedId;
    }
    const id = nanoid();
    getDB().prepare(`
        INSERT INTO inbound_logs (id, sourceId, sourceName, slug, eventType, payload, tokens, receivedAt, dispatchStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id,
        doc.sourceId ? doc.sourceId.toString() : null,
        doc.sourceName || '', doc.slug || '', doc.eventType || '',
        JSON.stringify(doc.payload || {}),
        JSON.stringify(doc.tokens || {}),
        doc.receivedAt.toISOString(),
        doc.dispatchStatus || 'pending');
    return id;
}

async function updateInboundStatus(id, status) {
    if (isMongo()) {
        return getDB().collection('inbound_logs').updateOne(
            { _id: id },
            { $set: { dispatchStatus: status } }
        );
    }
    getDB().prepare('UPDATE inbound_logs SET dispatchStatus = ? WHERE id = ?').run(status, id.toString());
}

async function findInbound(filter, page, pageSize) {
    if (isMongo()) {
        const mFilter = {};
        if (filter.sourceId) mFilter.sourceId = new ObjectId(filter.sourceId);
        if (filter.eventType) mFilter.eventType = filter.eventType;
        if (filter.status) mFilter.dispatchStatus = filter.status;
        const total = await getDB().collection('inbound_logs').countDocuments(mFilter);
        const entries = await getDB().collection('inbound_logs')
            .find(mFilter, { projection: { payload: 0, tokens: 0 } })
            .sort({ receivedAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray();
        return { entries, total };
    }
    const wheres = [];
    const vals = [];
    if (filter.sourceId) { wheres.push('sourceId = ?'); vals.push(filter.sourceId); }
    if (filter.eventType) { wheres.push('eventType = ?'); vals.push(filter.eventType); }
    if (filter.status) { wheres.push('dispatchStatus = ?'); vals.push(filter.status); }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const total = getDB().prepare(`SELECT COUNT(*) as n FROM inbound_logs ${where}`).get(...vals).n;
    const entries = getDB().prepare(
        `SELECT id, sourceId, sourceName, slug, eventType, receivedAt, dispatchStatus FROM inbound_logs ${where} ORDER BY receivedAt DESC LIMIT ? OFFSET ?`
    ).all(...vals, pageSize, (page - 1) * pageSize).map(inboundFromRow);
    return { entries, total };
}

async function findInboundById(id) {
    if (isMongo()) {
        return getDB().collection('inbound_logs').findOne({ _id: new ObjectId(id) });
    }
    return inboundFromRow(getDB().prepare('SELECT * FROM inbound_logs WHERE id = ?').get(id));
}

async function findRecentInbound(limit) {
    if (isMongo()) {
        return getDB().collection('inbound_logs')
            .find({}, { projection: { payload: 0, tokens: 0 } })
            .sort({ receivedAt: -1 })
            .limit(limit)
            .toArray();
    }
    return getDB().prepare(
        'SELECT id, sourceId, sourceName, slug, eventType, receivedAt, dispatchStatus FROM inbound_logs ORDER BY receivedAt DESC LIMIT ?'
    ).all(limit).map(inboundFromRow);
}

async function countInboundSince(since) {
    if (isMongo()) return getDB().collection('inbound_logs').countDocuments({ receivedAt: { $gte: since } });
    return getDB().prepare('SELECT COUNT(*) as n FROM inbound_logs WHERE receivedAt >= ?').get(since.toISOString()).n;
}

async function countInboundTotal() {
    if (isMongo()) return getDB().collection('inbound_logs').countDocuments();
    return getDB().prepare('SELECT COUNT(*) as n FROM inbound_logs').get().n;
}

async function inboundStatusBreakdown(since) {
    if (isMongo()) {
        return getDB().collection('inbound_logs').aggregate([
            { $match: { receivedAt: { $gte: since } } },
            { $group: { _id: '$dispatchStatus', count: { $sum: 1 } } },
        ]).toArray();
    }
    return getDB().prepare(
        'SELECT dispatchStatus as _id, COUNT(*) as count FROM inbound_logs WHERE receivedAt >= ? GROUP BY dispatchStatus'
    ).all(since.toISOString());
}

async function inboundDailyTrend(days) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (isMongo()) {
        const rows = await getDB().collection('inbound_logs').aggregate([
            { $match: { receivedAt: { $gte: since } } },
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$receivedAt' } },
                count: { $sum: 1 },
            }},
            { $sort: { _id: 1 } },
        ]).toArray();
        return rows.map(r => ({ date: r._id, count: r.count }));
    }
    const rows = getDB().prepare(
        `SELECT strftime('%Y-%m-%d', receivedAt) as date, COUNT(*) as count
         FROM inbound_logs WHERE receivedAt >= ?
         GROUP BY date ORDER BY date ASC`
    ).all(since.toISOString());
    return rows;
}

async function inboundEventTypeBreakdown(since) {
    if (isMongo()) {
        const rows = await getDB().collection('inbound_logs').aggregate([
            { $match: { receivedAt: { $gte: since } } },
            { $group: { _id: '$eventType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 },
        ]).toArray();
        return rows.map(r => ({ eventType: r._id || 'unknown', count: r.count }));
    }
    return getDB().prepare(
        `SELECT eventType, COUNT(*) as count FROM inbound_logs WHERE receivedAt >= ?
         GROUP BY eventType ORDER BY count DESC LIMIT 8`
    ).all(since.toISOString());
}

async function deleteInboundBefore(cutoff) {
    if (isMongo()) {
        return getDB().collection('inbound_logs').deleteMany({ receivedAt: { $lt: cutoff } });
    }
    return { deletedCount: getDB().prepare('DELETE FROM inbound_logs WHERE receivedAt < ?').run(cutoff.toISOString()).changes };
}

// ── Outbound ──────────────────────────────────────────────────────────────────

async function createOutbound(doc) {
    if (isMongo()) {
        const result = await getDB().collection('outbound_logs').insertOne(doc);
        return result.insertedId;
    }
    const id = nanoid();
    getDB().prepare(`
        INSERT INTO outbound_logs (id, inboundId, ruleId, ruleName, providerId, providerName, status, error, sentAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id,
        doc.inboundId ? doc.inboundId.toString() : null,
        doc.ruleId ? doc.ruleId.toString() : null,
        doc.ruleName || '',
        doc.providerId ? doc.providerId.toString() : null,
        doc.providerName || '',
        doc.status || 'pending',
        doc.error || null,
        doc.sentAt.toISOString());
    return id;
}

async function findOutboundByInboundId(inboundId) {
    if (isMongo()) {
        return getDB().collection('outbound_logs')
            .find({ inboundId: new ObjectId(inboundId) })
            .sort({ sentAt: 1 })
            .toArray();
    }
    return getDB().prepare('SELECT * FROM outbound_logs WHERE inboundId = ? ORDER BY sentAt ASC')
        .all(inboundId.toString()).map(outboundFromRow);
}

async function findOutbound(filter, page, pageSize) {
    if (isMongo()) {
        const mFilter = {};
        if (filter.providerId) mFilter.providerId = new ObjectId(filter.providerId);
        if (filter.status) mFilter.status = filter.status;
        const total = await getDB().collection('outbound_logs').countDocuments(mFilter);
        const entries = await getDB().collection('outbound_logs')
            .find(mFilter)
            .sort({ sentAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray();
        return { entries, total };
    }
    const wheres = [];
    const vals = [];
    if (filter.providerId) { wheres.push('providerId = ?'); vals.push(filter.providerId); }
    if (filter.status) { wheres.push('status = ?'); vals.push(filter.status); }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const total = getDB().prepare(`SELECT COUNT(*) as n FROM outbound_logs ${where}`).get(...vals).n;
    const entries = getDB().prepare(
        `SELECT * FROM outbound_logs ${where} ORDER BY sentAt DESC LIMIT ? OFFSET ?`
    ).all(...vals, pageSize, (page - 1) * pageSize).map(outboundFromRow);
    return { entries, total };
}

async function countOutboundSince(since) {
    if (isMongo()) return getDB().collection('outbound_logs').countDocuments({ sentAt: { $gte: since } });
    return getDB().prepare('SELECT COUNT(*) as n FROM outbound_logs WHERE sentAt >= ?').get(since.toISOString()).n;
}

async function countOutboundErrorsSince(since) {
    if (isMongo()) return getDB().collection('outbound_logs').countDocuments({ sentAt: { $gte: since }, status: 'error' });
    return getDB().prepare("SELECT COUNT(*) as n FROM outbound_logs WHERE sentAt >= ? AND status = 'error'").get(since.toISOString()).n;
}

async function deleteOutboundBefore(cutoff) {
    if (isMongo()) {
        return getDB().collection('outbound_logs').deleteMany({ sentAt: { $lt: cutoff } });
    }
    return { deletedCount: getDB().prepare('DELETE FROM outbound_logs WHERE sentAt < ?').run(cutoff.toISOString()).changes };
}

module.exports = {
    createInbound, updateInboundStatus, findInbound, findInboundById,
    findRecentInbound, countInboundSince, countInboundTotal,
    inboundStatusBreakdown, inboundDailyTrend, inboundEventTypeBreakdown, deleteInboundBefore,
    createOutbound, findOutboundByInboundId, findOutbound,
    countOutboundSince, countOutboundErrorsSince, deleteOutboundBefore,
};
