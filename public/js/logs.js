let sysPage = 1;
let inbPage = 1;
let outPage = 1;

async function init() {
    await Promise.all([loadSystemDates(), loadSources(), loadProviders()]);
    loadSystem();
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tab) {
    ['system', 'inbound', 'outbound'].forEach(t => {
        document.getElementById(`logsTab${cap(t)}`).classList.toggle('active', t === tab);
        document.getElementById(`logs${cap(t)}`).classList.toggle('active', t === tab);
    });
    if (tab === 'system')   { sysPage = 1; loadSystem(); }
    if (tab === 'inbound')  { inbPage = 1; loadInbound(); }
    if (tab === 'outbound') { outPage = 1; loadOutbound(); }
}

// ── System logs ───────────────────────────────────────────────────────────────

async function loadSystemDates() {
    try {
        const res = await fetch('/api/logs/system/dates');
        if (!res.ok) return;
        const dates = await res.json();
        const sel = document.getElementById('sysDateSel');
        sel.innerHTML = '';
        if (dates.length === 0) {
            sel.innerHTML = '<option value="">No log files</option>';
            return;
        }
        dates.forEach((d, i) => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d + (i === 0 ? ' (today)' : '');
            sel.appendChild(opt);
        });
    } catch {}
}

async function loadSystem() {
    const date   = document.getElementById('sysDateSel')?.value || '';
    const level  = document.getElementById('sysLevelSel')?.value || '';
    const search = document.getElementById('sysSearch')?.value || '';
    const params = new URLSearchParams({ page: sysPage });
    if (date)   params.set('date', date);
    if (level)  params.set('level', level);
    if (search) params.set('search', search);

    const list = document.getElementById('sysLogList');
    list.innerHTML = '<p class="loading logs-loading">Loading…</p>';

    try {
        const res = await fetch(`/api/logs/system?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        renderSystemLogs(data);
    } catch {
        list.innerHTML = '<p class="loading logs-loading">Failed to load logs</p>';
    }
}

function renderSystemLogs({ entries, total: _total, page, pages }) {
    const list = document.getElementById('sysLogList');
    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">📋</div><h3>No log entries</h3><p>No entries match the current filters</p></div>';
        document.getElementById('sysPagination').classList.remove('visible');
        return;
    }

    list.innerHTML = entries.map((e, i) => {
        const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString('en-GB', { hour12: false }) : '—';
        const date = e.timestamp ? new Date(e.timestamp).toLocaleDateString('en-GB') : '';
        const level = e.level || 'info';
        const msg = esc(e.message || '');
        const hasExtra = Object.keys(e).some(k => !['level','message','timestamp'].includes(k));
        const extraId = `sysExtra${i}`;
        const extra = hasExtra ? JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['level','message','timestamp'].includes(k))), null, 2) : '';

        return `<div class="log-entry${hasExtra ? ' inbound-row' : ''}" ${hasExtra ? `onclick="toggleDetail('${extraId}')"` : ''}>
            <span class="log-time">${esc(date)} ${esc(time)}</span>
            <span class="log-level-${level}">${level.toUpperCase()}</span>
            <span class="log-message">${msg}</span>
        </div>${hasExtra ? `<div class="log-detail-row" id="${extraId}"><pre class="log-detail-pre">${esc(extra)}</pre></div>` : ''}`;
    }).join('');

    renderPagination('sysPagination', page, pages, p => { sysPage = p; loadSystem(); });
}

// ── Inbound logs ──────────────────────────────────────────────────────────────

async function loadSources() {
    try {
        const res = await fetch('/api/sources');
        if (!res.ok) return;
        const sources = await res.json();
        const sel = document.getElementById('inbSourceSel');
        if (!sel) return;
        sources.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            sel.appendChild(opt);
        });
    } catch {}
}

async function loadInbound() {
    const sourceId  = document.getElementById('inbSourceSel')?.value || '';
    const eventType = document.getElementById('inbEventType')?.value.trim() || '';
    const status    = document.getElementById('inbStatusSel')?.value || '';
    const params = new URLSearchParams({ page: inbPage });
    if (sourceId)  params.set('sourceId', sourceId);
    if (eventType) params.set('eventType', eventType);
    if (status)    params.set('status', status);

    const list = document.getElementById('inbLogList');
    list.innerHTML = '<p class="loading logs-loading">Loading…</p>';

    try {
        const res = await fetch(`/api/logs/inbound?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        renderInboundLogs(data);
    } catch {
        list.innerHTML = '<p class="loading logs-loading">Failed to load logs</p>';
    }
}

function renderInboundLogs({ entries, total: _total, page, pages }) {
    const list = document.getElementById('inbLogList');
    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">📡</div><h3>No inbound logs</h3><p>Webhook events will appear here</p></div>';
        document.getElementById('inbPagination').classList.remove('visible');
        return;
    }

    list.innerHTML = entries.map((e, i) => {
        const time = new Date(e.receivedAt).toLocaleString('en-GB', { hour12: false });
        const detailId = `inbDetail${i}`;
        const statusBadge = statusBadgeHtml(e.dispatchStatus);
        return `<div class="split-panel-item inbound-row" onclick="Logs.toggleInboundDetail('${e.id}', '${detailId}')">
            <div style="flex:1;min-width:0">
                <div class="split-panel-item-name">${esc(e.sourceName || e.slug)} <span class="badge badge-accent" style="margin-left:4px">${esc(e.eventType)}</span></div>
                <div class="split-panel-item-meta">${esc(time)}</div>
            </div>
            <div>${statusBadge}</div>
        </div>
        <div class="inbound-detail" id="${detailId}">
            <p class="loading logs-loading">Loading detail…</p>
        </div>`;
    }).join('');

    renderPagination('inbPagination', page, pages, p => { inbPage = p; loadInbound(); });
}

