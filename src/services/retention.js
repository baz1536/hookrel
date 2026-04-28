const fs = require('fs');
const path = require('path');
const logsRepo = require('../repositories/logs');
const logger = require('../utils/logger');

let retentionTimer = null;

async function runRetention(days) {
    if (!days || days < 1) return;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
        const [inbRes, outRes] = await Promise.all([
            logsRepo.deleteInboundBefore(cutoff),
            logsRepo.deleteOutboundBefore(cutoff),
        ]);

        const logsDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
        let filesDeleted = 0;
        if (fs.existsSync(logsDir)) {
            const cutoffDate = cutoff.toISOString().slice(0, 10);
            fs.readdirSync(logsDir)
                .filter(f => f.match(/^app-\d{4}-\d{2}-\d{2}\.log$/) && f.slice(4, 14) < cutoffDate)
                .forEach(f => {
                    try { fs.unlinkSync(path.join(logsDir, f)); filesDeleted++; } catch {}
                });
        }

        logger.info(`Retention run: removed ${inbRes.deletedCount} inbound, ${outRes.deletedCount} outbound logs, ${filesDeleted} log files (cutoff: ${cutoff.toISOString()})`);
    } catch (err) {
        logger.error('Retention job failed:', err.message);
    }
}

function scheduleRetention(days) {
    clearTimeout(retentionTimer);
    if (!days || days < 1) return;
    retentionTimer = setTimeout(async () => {
        await runRetention(days);
        retentionTimer = setInterval(() => runRetention(days), 24 * 60 * 60 * 1000);
    }, 10_000);
}

function stopRetention() {
    clearTimeout(retentionTimer);
    clearInterval(retentionTimer);
}

module.exports = { scheduleRetention, stopRetention, runRetention };
