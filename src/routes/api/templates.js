const express = require('express');
const logger = require('../../utils/logger');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { render, extractTokens } = require('../../services/templateEngine');
const { getCatalogueEntry } = require('../../services/sourceCatalogue');
const repo = require('../../repositories/templates');
const sourcesRepo = require('../../repositories/sources');

const router = express.Router();

function sanitise(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        name: doc.name,
        sourceId: doc.sourceId ? doc.sourceId.toString() : null,
        subject: doc.subject || '',
        bodyHtml: doc.bodyHtml || '',
        bodyPlain: doc.bodyPlain || '',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// GET /api/templates
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        res.json((await repo.findAll()).map(sanitise));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, sourceId, subject, bodyHtml, bodyPlain } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });
        if (!bodyHtml && !bodyPlain) return res.status(400).json({ error: 'At least one body (HTML or plain text) is required' });

        const now = new Date();
        const doc = {
            name,
            sourceId: sourceId || null,
            subject: subject || '',
            bodyHtml: bodyHtml || '',
            bodyPlain: bodyPlain || '',
            createdAt: now,
            updatedAt: now,
        };

        const created = await repo.create(doc);
        logger.info(`Template created: ${name}`);
        res.status(201).json(sanitise(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/templates/:id
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Template not found' });
        res.json(sanitise(doc));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/templates/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, sourceId, subject, bodyHtml, bodyPlain } = req.body || {};
        const update = { updatedAt: new Date() };
        if (name !== undefined) update.name = name;
        if (sourceId !== undefined) update.sourceId = sourceId || null;
        if (subject !== undefined) update.subject = subject;
        if (bodyHtml !== undefined) update.bodyHtml = bodyHtml;
        if (bodyPlain !== undefined) update.bodyPlain = bodyPlain;

        const matched = await repo.update(req.params.id, update);
        if (!matched) return res.status(404).json({ error: 'Template not found' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/templates/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (await repo.isUsedByRule(req.params.id)) {
            return res.status(409).json({ error: 'Template is in use by one or more rules' });
        }
        const deleted = await repo.remove(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Template not found' });
        logger.info(`Template deleted: ${req.params.id}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates/:id/duplicate
router.post('/:id/duplicate', requireAuth, requireAdmin, async (req, res) => {
    try {
        const src = await repo.findById(req.params.id);
        if (!src) return res.status(404).json({ error: 'Template not found' });

        const now = new Date();
        const doc = {
            name: `${src.name} (copy)`,
            sourceId: src.sourceId,
            subject: src.subject,
            bodyHtml: src.bodyHtml,
            bodyPlain: src.bodyPlain,
            createdAt: now,
            updatedAt: now,
        };
        const created = await repo.create(doc);
        logger.info(`Template duplicated: ${src.name}`);
        res.status(201).json(sanitise(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates/:id/preview
router.post('/:id/preview', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Template not found' });

        const payload = req.body || {};
        const subject = render(doc.subject, payload);
        const bodyHtml = render(doc.bodyHtml, payload);
        const bodyPlain = render(doc.bodyPlain, payload);
        const tokens = [...new Set([...extractTokens(doc.subject), ...extractTokens(doc.bodyHtml), ...extractTokens(doc.bodyPlain)])];
        res.json({ subject, bodyHtml, bodyPlain, tokens });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates/preview (unsaved)
router.post('/preview', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { subject, bodyHtml, bodyPlain, payload } = req.body || {};
        if (!bodyHtml && !bodyPlain) return res.status(400).json({ error: 'At least one body is required' });

        const p = payload || {};
        const tokens = [...new Set([...extractTokens(subject || ''), ...extractTokens(bodyHtml || ''), ...extractTokens(bodyPlain || '')])];
        res.json({ subject: render(subject || '', p), bodyHtml: render(bodyHtml || '', p), bodyPlain: render(bodyPlain || '', p), tokens });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/templates/token-hints/:sourceId
router.get('/token-hints/:sourceId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const source = await sourcesRepo.findById(req.params.sourceId);
        if (!source) return res.status(404).json({ error: 'Source not found' });

        const entry = getCatalogueEntry(source.catalogueId);
        const isCustom = source.catalogueId === 'custom';
        const learnedPaths = source.learnedTokenPaths || [];
        res.json({
            eventTypePaths: source.eventTypePaths || [],
            knownEvents: entry?.knownEvents || [],
            sampleTokenPaths: isCustom ? learnedPaths.sort() : (entry?.sampleTokenPaths || []),
            eventTokenMap: entry?.eventTokenMap || null,
            learned: isCustom,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