async function toggleInboundDetail(id, detailId) {
    const el = document.getElementById(detailId);
    if (!el) return;
    const isOpen = el.classList.contains('open');
    // Close all open details first
    document.querySelectorAll('.inbound-detail.open').forEach(d => d.classList.remove('open'));
    if (isOpen) return;

    el.classList.add('open');
    if (el.dataset.loaded) return;

    try {
        const res = await fetch(`/api/logs/inbound/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        el.dataset.loaded = '1';
        el.innerHTML = renderInboundDetail(data);
    } catch {
        el.innerHTML = '<p class="loading logs-loading">Failed to load detail</p>';
    }
}

function renderInboundDetail(e) {
    const outboundHtml = e.outbound?.length
        ? e.outbound.map(o => `<div class="outbound-item">
            <span class="badge ${o.status === 'ok' ? 'badge-success' : 'badge-error'}">${o.status}</span>
            <strong style="margin-left:8px;font-size:13px">${esc(o.providerName)}</strong>
            <span class="badge badge-muted" style="margin-left:6px">${esc(o.providerType)}</span>
            ${o.templateId ? `<span style="font-size:12px;color:var(--text-muted);margin-left:6px">· ${esc(o.templateName || 'template')}</span>` : ''}
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${esc(new Date(o.sentAt).toLocaleString('en-GB', { hour12: false }))}</div>
            ${o.error ? `<div style="font-size:12px;color:var(--error);margin-top:4px">${esc(o.error)}</div>` : ''}
          </div>`).join('')
        : '<p class="form-hint" style="padding:8px 0">No outbound notifications</p>';

    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
            <div class="tpl-preview-label">Payload</div>
            <pre style="max-height:300px;overflow-y:auto;margin-top:6px;font-size:11px">${esc(JSON.stringify(e.payload, null, 2))}</pre>
        </div>
        <div>
            <div class="tpl-preview-label" style="margin-bottom:8px">Outbound Notifications</div>
            ${outboundHtml}
        </div>
    </div>`;
}

// ── Outbound logs ─────────────────────────────────────────────────────────────

async function loadProviders() {
    try {
        const res = await fetch('/api/providers');
        if (!res.ok) return;
        const providers = await res.json();
        const sel = document.getElementById('outProviderSel');
        if (!sel) return;
        providers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.type})`;
            sel.appendChild(opt);
        });
    } catch {}
}

async function loadOutbound() {
    const providerId = document.getElementById('outProviderSel')?.value || '';
    const status     = document.getElementById('outStatusSel')?.value || '';
    const params = new URLSearchParams({ page: outPage });
    if (providerId) params.set('providerId', providerId);
    if (status)     params.set('status', status);

    const list = document.getElementById('outLogList');
    list.innerHTML = '<p class="loading logs-loading">Loading…</p>';

    try {
        const res = await fetch(`/api/logs/outbound?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        renderOutboundLogs(data);
    } catch {
        list.innerHTML = '<p class="loading logs-loading">Failed to load logs</p>';
    }
}

function renderOutboundLogs({ entries, total: _total, page, pages }) {
    const list = document.getElementById('outLogList');
    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">🔔</div><h3>No outbound logs</h3><p>Dispatched notifications will appear here</p></div>';
        document.getElementById('outPagination').classList.remove('visible');
        return;
    }

    list.innerHTML = entries.map(e => {
        const time = new Date(e.sentAt).toLocaleString('en-GB', { hour12: false });
        return `<div class="split-panel-item">
            <div style="flex:1;min-width:0">
                <div class="split-panel-item-name">
                    <span class="badge ${e.status === 'ok' ? 'badge-success' : 'badge-error'}" style="margin-right:8px">${e.status}</span>
                    ${esc(e.providerName)} <span class="badge badge-muted" style="margin-left:4px">${esc(e.providerType)}</span>
                </div>
                <div class="split-panel-item-meta">${esc(e.ruleName || '')} · ${esc(time)}</div>
                ${e.subject ? `<div class="split-panel-item-meta" style="margin-top:2px">${esc(e.subject)}</div>` : ''}
                ${e.error   ? `<div style="font-size:12px;color:var(--error);margin-top:4px">${esc(e.error)}</div>` : ''}
            </div>
        </div>`;
    }).join('');

    renderPagination('outPagination', page, pages, p => { outPage = p; loadOutbound(); });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function renderPagination(elId, page, pages, onPage) {
    const el = document.getElementById(elId);
    if (pages <= 1) { el.classList.remove('visible'); return; }
    el.classList.add('visible');
    el.innerHTML = `
        <button type="button" class="btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="Logs._page('${elId}',${page - 1})">‹ Prev</button>
        <span>Page ${page} of ${pages}</span>
        <button type="button" class="btn-secondary btn-sm" ${page >= pages ? 'disabled' : ''} onclick="Logs._page('${elId}',${page + 1})">Next ›</button>`;
    el._onPage = onPage;
}

function toggleDetail(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

function statusBadgeHtml(status) {
    const map = { dispatched: 'badge-success', partial: 'badge-warning', no_rules: 'badge-muted', error: 'badge-error', pending: 'badge-muted' };
    return `<span class="badge ${map[status] || 'badge-muted'}">${esc(status || 'unknown')}</span>`;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.Logs = {
    init, switchTab, loadSystem, loadInbound, loadOutbound,
    toggleInboundDetail,
    _page(elId, p) {
        const el = document.getElementById(elId);
        if (el?._onPage) el._onPage(p);
    },
};

window.toggleDetail = toggleDetail;

init();
