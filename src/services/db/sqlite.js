const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger');

let db;

function connect() {
    const dbPath = process.env.DB_PATH || './data/hookrel.db';
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    db = new Database(resolved);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    createTables();
    migrate();
    logger.info(`SQLite connected — ${resolved}`);
}

function createTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            username    TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            role        TEXT NOT NULL DEFAULT 'user',
            createdAt   TEXT NOT NULL,
            updatedAt   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sources (
            id               TEXT PRIMARY KEY,
            name             TEXT UNIQUE NOT NULL,
            slug             TEXT UNIQUE NOT NULL,
            catalogueId      TEXT NOT NULL DEFAULT 'custom',
            eventTypePaths   TEXT NOT NULL DEFAULT '[]',
            learnedTokenPaths TEXT NOT NULL DEFAULT '[]',
            token            TEXT NOT NULL,
            createdAt        TEXT NOT NULL,
            updatedAt        TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS providers (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            type        TEXT NOT NULL,
            recipients  TEXT NOT NULL DEFAULT '',
            cc          TEXT NOT NULL DEFAULT '',
            bcc         TEXT NOT NULL DEFAULT '',
            config      TEXT NOT NULL DEFAULT '{}',
            createdAt   TEXT NOT NULL,
            updatedAt   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS templates (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            sourceId    TEXT,
            subject     TEXT NOT NULL DEFAULT '',
            bodyHtml    TEXT NOT NULL DEFAULT '',
            bodyPlain   TEXT NOT NULL DEFAULT '',
            createdAt   TEXT NOT NULL,
            updatedAt   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS groups (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            active      INTEGER NOT NULL DEFAULT 1,
            matchMode   TEXT NOT NULL DEFAULT 'all',
            \`order\`   INTEGER NOT NULL DEFAULT 0,
            createdAt   TEXT NOT NULL,
            updatedAt   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rules (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            active      INTEGER NOT NULL DEFAULT 1,
            groupId     TEXT NOT NULL DEFAULT '',
            sourceId    TEXT,
            eventType   TEXT NOT NULL DEFAULT '*',
            conditions  TEXT NOT NULL DEFAULT '[]',
            conditionMode TEXT NOT NULL DEFAULT 'and',
            providerId  TEXT,
            providerIds TEXT NOT NULL DEFAULT '[]',
            templateId  TEXT,
            \`order\`   INTEGER NOT NULL DEFAULT 0,
            createdAt   TEXT NOT NULL,
            updatedAt   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inbound_logs (
            id             TEXT PRIMARY KEY,
            sourceId       TEXT,
            sourceName     TEXT,
            slug           TEXT,
            eventType      TEXT,
            payload        TEXT NOT NULL DEFAULT '{}',
            tokens         TEXT NOT NULL DEFAULT '{}',
            receivedAt     TEXT NOT NULL,
            dispatchStatus TEXT NOT NULL DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS outbound_logs (
            id         TEXT PRIMARY KEY,
            inboundId  TEXT,
            ruleId     TEXT,
            ruleName   TEXT,
            providerId TEXT,
            providerName TEXT,
            status     TEXT NOT NULL DEFAULT 'pending',
            error      TEXT,
            sentAt     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            id           TEXT PRIMARY KEY,
            retentionDays INTEGER NOT NULL DEFAULT 90,
            templateGroupStartMode TEXT NOT NULL DEFAULT 'collapsed'
        );

        CREATE INDEX IF NOT EXISTS idx_sources_slug        ON sources(slug);
        CREATE INDEX IF NOT EXISTS idx_groups_order        ON groups(\`order\`);
        CREATE INDEX IF NOT EXISTS idx_rules_groupid       ON rules(groupId);
        CREATE INDEX IF NOT EXISTS idx_rules_order         ON rules(\`order\`);
        CREATE INDEX IF NOT EXISTS idx_inbound_sourceid    ON inbound_logs(sourceId, receivedAt);
        CREATE INDEX IF NOT EXISTS idx_inbound_receivedat  ON inbound_logs(receivedAt);
        CREATE INDEX IF NOT EXISTS idx_outbound_providerid ON outbound_logs(providerId, sentAt);
        CREATE INDEX IF NOT EXISTS idx_outbound_sentat     ON outbound_logs(sentAt);
    `);
}

function migrate() {
    // Add templateGroupStartMode to existing settings tables
    const settingsCols = db.prepare(`PRAGMA table_info(settings)`).all().map(c => c.name);
    if (!settingsCols.includes('templateGroupStartMode')) {
        db.exec(`ALTER TABLE settings ADD COLUMN templateGroupStartMode TEXT NOT NULL DEFAULT 'collapsed'`);
    }

    // Add providerIds column to existing DBs that only have providerId
    const cols = db.prepare(`PRAGMA table_info(rules)`).all().map(c => c.name);
    if (!cols.includes('providerIds')) {
        db.exec(`ALTER TABLE rules ADD COLUMN providerIds TEXT NOT NULL DEFAULT '[]'`);
        // Migrate existing single providerId values into providerIds array
        const rows = db.prepare(`SELECT id, providerId FROM rules WHERE providerId IS NOT NULL AND providerId != ''`).all();
        const stmt = db.prepare(`UPDATE rules SET providerIds = ? WHERE id = ?`);
        for (const row of rows) {
            stmt.run(JSON.stringify([row.providerId]), row.id);
        }
        logger.info(`Migrated ${rows.length} rules to providerIds array`);
    }
}

function getDB() {
    if (!db) throw new Error('Database not initialised');
    return db;
}

// SQLite has no separate client concept — return db for session store compatibility
function getClient() {
    return null;
}

function close() {
    if (db) db.close();
}

module.exports = { connect, getDB, getClient, close };
