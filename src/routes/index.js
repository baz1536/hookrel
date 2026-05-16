const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const sourcesRoutes = require('./api/sources');
const providersRoutes = require('./api/providers');
const templatesRoutes = require('./api/templates');
const rulesRoutes = require('./api/rules');
const groupsRoutes = require('./api/groups');
const logsRoutes = require('./api/logs');
const dashboardRoutes = require('./api/dashboard');
const settingsRoutes = require('./api/settings');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

router.get('/about', async (_req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
        const isDevelopment = process.env.NODE_ENV !== 'production';

        const response = {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            isDevelopment,
        };

        if (isDevelopment) {
            let lockVersions = {};
            try {
                const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package-lock.json'), 'utf8'));
                for (const [key, val] of Object.entries(lock.packages || {})) {
                    if (key.startsWith('node_modules/') && !key.slice(13).includes('/')) {
                        lockVersions[key.slice(13)] = val.version;
                    }
                }
            } catch {}

            function resolvedVersions(deps) {
                const result = {};
                for (const name of Object.keys(deps || {})) {
                    if (lockVersions[name]) {
                        result[name] = lockVersions[name];
                    } else {
                        try {
                            const depPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../node_modules', name, 'package.json'), 'utf8'));
                            result[name] = depPkg.version;
                        } catch {
                            result[name] = deps[name];
                        }
                    }
                }
                return result;
            }

            let npmVersion = 'Unknown';
            try { npmVersion = `v${execSync('npm --version').toString().trim()}`; } catch {}

            let gitBranch = null;
            try { gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); } catch {}

            const platform = os.platform();
            let osName = 'Unknown';
            if (platform === 'win32') osName = 'Windows';
            else if (platform === 'darwin') osName = 'macOS';
            else if (platform === 'linux') osName = 'Linux';

            let distro = null;
            try {
                if (fs.existsSync('/etc/os-release')) {
                    const m = fs.readFileSync('/etc/os-release', 'utf8').match(/PRETTY_NAME="([^"]+)"/);
                    if (m) distro = m[1];
                }
            } catch {}

            const ipAddresses = [];
            for (const nets of Object.values(os.networkInterfaces())) {
                for (const net of nets) {
                    if (!net.internal && net.family === 'IPv4') ipAddresses.push(net.address);
                }
            }

            const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3551;

            response.nodeVersion = process.version;
            response.npmVersion = npmVersion;
            response.gitBranch = gitBranch;
            response.dependencies = resolvedVersions(pkg.dependencies);
            response.environment = {
                os: osName,
                distro,
                architecture: os.arch(),
                isDocker: fs.existsSync('/.dockerenv'),
                hostname: os.hostname(),
                port,
                ipAddresses,
                dbType: (process.env.DB_TYPE || 'sqlite').toLowerCase(),
            };
        }

        res.json(response);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/themes', (_req, res) => {
    res.json([
        { id: '',         name: 'Default (Purple)' },
        { id: 'blue',     name: 'Blue' },
        { id: 'teal',     name: 'Teal' },
        { id: 'green',    name: 'Green' },
        { id: 'orange',   name: 'Orange' },
        { id: 'red',      name: 'Red' },
        { id: 'rose',     name: 'Rose' },
        { id: 'amber',    name: 'Amber' },
        { id: 'slate',    name: 'Slate' },
        { id: 'midnight', name: 'Midnight' },
        { id: 'light',    name: 'Light' },
    ]);
});

router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/sources', sourcesRoutes);
router.use('/providers', providersRoutes);
router.use('/templates', templatesRoutes);
router.use('/groups', groupsRoutes);
router.use('/rules', rulesRoutes);
router.use('/logs', logsRoutes);

module.exports = router;
