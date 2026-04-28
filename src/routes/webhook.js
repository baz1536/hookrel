const express = require('express');
const multer = require('multer');
const { getEventType, extractTokenPaths } = require('../services/payloadParser');
const { findMatchingRules } = require('../services/ruleEngine');
const { dispatch } = require('../services/notifier');
const sourcesRepo = require('../repositories/sources');
const logsRepo = require('../repositories/logs');
const logger = require('../utils/logger');

const router = express.Router();

// Multer for Plex multipart/form-data — store nothing to disk, just parse fields
const upload = multer({ storage: multer.memoryStorage() });

// Resolve the request body: JSON (standard) or multipart payload field (Plex)
function resolveBody(req, files, fields) {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('multipart/form-data')) {
        const payloadField = fields && fields.payload;
        if (!payloadField) return null;
        try {
            return JSON.parse(payloadField);
        } catch {
            return null;
        }
    }
    return req.body || null;
}

router.post('/:slug', upload.any(), async (req, res) => {
    const { slug } = req.params;

    const source = await sourcesRepo.findBySlug(slug).catch(() => null);
    if (!source) return res.status(404).json({ error: 'Unknown webhook source' });

    const authHeader = req.headers['authorization'] || '';
    const apiKey = req.headers['x-api-key'] || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const provided = bearer || apiKey || (req.query.token || '');

    if (provided !== source.token) {
        logger.warn(`Webhook auth failed for source: ${slug}`);
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Build field map from multer for multipart requests
    const fields = {};
    if (req.body && typeof req.body === 'object') {
        Object.assign(fields, req.body);
    }

    const payload = resolveBody(req, req.files, fields);
    if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const eventType = getEventType(payload, source.eventTypePaths || []);
    const tokens = extractTokenPaths(payload);
    const receivedAt = new Date();

    let inboundId;
    try {
        inboundId = await logsRepo.createInbound({
            sourceId: source._id,
            sourceName: source.name,
            slug,
            eventType,
            payload,
            tokens,
            receivedAt,
            dispatchStatus: 'pending',
        });
    } catch (err) {
        logger.error(`Failed to write inbound log for ${slug}: ${err.message}`);
        return res.status(500).json({ error: 'Failed to record webhook' });
    }

    logger.info(`Webhook received: ${slug} / ${eventType}`);
    res.status(202).json({ ok: true, eventType, inboundId });

    setImmediate(async () => {
        try {
            // Learn token paths for custom sources
            if (source.catalogueId === 'custom') {
                const newPaths = Object.keys(tokens);
                if (newPaths.length > 0) {
                    sourcesRepo.addLearnedTokenPaths(source._id, newPaths)
                        .catch(err => logger.warn(`Failed to learn token paths for ${slug}: ${err.message}`));
                }
            }

            const rules = await findMatchingRules(source._id, eventType, tokens);
            if (rules.length === 0) {
                await logsRepo.updateInboundStatus(inboundId, 'no_rules');
                logger.info(`No matching rules for ${slug} / ${eventType}`);
                return;
            }
            logger.info(`Dispatching ${slug} / ${eventType} to ${rules.length} rule(s)`);
            await dispatch(inboundId, rules, payload);
        } catch (err) {
            logger.error(`Dispatch error for ${inboundId}: ${err.message}`);
            await logsRepo.updateInboundStatus(inboundId, 'error').catch(() => {});
        }
    });
});

module.exports = router;
