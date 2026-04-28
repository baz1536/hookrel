const { decrypt } = require('./encryption');
const { render } = require('./templateEngine');
const { PLAIN_ONLY_TYPES } = require('../constants/providerTypes');
const { sendSmtp, sendMsgraph } = require('./providers/email');
const { sendTelegram } = require('./providers/telegram');
const { sendPushover } = require('./providers/pushover');
const { sendDiscord } = require('./providers/discord');
const { sendSlack } = require('./providers/slack');
const { sendGotify } = require('./providers/gotify');
const { sendNtfy } = require('./providers/ntfy');
const { sendTeams } = require('./providers/teams');
const providersRepo = require('../repositories/providers');
const templatesRepo = require('../repositories/templates');
const logsRepo = require('../repositories/logs');
const logger = require('../utils/logger');

async function dispatch(inboundId, rules, payload) {
    const results = await Promise.allSettled(
        rules.map(rule => dispatchRule(inboundId, rule, payload))
    );

    const summary = results.map((r, i) => ({
        ruleId: rules[i]._id.toString(),
        status: r.status === 'fulfilled' ? 'ok' : 'error',
        error: r.reason?.message,
    }));

    const allOk = summary.every(s => s.status === 'ok');
    await logsRepo.updateInboundStatus(inboundId, allOk ? 'dispatched' : 'partial');
    return summary;
}

async function dispatchRule(inboundId, rule, payload) {
    const ids = Array.isArray(rule.providerIds) && rule.providerIds.length > 0
        ? rule.providerIds
        : rule.providerId ? [rule.providerId.toString()] : [];

    if (ids.length === 0) throw new Error('Rule has no providers');

    const template = rule.templateId
        ? await templatesRepo.findById(rule.templateId.toString())
        : null;

    const enrichedPayload = enrichPayload(payload);
    const subject = template?.subject ? render(template.subject, enrichedPayload) : 'HookRel notification';

    const results = await Promise.allSettled(ids.map(async pid => {
        const provider = await providersRepo.findById(pid.toString());
        if (!provider) throw new Error(`Provider not found: ${pid}`);

        let body;
        if (!template) {
            body = JSON.stringify(payload, null, 2);
        } else if (PLAIN_ONLY_TYPES.includes(provider.type)) {
            body = template.bodyPlain ? render(template.bodyPlain, enrichedPayload) : render(template.bodyHtml, enrichedPayload);
        } else {
            body = template.bodyHtml ? render(template.bodyHtml, enrichedPayload) : render(template.bodyPlain, enrichedPayload);
        }

        const sentAt = new Date();
        let status = 'ok';
        let error = null;

        try {
            await sendToProvider(provider, subject, body);
        } catch (err) {
            status = 'error';
            error = err.message;
            logger.error(`Dispatch failed — provider ${provider.name}: ${err.message}`);
        }

        await logsRepo.createOutbound({
            inboundId,
            ruleId: rule._id,
            ruleName: rule.name,
            providerId: provider._id,
            providerName: provider.name,
            status,
            error,
            sentAt,
        });

        if (status === 'error') throw new Error(error);
    }));

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length === ids.length) throw new Error(failed[0].reason?.message || 'All providers failed');
}

async function sendToProvider(provider, subject, body) {
    const type = provider.type;
    const config = decryptProvider(provider);

    if (type === 'smtp')     return sendSmtp(config, subject, body);
    if (type === 'msgraph')  return sendMsgraph(config, subject, body);
    if (type === 'telegram') return sendTelegram(config, body);
    if (type === 'pushover') return sendPushover(config, subject, body);
    if (type === 'discord')  return sendDiscord(config, body);
    if (type === 'slack')    return sendSlack(config, body);
    if (type === 'gotify')   return sendGotify(config, subject, body);
    if (type === 'ntfy')     return sendNtfy(config, subject, body);
    if (type === 'teams')    return sendTeams(config, subject, body);
    throw new Error(`Unknown provider type: ${type}`);
}

function extractImages(images) {
    const result = {};
    if (!Array.isArray(images)) return result;
    for (const img of images) {
        const url = img.remoteUrl || img.url || '';
        switch (img.coverType) {
            case 'poster':   result.posterUrl   = url; break;
            case 'banner':   result.bannerUrl   = url; break;
            case 'fanart':   result.fanartUrl   = url; break;
            case 'clearlogo': result.clearlogoUrl = url; break;
        }
    }
    return result;
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return null;
    const b = Number(bytes);
    if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
    return `${b} B`;
}

function enrichPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const enriched = { ...payload };
    if (payload.series) {
        enriched.series = { ...payload.series, ...extractImages(payload.series.images) };
    }
    if (payload.movie) {
        enriched.movie = { ...payload.movie, ...extractImages(payload.movie.images) };
    }
    // Add zero-padded season/episode numbers to each episode
    if (Array.isArray(payload.episodes)) {
        enriched.episodes = payload.episodes.map(e => ({
            ...e,
            seasonNumberPadded:  String(e.seasonNumber  ?? '').padStart(2, '0'),
            episodeNumberPadded: String(e.episodeNumber ?? '').padStart(2, '0'),
        }));
    }
    // Add sizeFormatted to file/release objects
    if (Array.isArray(payload.episodeFiles)) {
        enriched.episodeFiles = payload.episodeFiles.map(f => ({ ...f, sizeFormatted: formatBytes(f.size) }));
    }
    if (payload.episodeFile) {
        enriched.episodeFile = { ...payload.episodeFile, sizeFormatted: formatBytes(payload.episodeFile.size) };
    }
    if (payload.movieFile) {
        enriched.movieFile = { ...payload.movieFile, sizeFormatted: formatBytes(payload.movieFile.size) };
    }
    if (payload.release) {
        enriched.release = { ...payload.release, sizeFormatted: formatBytes(payload.release.size) };
    }
    return enriched;
}

function decryptProvider(doc) {
    const config = { ...doc };
    if (config.smtp?.password) config.smtp = { ...config.smtp, password: decrypt(config.smtp.password) };
    if (config.msgraph?.clientSecret) config.msgraph = { ...config.msgraph, clientSecret: decrypt(config.msgraph.clientSecret) };
    if (config.telegram?.botToken) config.telegram = { ...config.telegram, botToken: decrypt(config.telegram.botToken) };
    if (config.pushover?.apiToken) config.pushover = { ...config.pushover, apiToken: decrypt(config.pushover.apiToken) };
    if (config.gotify?.appToken) config.gotify = { ...config.gotify, appToken: decrypt(config.gotify.appToken) };
    if (config.ntfy?.token) config.ntfy = { ...config.ntfy, token: decrypt(config.ntfy.token) };
    return config;
}

module.exports = { dispatch, sendToProvider };
