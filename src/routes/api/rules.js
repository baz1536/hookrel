const express = require('express');
const logger = require('../../utils/logger');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { findMatchingRules } = require('../../services/ruleEngine');
const repo = require('../../repositories/rules');
const groupsRepo = require('../../repositories/groups');
const providersRepo = require('../../repositories/providers');
const templatesRepo = require('../../repositories/templates');

const router = express.Router();

const VALID_OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'];

function sanitiseConditions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(c => c && typeof c.field === 'string' && c.field.trim() && VALID_OPERATORS.includes(c.operator))
        .map(c => ({ field: c.field.trim(), operator: c.operator, value: String(c.value ?? '') }));
}

function sanitise(doc) {
    if (!doc) return null;
    // Normalise providerIds — may come from repo (already array) or raw mongo doc
    let providerIds = doc.providerIds || [];
    if (!Array.isArray(providerIds)) providerIds = [providerIds].filter(Boolean);
    // Back-compat: if mongo doc still has legacy providerId field
    if (providerIds.length === 0 && doc.providerId) providerIds = [doc.providerId.toString()];
    return {
        id: doc._id.toString(),
        name: doc.name,
        active: doc.active !== false,
        groupId: doc.groupId || '',
        sourceId: doc.sourceId ? doc.sourceId.toString() : null,
        eventType: doc.eventType || '*',
        conditions: doc.conditions || [],
        conditionMode: doc.conditionMode || 'and',
        providerIds: providerIds.map(String),
        templateId: doc.templateId ? doc.templateId.toString() : null,
        order: doc.order ?? 0,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// GET /api/rules/in-use?sourceId=X | ?providerId=X | ?templateId=X
router.get('/in-use', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { sourceId, providerId, templateId } = req.query;
        let inUse = false;
        if (sourceId)   inUse = await repo.isSourceInUse(sourceId);
        if (providerId) inUse = await repo.isProviderInUse(providerId);
        if (templateId) inUse = await templatesRepo.isUsedByRule(templateId);
        res.json({ inUse });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/rules
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        res.json((await repo.findAll()).map(sanitise));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/rules
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, groupId, sourceId, eventType, conditions, conditionMode, providerIds, templateId, active } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });
        if (!groupId) return res.status(400).json({ error: 'Group is required' });
        if (!Array.isArray(providerIds) || providerIds.length === 0) return res.status(400).json({ error: 'At least one provider is required' });

        if (!(await groupsRepo.findById(groupId))) return res.status(400).json({ error: 'Group not found' });
        for (const pid of providerIds) {
            if (!(await providersRepo.findById(pid))) return res.status(400).json({ error: `Provider not found: ${pid}` });
        }
        if (templateId && !(await templatesRepo.findById(templateId))) return res.status(400).json({ error: 'Template not found' });

        const now = new Date();
        const doc = {
            name,
            active: active !== false,
            groupId,
            sourceId: sourceId || null,
            eventType: eventType || '*',
            conditions: sanitiseConditions(conditions),
            conditionMode: conditionMode === 'or' ? 'or' : 'and',
            providerIds,
            templateId: templateId || null,
            order: (await repo.findMaxOrderInGroup(groupId)) + 1,
            createdAt: now,
            updatedAt: now,
        };

        const created = await repo.create(doc);
        logger.info(`Rule created: ${name}`);
        res.status(201).json(sanitise(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/rules/:id
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Rule not found' });
        res.json(sanitise(doc));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/rules/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, groupId, sourceId, eventType, conditions, conditionMode, providerIds, templateId, active } = req.body || {};
        const update = { updatedAt: new Date() };
        if (name !== undefined) update.name = name;
        if (active !== undefined) update.active = active;
        if (groupId !== undefined) {
            if (!(await groupsRepo.findById(groupId))) return res.status(400).json({ error: 'Group not found' });
            update.groupId = groupId;
        }
        if (eventType !== undefined) update.eventType = eventType;
        if (sourceId !== undefined) update.sourceId = sourceId || null;
        if (providerIds !== undefined) {
            if (!Array.isArray(providerIds) || providerIds.length === 0) return res.status(400).json({ error: 'At least one provider is required' });
            update.providerIds = providerIds;
        }
        if (templateId !== undefined) update.templateId = templateId || null;
        if (conditions !== undefined) update.conditions = sanitiseConditions(conditions);
        if (conditionMode !== undefined) update.conditionMode = conditionMode === 'or' ? 'or' : 'and';

        const matched = await repo.update(req.params.id, update);
        if (!matched) return res.status(404).json({ error: 'Rule not found' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/rules/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Rule not found' });
        logger.info(`Rule deleted: ${req.params.id}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/rules/reorder
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

// POST /api/rules/:id/toggle
router.post('/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Rule not found' });
        const active = !doc.active;
        await repo.update(req.params.id, { active, updatedAt: new Date() });
        res.json({ ok: true, active });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/rules/dry-run
router.post('/dry-run', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { sourceId, eventType, tokens } = req.body || {};
        if (!sourceId) return res.status(400).json({ error: 'sourceId is required' });

        const matched = await findMatchingRules(sourceId, eventType || 'unknown', tokens || {});

        const enriched = await Promise.all(matched.map(async rule => {
            const ids = Array.isArray(rule.providerIds) ? rule.providerIds : [];
            const providers = await Promise.all(ids.map(id => providersRepo.findById(id.toString())));
            const template = rule.templateId ? await templatesRepo.findById(rule.templateId.toString()) : null;
            const group = rule.groupId ? await groupsRepo.findById(rule.groupId) : null;
            return {
                id: rule._id.toString(),
                name: rule.name,
                groupName: group?.name || '(no group)',
                order: rule.order,
                providerNames: providers.map(p => p ? `${p.name} (${p.type})` : '(deleted)'),
                templateName: template?.name || '(none)',
            };
        }));

        res.json({ matched: enriched.length, rules: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
