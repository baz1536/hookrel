let sources = [];
let editingId = null;
let catalogue = [];
let publicUrl = '';

const alert   = (msg) => window.showAlert(msg);
const confirm = (msg, title, ok) => window.showConfirm(msg, title, ok);

async function init() {
    await Promise.all([loadCatalogue(), loadSources(), loadPublicUrl()]);
}

async function loadPublicUrl() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const d = await res.json();
            publicUrl = d.publicUrl || '';
        }
    } catch {}
}

async function loadCatalogue() {
    try {
        const res = await fetch('/api/sources/catalogue');
        if (!res.ok) return;
        catalogue = await res.json();
        const sel = document.getElementById('srcCatalogueId');
        if (!sel) return;
        sel.innerHTML = catalogue.map(c =>
            `<option value="${esc(c.id)}">${esc(c.name)} — ${esc(c.description)}</option>`
        ).join('');
        sel.addEventListener('change', onCatalogueChange);
        onCatalogueChange();
    } catch {}
}

function onCatalogueChange() {
    const sel = document.getElementById('srcCatalogueId');
    const entry = catalogue.find(c => c.id === sel?.value);
    const hint = document.getElementById('srcCatalogueDesc');
    if (hint) hint.textContent = entry?.knownEvents?.length
        ? `Known events: ${entry.knownEvents.join(', ')}`
        : '';
    const customInfo = document.getElementById('srcCustomInfo');
    if (customInfo) customInfo.classList.toggle('src-hidden', sel?.value !== 'custom');
}

async function loadSources() {
    try {
        const res = await fetch('/api/sources');
        if (!res.ok) return;
        sources = await res.json();
        renderList();
    } catch {}
}

function renderList() {
    const el = document.getElementById('sourceList');
    const count = document.getElementById('sourceCount');
    if (count) count.textContent = sources.length;

    if (!sources.length) {
        el.innerHTML = `<div class="empty-state src-list-empty">
            <div class="empty-state-icon">📡</div>
            <h3>No sources yet</h3>
            <p>Add a source to start receiving webhooks</p>
        </div>`;
        return;
    }

    el.innerHTML = sources.map(s => {
        const catEntry = catalogue.find(c => c.id === s.catalogueId);
        const learnedBadge = s.catalogueId === 'custom'
            ? (s.learnedTokenCount > 0
                ? `<span class="badge badge-success src-learned-badge">${s.learnedTokenCount} token${s.learnedTokenCount === 1 ? '' : 's'} learned</span>`
                : `<span class="badge badge-muted src-learned-badge">Not yet learned</span>`)
            : '';
        return `<div class="split-panel-item${editingId === s.id ? ' active' : ''}" onclick="Sources.editSource('${s.id}')">
            <div>
                <div class="split-panel-item-name">${esc(s.name)}
                    <span class="badge badge-muted prv-type-badge">${esc(catEntry?.name || s.catalogueId || 'custom')}</span>
                    ${learnedBadge}
                </div>
                <div class="split-panel-item-meta">/webhook/${esc(s.slug)}</div>
            </div>
        </div>`;
    }).join('');
}

function newSource() {
    editingId = null;
    clearForm();
    show('sourceForm');
    hide('sourceFormEmpty');
    hide('srcConnectionPanel');
    hide('sourceFormEditingBanner');
    hide('srcDeleteBtn');
    document.getElementById('srcSaveBtn').textContent = 'Save Source';
    document.getElementById('srcName')?.focus();
    renderList();
}

async function editSource(id) {
    const s = sources.find(x => x.id === id);
    if (!s) return;
    editingId = id;

    show('sourceForm');
    hide('sourceFormEmpty');
    show('srcConnectionPanel');
    show('srcDeleteBtn');

    document.getElementById('srcName').value = s.name || '';
    document.getElementById('srcCatalogueId').value = s.catalogueId || 'custom';
    onCatalogueChange();

    setText('sourceFormEditingName', s.name);
    show('sourceFormEditingBanner');
    document.getElementById('srcSaveBtn').textContent = 'Update Source';

    const base = publicUrl || window.location.origin;
    document.getElementById('srcWebhookUrl').value = `${base}/webhook/${s.slug}`;
    document.getElementById('srcToken').value = s.token || '';

    hide('srcParseResult');
    document.getElementById('srcTestPayload').value = '';

    // Learned tokens panel — custom sources only
    const learnedPanel = document.getElementById('srcLearnedPanel');
    if (s.catalogueId === 'custom' && learnedPanel) {
        const paths = s.learnedTokenPaths || [];
        const badge = document.getElementById('srcLearnedBadge');
        const tokenEl = document.getElementById('srcLearnedTokens');
        if (badge) {
            badge.textContent = paths.length > 0 ? `${paths.length} learned` : 'Not yet learned';
            badge.className = `badge ${paths.length > 0 ? 'badge-success' : 'badge-muted'}`;
        }
        if (tokenEl) {
            tokenEl.innerHTML = paths.length
                ? paths.map(p => `<span class="badge badge-muted">${esc(p)}</span>`).join('')
                : '<span class="form-hint">No tokens yet — send a webhook to this source to start learning.</span>';
        }
        learnedPanel.classList.remove('src-hidden');
    } else if (learnedPanel) {
        learnedPanel.classList.add('src-hidden');
    }

    // Disable delete if in use by rules
    const deleteBtn = document.getElementById('srcDeleteBtn');
    try {
        const r = await fetch(`/api/rules/in-use?sourceId=${id}`);
        const d = await r.json();
        deleteBtn.disabled = d.inUse;
        deleteBtn.title = d.inUse ? 'Cannot delete — referenced by one or more rules' : '';
    } catch { deleteBtn.disabled = false; deleteBtn.title = ''; }

    renderList();
}

