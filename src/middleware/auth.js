const session = require('express-session');

const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false';

function buildSessionStore() {
    const type = (process.env.DB_TYPE || 'sqlite').toLowerCase();

    if (type === 'mongodb') {
        const { MongoStore } = require('connect-mongo');
        const { getClient } = require('../services/db');
        return MongoStore.create({
            client: getClient(),
            collectionName: 'sessions',
            ttl: 60 * 60 * 24 * 7,
        });
    }

    // SQLite session store
    const BetterSqlite3Store = require('../services/sessionStore');
    return new BetterSqlite3Store({ ttl: 60 * 60 * 24 * 7 });
}

function setupSession(app) {
    const secret = process.env.SESSION_SECRET || 'hookrel-dev-secret-change-in-production';

    app.use(session({
        secret,
        resave: false,
        saveUninitialized: false,
        store: buildSessionStore(),
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    }));
}

function requireAuth(req, res, next) {
    if (!AUTH_ENABLED) return next();
    if (req.session?.user) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorised' });
    return res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
    if (!AUTH_ENABLED) return next();
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorised' });
    if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
}

module.exports = { setupSession, requireAuth, requireAdmin, AUTH_ENABLED };
