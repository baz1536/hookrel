const express = require('express');
const logger = require('../../utils/logger');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { encrypt, isEncrypted } = require('../../services/encryption');
const { sendToProvider } = require('../../services/notifier');
const repo = require('../../repositories/providers');
const rulesRepo = require('../../repositories/rules');

const router = express.Router();

const SENSITIVE = {
    smtp:     ['password'],
    msgraph:  ['clientSecret'],
    telegram: ['botToken'],
    pushover: ['apiToken'],
    gotify:   ['appToken'],
    ntfy:     ['token'],
};

const { PLAIN_ONLY_TYPES } = require('../../constants/providerTypes');

function maskProvider(doc) {
    if (!doc) return null;
    const out = {
        id: doc._id.toString(),
        name: doc.name,
        type: doc.type,
        supportsHtml: !PLAIN_ONLY_TYPES.includes(doc.type),
        recipients: doc.recipients,
        cc: doc.cc,
        bcc: doc.bcc,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
    const block = doc[doc.type];
    if (block) {
        out[doc.type] = { ...block };
        for (const field of (SENSITIVE[doc.type] || [])) {
            if (out[doc.type][field]) out[doc.type][field] = '********';
        }
    }
    return out;
}

function encryptSensitiveFields(type, incoming, existing) {
    const fields = SENSITIVE[type] || [];
    const result = { ...incoming };
    for (const field of fields) {
        const val = result[field];
        if (!val || val === '********') {
            result[field] = existing?.[field] ?? result[field];
        } else if (!isEncrypted(val)) {
            result[field] = encrypt(val);
        }
    }
    return result;
}

const TYPE_LABELS = {
    smtp: 'SMTP (Email)', msgraph: 'Microsoft Graph (Email)',
    telegram: 'Telegram', pushover: 'Pushover',
    discord: 'Discord', slack: 'Slack',
    gotify: 'Gotify', ntfy: 'ntfy', teams: 'Microsoft Teams',
};

function buildTestMessage(name, type, sentAt, locale) {
    const label = TYPE_LABELS[type] || type;
    const now = sentAt ? new Date(sentAt) : new Date();
    const loc = locale || 'en-GB';
    const ts = `${now.toLocaleDateString(loc)} ${now.toLocaleTimeString(loc)}`;
    const subject = `HookRel — Test Notification`;

    if (type === 'smtp' || type === 'msgraph') {
        const body = `
<h2 style="margin:0 0 16px">HookRel Test Notification</h2>
<p>Your provider is configured correctly and ready to deliver notifications.</p>
<table style="border-collapse:collapse;margin-top:16px;font-size:14px">
  <tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap">Provider</td><td><strong>${name}</strong></td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap">Type</td><td>${label}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap">Sent at</td><td>${ts}</td></tr>
</table>`;
        return { subject, body };
    }

    const body = `HookRel — Test Notification\n\nYour provider is configured correctly and ready to deliver notifications.\n\nProvider: ${name}\nType: ${label}\nSent at: ${ts}`;
    return { subject, body };
}

// GET /api/providers
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        res.json((await repo.findAll()).map(maskProvider));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/providers
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, type, recipients, cc, bcc } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const VALID_TYPES = ['smtp', 'msgraph', 'telegram', 'pushover', 'discord', 'slack', 'gotify', 'ntfy', 'teams'];
        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({ error: `Invalid provider type: ${type}` });
        }

        const typeBlock = req.body[type] || {};
        const encrypted = encryptSensitiveFields(type, typeBlock, null);

        const now = new Date();
        const doc = {
            name, type,
            recipients: recipients || '',
            cc: cc || '',
            bcc: bcc || '',
            [type]: encrypted,
            createdAt: now,
            updatedAt: now,
        };

        const created = await repo.create(doc);
        logger.info(`Provider created: ${name} (${type})`);
        res.status(201).json(maskProvider(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/providers/:id
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Provider not found' });
        res.json(maskProvider(doc));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/providers/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const existing = await repo.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Provider not found' });

        const { name, type, recipients, cc, bcc } = req.body || {};
        const resolvedType = type || existing.type;

        if (type && type !== existing.type) {
            return res.status(400).json({ error: 'Cannot change provider type — delete and recreate instead' });
        }

        const typeBlock = req.body[resolvedType] || {};
        const encrypted = encryptSensitiveFields(resolvedType, typeBlock, existing[resolvedType]);

        const update = { updatedAt: new Date(), [resolvedType]: encrypted };
        if (name) update.name = name;
        if (recipients !== undefined) update.recipients = recipients;
        if (cc !== undefined) update.cc = cc;
        if (bcc !== undefined) update.bcc = bcc;

        await repo.update(req.params.id, update, resolvedType);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/providers/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (await rulesRepo.isProviderInUse(req.params.id)) {
            return res.status(409).json({ error: 'Provider is in use by one or more rules' });
        }
        const deleted = await repo.remove(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Provider not found' });
        logger.info(`Provider deleted: ${req.params.id}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/providers/:id/test
router.post('/:id/test', requireAuth, requireAdmin, async (req, res) => {
    try {
        const doc = await repo.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Provider not found' });
        const { sentAt, locale } = req.body || {};
        const { subject, body } = buildTestMessage(doc.name, doc.type, sentAt, locale);
        await sendToProvider(doc, subject, body);
        logger.info(`Test notification sent via provider: ${doc.name}`);
        res.json({ ok: true });
    } catch (err) {
        logger.warn(`Test notification failed for provider ${req.params.id}: ${err.message}`);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/providers/test (unsaved or existing with form values)
router.post('/test', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id, name, type, recipients, cc, bcc, sentAt, locale } = req.body || {};
        if (!type) return res.status(400).json({ error: 'Type is required' });
        // If editing an existing provider, load stored doc to fill in any masked secret fields
        const existing = id ? await repo.findById(id) : null;
        const rawBlock = req.body[type] || {};
        const typeBlock = encryptSensitiveFields(type, rawBlock, existing?.[type]);
        const doc = { name: name || 'Unsaved Provider', type, recipients, cc, bcc, [type]: typeBlock };
        const { subject, body } = buildTestMessage(doc.name, type, sentAt, locale);
        await sendToProvider(doc, subject, body);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