async function saveSource() {
    const name = document.getElementById('srcName')?.value.trim();
    if (!name) { await alert('Name is required'); return; }
    const catalogueId = document.getElementById('srcCatalogueId')?.value || 'custom';

    try {
        const isNew = !editingId;
        if (editingId) {
            const res = await fetch(`/api/sources/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) { const d = await res.json(); await alert(d.error || 'Update failed'); return; }
        } else {
            const res = await fetch('/api/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, catalogueId }),
            });
            if (!res.ok) { const d = await res.json(); await alert(d.error || 'Create failed'); return; }
            const created = await res.json();
            editingId = created.id;
        }
        await loadSources();
        editSource(editingId);
        window.showToast(isNew ? `Source "${name}" created` : `Source "${name}" updated`);
    } catch { await alert('Request failed'); }
}

async function deleteSource() {
    if (!editingId) return;
    const s = sources.find(x => x.id === editingId);
    if (!await confirm(`Delete source "${s?.name}"? This cannot be undone.`, 'Delete Source')) return;
    try {
        const res = await fetch(`/api/sources/${editingId}`, { method: 'DELETE' });
        if (!res.ok) { const d = await res.json(); await alert(d.error || 'Delete failed'); return; }
        const name = s?.name || 'Source';
        editingId = null;
        clearForm();
        show('sourceFormEmpty');
        hide('sourceForm');
        await loadSources();
        window.showToast(`"${name}" deleted`, 'info');
    } catch { await alert('Request failed'); }
}

async function rotateToken() {
    if (!editingId) return;
    if (!await confirm('Rotate the token? The old token will stop working immediately.', 'Rotate Token', 'Rotate')) return;
    try {
        const res = await fetch(`/api/sources/${editingId}/rotate-token`, { method: 'POST' });
        if (!res.ok) { const d = await res.json(); await alert(d.error || 'Rotate failed'); return; }
        const { token } = await res.json();
        document.getElementById('srcToken').value = token;
        await loadSources();
    } catch { await alert('Request failed'); }
}

async function parsePayload() {
    if (!editingId) return;
    const raw = document.getElementById('srcTestPayload')?.value.trim();
    if (!raw) { await alert('Enter a JSON payload to parse'); return; }
    let payload;
    try { payload = JSON.parse(raw); } catch { await alert('Invalid JSON — check the payload and try again'); return; }

    try {
        const res = await fetch(`/api/sources/${editingId}/parse-payload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); await alert(d.error || 'Parse failed'); return; }
        const { eventType, tokens } = await res.json();

        document.getElementById('srcParseEventType').textContent = eventType || 'unknown';
        const tokenEl = document.getElementById('srcParseTokens');
        const paths = Object.keys(tokens || {});
        tokenEl.innerHTML = paths.length
            ? paths.map(p => `<span class="badge badge-muted" title="${esc(String(tokens[p]))}">${esc(p)}</span>`).join('')
            : '<span class="form-hint">No tokens extracted</span>';
        show('srcParseResult');
    } catch { await alert('Request failed'); }
}

function copyToClipboard(text, label) {
    if (!text) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
            .then(() => window.showToast(`${label} copied`))
            .catch(() => fallbackCopy(text, label));
    } else {
        fallbackCopy(text, label);
    }
}

function fallbackCopy(text, label) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        window.showToast(`${label} copied`);
    } catch {
        window.showToast(`Could not copy ${label}`, 'error');
    }
    document.body.removeChild(ta);
}

function copyUrl() {
    copyToClipboard(document.getElementById('srcWebhookUrl')?.value || '', 'URL');
}
function copyToken() {
    copyToClipboard(document.getElementById('srcToken')?.value || '', 'Token');
}

function clearForm() {
    document.getElementById('srcName').value = '';
    document.getElementById('srcCatalogueId').value = catalogue[0]?.id || 'custom';
    onCatalogueChange();
    hide('srcConnectionPanel');
    hide('sourceFormEditingBanner');
    hide('srcDeleteBtn');
    hide('srcParseResult');
}

function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('src-hidden', 'prv-hidden'); }
function hide(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains('prv-hidden')) el.classList.add('prv-hidden');
    else el.classList.add('src-hidden');
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; }

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.Sources = {
    init, newSource, editSource, saveSource, deleteSource,
    rotateToken, parsePayload, copyUrl, copyToken, clearForm,
};

init();
