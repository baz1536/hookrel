const express = require('express');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { getCatalogueEntries, getCatalogueEntry } = require('../../services/sourceCatalogue');
const { extractTokenPaths, getEventType } = require('../../services/payloadParser');
const repo = require('../../repositories/sources');
const rulesRepo = require('../../repositories/rules');

const router = express.Router();

function generateSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function sanitise(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        catalogueId: doc.catalogueId,
        eventTypePaths: doc.eventTypePaths,
        learnedTokenCount: Array.isArray(doc.learnedTokenPaths) ? doc.learnedTokenPaths.length : 0,
        learnedTokenPaths: doc.catalogueId === 'custom' ? (doc.learnedTokenPaths || []) : undefined,
        token: doc.token,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// GET /api/sources/catalogue
router.get('/catalogue', requireAuth, requireAdmin, (_req, res) => {
    res.json(getCatalogueEntries());
});

// GET /api/sources
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        res.json((await repo.findAll()).map(sanitise));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sources
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, catalogueId } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });

        if (await repo.findByName(name)) return res.status(409).json({ error: 'A source with that name already exists' });

        const catalogue = getCatalogueEntry(catalogueId || 'custom');
        const baseSlug = generateSlug(name);
        let slug = baseSlug;
        let counter = 1;
        while (await repo.countBySlug(slug)) {
            slug = `${baseSlug}-${counter++}`;
        }

        const now = new Date();
        const doc = {
            name, slug,
            catalogueId: catalogue.id,
            eventTypePaths: catalogue.eventTypePaths,
            learnedTokenPaths: [],
            token: generateToken(),
            createdAt: now,
            updatedAt: now,
        };

        const created = await repo.create(doc);
        logger.info(`Source created: ${name} (${slug})`);
        res.status(201).json(sanitise(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sources/:id
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Source not found' });
        res.json(sanitise(doc));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/sources/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, eventTypePaths } = req.body || {};
        const update = { updatedAt: new Date() };
        if (name) {
            if (await repo.findByNameExcluding(name, req.params.id)) {
                return res.status(409).json({ error: 'A source with that name already exists' });
            }
            update.name = name;
        }
        if (Array.isArray(eventTypePaths)) update.eventTypePaths = eventTypePaths;

        const matched = await repo.update(req.params.id, update);
        if (!matched) return res.status(404).json({ error: 'Source not found' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/sources/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (await rulesRepo.isSourceInUse(req.params.id)) {
            return res.status(409).json({ error: 'Source is in use by one or more rules' });
        }
        const deleted = await repo.remove(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Source not found' });
        logger.info(`Source deleted: ${req.params.id}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sources/:id/rotate-token
router.post('/:id/rotate-token', requireAuth, requireAdmin, async (req, res) => {
    try {
        const token = generateToken();
        const matched = await repo.update(req.params.id, { token, updatedAt: new Date() });
        if (!matched) return res.status(404).json({ error: 'Source not found' });
        logger.info(`Token rotated for source: ${req.params.id}`);
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sources/:id/parse-payload
router.post('/:id/parse-payload', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Source not found' });

        const payload = req.body;
        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ error: 'Request body must be a JSON object' });
        }

        const tokens = extractTokenPaths(payload);
        const eventType = getEventType(payload, doc.eventTypePaths || []);
        res.json({ eventType, tokens });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
