const express = require('express');
const logger = require('../../utils/logger');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const {
    findUserByUsername, findUserById, listUsers,
    createUser, updateUser, deleteUser,
    verifyPassword, isFirstLaunch,
} = require('../../services/users');

const router = express.Router();

// GET /api/auth/setup-required — is this a first launch?
router.get('/setup-required', async (req, res) => {
    try {
        res.json({ required: await isFirstLaunch() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/setup — create first admin (only works when no users exist)
router.post('/setup', async (req, res) => {
    try {
        if (!(await isFirstLaunch())) {
            return res.status(403).json({ error: 'Setup already complete' });
        }
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        await createUser(username, password, 'admin');
        logger.info(`First admin account created: ${username}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        if (await isFirstLaunch()) {
            return res.status(403).json({ error: 'Setup required', setupRequired: true });
        }
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = await findUserByUsername(username);
        if (!user || !(await verifyPassword(user, password))) {
            logger.warn(`Failed login attempt for user: ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.user = { id: user._id.toString(), username: user.username, role: user.role };
        logger.info(`User logged in: ${username} (${user.role})`);
        res.json({ ok: true, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    const { AUTH_ENABLED } = require('../../middleware/auth');
    if (!AUTH_ENABLED) return res.json({ username: 'admin', role: 'admin', openAccess: true });
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorised' });
    res.json({ username: req.session.user.username, role: req.session.user.role });
});

// ── User management (admin only) ──

// GET /api/auth/users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        res.json(await listUsers());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/users
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or user' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (await findUserByUsername(username)) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        const id = await createUser(username, password, role);
        logger.info(`User created: ${username} (${role}) by ${req.session.user.username}`);
        res.status(201).json({ ok: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/users/:id
router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { password, role, username } = req.body || {};
        // Prevent removing last admin
        if (role === 'user') {
            const all = await listUsers();
            const admins = all.filter(u => u.role === 'admin' && u._id.toString() !== req.params.id);
            if (admins.length === 0) {
                return res.status(400).json({ error: 'Cannot demote the last admin' });
            }
        }
        await updateUser(req.params.id, { password, role, username });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Prevent deleting self
        if (req.params.id === req.session.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        // Prevent deleting last admin
        const all = await listUsers();
        const target = all.find(u => u._id.toString() === req.params.id);
        if (target?.role === 'admin') {
            const admins = all.filter(u => u.role === 'admin');
            if (admins.length <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last admin' });
            }
        }
        await deleteUser(req.params.id);
        logger.info(`User deleted: ${req.params.id} by ${req.session.user.username}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/change-password (own password)
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        const user = await findUserById(req.session.user.id);
        if (!user || !(await verifyPassword(user, currentPassword))) {
            return res.status(401).json({ error: 'Current password incorrect' });
        }
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }
        await updateUser(req.session.user.id, { password: newPassword });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
