const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

// Bootstrap proxy support before any outbound HTTP is made.
// Reads HTTPS_PROXY / HTTP_PROXY / NO_PROXY from the environment and patches
// Node's http/https globals so all clients (fetch, nodemailer, Azure SDK) honour them.
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY ||
    process.env.https_proxy || process.env.http_proxy) {
    require('global-agent').bootstrap();
}

const logger = require('./utils/logger');
const { connect } = require('./services/db');
const { setupSession, requireAuth } = require('./middleware/auth');
const { scheduleRetention } = require('./services/retention');
const settingsRepo = require('./repositories/settings');
const authRoutes = require('./routes/api/auth');
const webhookRoutes = require('./routes/webhook');
const routes = require('./routes/index');

const app = express();
const DEFAULT_PORT = 3551;

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public static assets — always reachable before auth
app.use('/css',    express.static(path.join(__dirname, '../public/css')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/js/login.js', express.static(path.join(__dirname, '../public/js/login.js')));
app.use('/js/setup.js', express.static(path.join(__dirname, '../public/js/setup.js')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/setup.html', (req, res) => res.sendFile(path.join(__dirname, '../public/setup.html')));
app.get('/favicon.ico', (req, res) => res.redirect('/images/favicon.svg'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

async function startServer() {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
    const isDocker = fs.existsSync('/.dockerenv');

    await connect();

    // Start retention job with saved settings
    try {
        const s = await settingsRepo.findForRetention();
        if (s?.retentionDays) scheduleRetention(s.retentionDays);
    } catch {}

    // Session middleware registered after DB is ready (MongoStore needs the client)
    // Must be before ALL route handlers that touch req.session
    setupSession(app);

    // Auth routes — public (login/logout/me/setup — but still need session middleware above)
    app.use('/api/auth', authRoutes);

    // Webhook ingestion — token-authenticated, no session required
    app.use('/webhook', webhookRoutes);

    // Auth guard — everything below requires a valid session
    app.use(requireAuth);

    // Protected static (index.html, partials, js modules)
    app.use(express.static(path.join(__dirname, '../public')));
    app.get('/', (req, res) => res.redirect('/index.html'));

    // Protected API
    app.use('/api', routes);

    app.listen(port, () => {
        let npmVersion = 'Unknown';
        try { npmVersion = `v${execSync('npm --version').toString().trim()}`; } catch {}

        logger.info(`HookRel running on http://localhost:${port}`);
        console.log(`\nHookRel is running!\n`);
        console.log(`  Node:    ${process.version} / npm ${npmVersion}`);
        console.log(`  Local:   http://localhost:${port}`);

        if (!isDocker) {
            const nets = os.networkInterfaces();
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        console.log(`  Network: http://${net.address}:${port}`);
                        break;
                    }
                }
            }
        }

        if (process.env.PUBLIC_URL) console.log(`  Public:  ${process.env.PUBLIC_URL}`);
        console.log('');

        if (isDocker) logger.info('Running inside Docker container');
        logger.info(`Environment: ${os.platform()} / ${os.arch()}`);
    });
}

startServer();
