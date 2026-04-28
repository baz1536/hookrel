const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const sourcesRepo = require('../../repositories/sources');
const providersRepo = require('../../repositories/providers');
const templatesRepo = require('../../repositories/templates');
const rulesRepo = require('../../repositories/rules');
const logsRepo = require('../../repositories/logs');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const now = new Date();
        const since24h = new Date(now - 24 * 60 * 60 * 1000);
        const since7d  = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const [
            sourcesCount,
            providersCount,
            templatesCount,
            rulesCount,
            inbound24h,
            outbound24h,
            inboundTotal,
            outboundErrors24h,
            recentActivity,
            statusBreakdown,
            dailyTrend,
            eventTypeBreakdown,
        ] = await Promise.all([
            sourcesRepo.count(),
            providersRepo.count(),
            templatesRepo.count(),
            rulesRepo.count(),
            logsRepo.countInboundSince(since24h),
            logsRepo.countOutboundSince(since24h),
            logsRepo.countInboundTotal(),
            logsRepo.countOutboundErrorsSince(since24h),
            logsRepo.findRecentInbound(10),
            logsRepo.inboundStatusBreakdown(since7d),
            logsRepo.inboundDailyTrend(7),
            logsRepo.inboundEventTypeBreakdown(since7d),
        ]);

        const statusMap = {};
        statusBreakdown.forEach(s => { statusMap[s._id] = s.count; });

        res.json({
            stats: {
                sources: sourcesCount,
                providers: providersCount,
                templates: templatesCount,
                activeRules: rulesCount,
                inbound24h,
                outbound24h,
                inboundTotal,
                outboundErrors24h,
            },
            statusBreakdown: statusMap,
            dailyTrend,
            eventTypeBreakdown,
            recentActivity: recentActivity.map(e => ({
                id: e._id.toString(),
                sourceName: e.sourceName || e.slug || '',
                eventType: e.eventType || '',
                dispatchStatus: e.dispatchStatus || 'unknown',
                receivedAt: e.receivedAt,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
