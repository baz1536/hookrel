const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const logsRepo = require('../../repositories/logs');

const router = express.Router();
const PAGE_SIZE = 50;

// ── System logs ───────────────────────────────────────────────────────────────

router.get('/system', requireAuth, requireAdmin, async (req, res) => {
    try {
        const logsDir = process.env.LOG_DIR || path.join(__dirname, '../../../logs');
        const date = req.query.date || todayStr();
        const level = req.query.level || '';
        const search = (req.query.search || '').toLowerCase();
        const page = Math.max(1, parseInt(req.query.page) || 1);

        const logFile = path.join(logsDir, `app-${date}.log`);
        if (!fs.existsSync(logFile)) {
            return res.json({ entries: [], total: 0, page, pages: 0, date });
        }

        const entries = await readJsonl(logFile, { level, search });
        entries.reverse();
        const total = entries.length;
        const pages = Math.ceil(total / PAGE_SIZE);
        const slice = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        res.json({ entries: slice, total, page, pages, date });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/system/dates', requireAuth, requireAdmin, (_req, res) => {
    try {
        const logsDir = process.env.LOG_DIR || path.join(__dirname, '../../../logs');
        if (!fs.existsSync(logsDir)) return res.json([]);
        const files = fs.readdirSync(logsDir)
            .filter(f => f.match(/^app-\d{4}-\d{2}-\d{2}\.log$/))
            .map(f => f.replace(/^app-/, '').replace(/\.log$/, ''))
            .sort().reverse();
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Inbound logs ──────────────────────────────────────────────────────────────

router.get('/inbound', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { sourceId, eventType, status, page: p } = req.query;
        const page = Math.max(1, parseInt(p) || 1);
        const { entries, total } = await logsRepo.findInbound(
            { sourceId, eventType, status }, page, PAGE_SIZE
        );
        res.json({
            entries: entries.map(e => ({ ...e, id: e._id.toString(), sourceId: e.sourceId?.toString() })),
            total,
            page,
            pages: Math.ceil(total / PAGE_SIZE),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/inbound/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const entry = await logsRepo.findInboundById(req.params.id);
        if (!entry) return res.status(404).json({ error: 'Log entry not found' });

        const outbound = await logsRepo.findOutboundByInboundId(req.params.id);

        res.json({
            ...entry,
            id: entry._id.toString(),
            sourceId: entry.sourceId?.toString(),
            outbound: outbound.map(o => ({
                ...o,
                id: o._id.toString(),
                inboundId: o.inboundId?.toString(),
                providerId: o.providerId?.toString(),
            })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Outbound logs ─────────────────────────────────────────────────────────────

router.get('/outbound', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { providerId, status, page: p } = req.query;
        const page = Math.max(1, parseInt(p) || 1);
        const { entries, total } = await logsRepo.findOutbound(
            { providerId, status }, page, PAGE_SIZE
        );
        res.json({
            entries: entries.map(e => ({
                ...e,
                id: e._id.toString(),
                inboundId: e.inboundId?.toString(),
                providerId: e.providerId?.toString(),
            })),
            total,
            page,
            pages: Math.ceil(total / PAGE_SIZE),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readJsonl(filePath, { level, search }) {
    return new Promise((resolve, reject) => {
        const entries = [];
        const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
        rl.on('line', line => {
            if (!line.trim()) return;
            try {
                const entry = JSON.parse(line);
                if (level && entry.level !== level) return;
                if (search && !JSON.stringify(entry).toLowerCase().includes(search)) return;
                entries.push(entry);
            } catch {}
        });
        rl.on('close', () => resolve(entries));
        rl.on('error', reject);
    });
}

function todayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

module.exports = router;
