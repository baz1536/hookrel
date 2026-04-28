const { MongoClient } = require('mongodb');
const logger = require('../../utils/logger');

let client;
let db;

async function connect() {
    const uri  = process.env.DB_PATH;
    if (!uri) throw new Error('DB_PATH must be set for DB_TYPE=mongodb (e.g. mongodb://user:pass@host:27017/hookrel)');

    // Extract db name from URI path component, fall back to 'hookrel'
    let dbName = 'hookrel';
    try {
        const u = new URL(uri);
        const p = u.pathname.replace(/^\//, '');
        if (p) dbName = p;
    } catch {}

    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);

    logger.info(`MongoDB connected — database: ${dbName}`);
    await ensureIndexes();
    logger.info('MongoDB indexes verified');
}

async function ensureIndexes() {
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('sources').createIndex({ slug: 1 }, { unique: true });
    await db.collection('providers').createIndex({ name: 1 });
    await db.collection('templates').createIndex({ sourceId: 1 });
    await db.collection('groups').createIndex({ order: 1 });
    await db.collection('rules').createIndex({ groupId: 1, order: 1 });
    await db.collection('inbound_logs').createIndex({ sourceId: 1, receivedAt: -1 });
    await db.collection('inbound_logs').createIndex({ receivedAt: -1 });
    await db.collection('outbound_logs').createIndex({ providerId: 1, sentAt: -1 });
    await db.collection('outbound_logs').createIndex({ sentAt: -1 });
}

function getDB() {
    if (!db) throw new Error('Database not initialised');
    return db;
}

function getClient() {
    if (!client) throw new Error('Database not initialised');
    return client;
}

async function close() {
    if (client) await client.close();
}

module.exports = { connect, getDB, getClient, close };
