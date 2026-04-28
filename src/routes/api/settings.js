const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { scheduleRetention } = require('../../services/retention');
const { isEncrypted } = require('../../services/encryption');
const settingsRepo = require('../../repositories/settings');
const providersRepo = require('../../repositories/providers');

const router = express.Router();

const VALID_START_MODES = ['collapsed', 'expanded'];

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const s = await settingsRepo.get();
        res.json({
            retentionDays: s.retentionDays ?? 90,
            templateGroupStartMode: s.templateGroupStartMode ?? 'collapsed',
            publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { retentionDays, templateGroupStartMode } = req.body || {};
        const update = {};
        if (retentionDays !== undefined) {
            const d = parseInt(retentionDays);
            if (isNaN(d) || d < 1) return res.status(400).json({ error: 'retentionDays must be a positive integer' });
            update.retentionDays = d;
        }
        if (templateGroupStartMode !== undefined) {
            if (!VALID_START_MODES.includes(templateGroupStartMode)) return res.status(400).json({ error: 'Invalid templateGroupStartMode' });
            update.templateGroupStartMode = templateGroupStartMode;
        }

        await settingsRepo.upsert(update);
        if (update.retentionDays) scheduleRetention(update.retentionDays);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/encryption-status', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const providers = await providersRepo.findAll();
        let encrypted = 0;
        let total = 0;
        const sensitiveFields = { smtp: ['password'], msgraph: ['clientSecret'], telegram: ['botToken'], pushover: ['apiToken'] };
        providers.forEach(p => {
            const fields = sensitiveFields[p.type] || [];
            fields.forEach(f => {
                const val = p[p.type]?.[f];
                if (val) {
                    total++;
                    if (isEncrypted(val)) encrypted++;
                }
            });
        });
        res.json({ total, encrypted, unencrypted: total - encrypted, keyConfigured: !!process.env.ENCRYPTION_KEY });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
