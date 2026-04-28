const express = require('express');
const logger = require('../../utils/logger');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const repo = require('../../repositories/groups');
const rulesRepo = require('../../repositories/rules');

const router = express.Router();

function sanitise(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        name: doc.name,
        description: doc.description || '',
        active: doc.active !== false,
        matchMode: doc.matchMode || 'all',
        order: doc.order ?? 0,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// GET /api/groups
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        res.json((await repo.findAll()).map(sanitise));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/groups
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, description, active, matchMode } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const now = new Date();
        const doc = {
            name,
            description: description || '',
            active: active !== false,
            matchMode: ['all', 'first'].includes(matchMode) ? matchMode : 'all',
            order: (await repo.findMaxOrder()) + 1,
            createdAt: now,
            updatedAt: now,
        };

        const created = await repo.create(doc);
        logger.info(`Group created: ${name}`);
        res.status(201).json(sanitise(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/groups/:id
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Group not found' });
        res.json(sanitise(doc));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/groups/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, description, active, matchMode } = req.body || {};
        const update = { updatedAt: new Date() };
        if (name !== undefined) update.name = name;
        if (description !== undefined) update.description = description;
        if (active !== undefined) update.active = active;
        if (matchMode !== undefined) {
            if (!['all', 'first'].includes(matchMode)) return res.status(400).json({ error: 'matchMode must be "all" or "first"' });
            update.matchMode = matchMode;
        }

        const matched = await repo.update(req.params.id, update);
        if (!matched) return res.status(404).json({ error: 'Group not found' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/groups/:id
// Query param: ?deleteRules=true to cascade-delete all rules in the group
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const deleteRules = req.query.deleteRules === 'true';
        const ruleCount = await rulesRepo.countByGroup(req.params.id);

        if (ruleCount > 0 && !deleteRules) {
            return res.status(409).json({ error: `Group has ${ruleCount} rule${ruleCount !== 1 ? 's' : ''} — pass ?deleteRules=true to delete them along with the group` });
        }

        if (deleteRules) await rulesRepo.removeByGroup(req.params.id);

        const deleted = await repo.remove(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Group not found' });
        logger.info(`Group deleted: ${req.params.id}${deleteRules && ruleCount > 0 ? ` (${ruleCount} rules also deleted)` : ''}`);
        res.json({ ok: true, rulesDeleted: deleteRules ? ruleCount : 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/groups/reorder
router.post('/reorder', requireAuth, requireAdmin, async (req, res) => {
    try {
        const items = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array of { id, order }' });
        await Promise.all(items.map(({ id, order }) =>
            repo.update(id, { order, updatedAt: new Date() })
        ));
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/groups/:id/toggle
router.post('/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Group not found' });
        const active = !doc.active;
        await repo.update(req.params.id, { active, updatedAt: new Date() });
        res.json({ ok: true, active });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
