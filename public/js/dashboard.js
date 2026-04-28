let refreshTimer = null;

async function init() {
    await load();
    scheduleRefresh();
}

function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
        await load();
        scheduleRefresh();
    }, 30_000);
}

async function load() {
    try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error();
        const data = await res.json();
        renderStats(data.stats);
        renderBreakdown(data.statusBreakdown);
        renderTrendChart(data.dailyTrend || []);
        renderEventChart(data.eventTypeBreakdown || []);
        renderFeed(data.recentActivity);
    } catch {
        document.getElementById('dashFeed').innerHTML = '<p class="loading">Failed to load dashboard data</p>';
    }
}

function renderStats(s) {
    setText('statSources',   s.sources);
    setText('statProviders', s.providers);
    setText('statTemplates', s.templates);
    setText('statRules',     s.activeRules);
    setText('statInbound24h', s.inbound24h);
    setText('statOutbound24h', s.outbound24h);
    setText('statTotal',    s.inboundTotal);
    setText('statErrors',   s.outboundErrors24h);

    const errorCard = document.getElementById('statErrorCard');
    if (errorCard) {
        errorCard.classList.toggle('dash-stat-has-errors', s.outboundErrors24h > 0);
    }
}

function renderTrendChart(trend) {
    const el = document.getElementById('dashTrendChart');

    // Fill in missing days so we always show 7 columns
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }

    const countMap = {};
    trend.forEach(r => { countMap[r.date] = r.count; });

    const counts = days.map(d => countMap[d] || 0);
    const max = Math.max(...counts, 1);

    const cols = days.map((date, i) => {
        const count = counts[i];
        const heightPct = Math.round((count / max) * 100);
        const label = date.slice(5).replace('-', '/');
        return `<div class="dash-bar-chart-col">
            <div class="dash-bar-chart-bar-wrap">
                ${count > 0 ? `<div class="dash-bar-chart-value">${count}</div>` : ''}
                <div class="dash-bar-chart-bar" style="height:${heightPct}%" title="${date}: ${count}"></div>
            </div>
            <div class="dash-bar-chart-label">${label}</div>
        </div>`;
    }).join('');

    el.innerHTML = cols || '<p class="dash-empty-hint">No data yet</p>';
}

function renderEventChart(breakdown) {
    const el = document.getElementById('dashEventChart');
    if (!breakdown.length) {
        el.innerHTML = '<p class="dash-empty-hint">No events in the last 7 days</p>';
        return;
    }

    const max = Math.max(...breakdown.map(r => r.count), 1);
    el.innerHTML = breakdown.map(r => {
        const pct = Math.round((r.count / max) * 100);
        return `<div class="dash-event-row">
            <span class="dash-event-label" title="${esc(r.eventType)}">${esc(r.eventType || 'unknown')}</span>
            <div class="dash-event-bar-wrap">
                <div class="dash-event-bar" style="width:${pct}%"></div>
            </div>
            <span class="dash-event-count">${r.count}</span>
        </div>`;
    }).join('');
}

function renderBreakdown(map) {
    const el = document.getElementById('dashBreakdown');
    const statuses = [
        { key: 'dispatched', label: 'Dispatched', cls: 'badge-success' },
        { key: 'partial',    label: 'Partial',    cls: 'badge-warning' },
        { key: 'no_rules',   label: 'No Rules',   cls: 'badge-muted' },
        { key: 'error',      label: 'Error',      cls: 'badge-error' },
        { key: 'pending',    label: 'Pending',    cls: 'badge-muted' },
    ];

    const total = Object.values(map).reduce((a, b) => a + b, 0);
    if (total === 0) {
        el.innerHTML = '<p class="dash-empty-hint">No webhook events in the last 7 days</p>';
        return;
    }

    el.innerHTML = statuses.map(({ key, label, cls }) => {
        const count = map[key] || 0;
        if (count === 0) return '';
        const pct = Math.round((count / total) * 100);
        return `<div class="dash-breakdown-row">
            <span class="badge ${cls} dash-breakdown-badge">${label}</span>
            <div class="dash-breakdown-bar-wrap">
                <div class="dash-breakdown-bar" style="width:${pct}%"></div>
            </div>
            <span class="dash-breakdown-count">${count}</span>
        </div>`;
    }).join('');
}

function renderFeed(activity) {
    const el = document.getElementById('dashFeed');
    if (!activity.length) {
        el.innerHTML = '<div class="empty-state dash-feed-empty"><div class="empty-state-icon">📡</div><h3>No recent activity</h3><p>Webhook events will appear here</p></div>';
        return;
    }

    const statusMap = {
        dispatched: 'badge-success',
        partial:    'badge-warning',
        no_rules:   'badge-muted',
        error:      'badge-error',
        pending:    'badge-muted',
    };

    el.innerHTML = activity.map(e => {
        const time = new Date(e.receivedAt).toLocaleString('en-GB', { hour12: false });
        const cls = statusMap[e.dispatchStatus] || 'badge-muted';
        return `<div class="dash-feed-row">
            <div class="dash-feed-row-main">
                <span class="dash-feed-source">${esc(e.sourceName)}</span>
                <span class="badge badge-accent dash-feed-event">${esc(e.eventType)}</span>
            </div>
            <div class="dash-feed-row-meta">
                <span class="dash-feed-time">${esc(time)}</span>
                <span class="badge ${cls}">${esc(e.dispatchStatus)}</span>
            </div>
        </div>`;
    }).join('');
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '—';
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.Dashboard = { init, refresh: load };

init();
