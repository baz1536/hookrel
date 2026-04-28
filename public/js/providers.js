let providers = [];
let editingId = null;
let editingType = null;

const TYPE_SECTIONS = {
    smtp: 'prvSmtpSection', msgraph: 'prvMsgraphSection',
    telegram: 'prvTelegramSection', pushover: 'prvPushoverSection',
    discord: 'prvDiscordSection', slack: 'prvSlackSection',
    gotify: 'prvGotifySection', ntfy: 'prvNtfySection', teams: 'prvTeamsSection',
};
const EMAIL_TYPES = ['smtp', 'msgraph'];

const alert   = (msg) => window.showAlert(msg);
const confirm = (msg, title, ok) => window.showConfirm(msg, title, ok);

async function init() {
    await loadProviders();
    document.getElementById('prvType')?.addEventListener('change', onTypeChange);
}

async function loadProviders() {
    try {
        const res = await fetch('/api/providers');
        if (!res.ok) return;
        providers = await res.json();
        renderList();
    } catch {}
}

function renderList() {
    const el = document.getElementById('providerList');
    const count = document.getElementById('providerCount');
    if (count) count.textContent = providers.length;

    if (!providers.length) {
        el.innerHTML = `<div class="empty-state prv-list-empty">
            <div class="empty-state-icon">🔔</div>
            <h3>No providers yet</h3>
            <p>Add a provider to send notifications</p>
        </div>`;
        return;
    }

    const typeLabel = { smtp: 'SMTP', msgraph: 'Graph', telegram: 'Telegram', pushover: 'Pushover', discord: 'Discord', slack: 'Slack', gotify: 'Gotify', ntfy: 'ntfy', teams: 'Teams' };
    el.innerHTML = providers.map(p => `
        <div class="split-panel-item${editingId === p.id ? ' active' : ''}" onclick="Providers.editProvider('${p.id}')">
            <div>
                <div class="split-panel-item-name">${esc(p.name)}
                    <span class="badge badge-muted prv-type-badge">${esc(typeLabel[p.type] || p.type)}</span>
                </div>
                ${p.recipients ? `<div class="split-panel-item-meta">${esc(p.recipients)}</div>` : ''}
            </div>
        </div>`).join('');
}

function newProvider() {
    editingId = null;
    editingType = null;
    clearForm();
    show('providerForm');
    hide('providerFormEmpty');
    hide('providerFormEditingBanner');
    hide('prvDeleteBtn');
    hide('prvTypeChangeHint');
    document.getElementById('prvType').disabled = false;
    document.getElementById('prvSaveBtn').textContent = 'Save Provider';
    document.getElementById('prvName')?.focus();
    renderList();
}

async function editProvider(id) {
    const p = providers.find(x => x.id === id);
    if (!p) return;
    editingId = id;
    editingType = p.type;

    show('providerForm');
    hide('providerFormEmpty');
    show('prvDeleteBtn');
    show('prvTypeChangeHint');

    document.getElementById('prvName').value = p.name || '';
    const typeEl = document.getElementById('prvType');
    typeEl.value = p.type;
    typeEl.disabled = true;

    showTypeSection(p.type);

    const block = p[p.type] || {};
    if (p.type === 'smtp') {
        setVal('smtpHost', block.host);
        setVal('smtpPort', block.port);
        setVal('smtpSecurity', block.security || 'starttls');
        setVal('smtpFromName', block.fromName);
        setVal('smtpUsername', block.username);
        setVal('smtpPassword', block.password);
        setVal('smtpFrom', block.from);
        const ignoreTLSEl = document.getElementById('smtpIgnoreTLS');
        if (ignoreTLSEl) ignoreTLSEl.checked = !!block.ignoreTLS;
    } else if (p.type === 'msgraph') {
        setVal('graphTenantId', block.tenantId);
        setVal('graphClientId', block.clientId);
        setVal('graphClientSecret', block.clientSecret);
        setVal('graphFrom', block.from);
    } else if (p.type === 'telegram') {
        setVal('telegramBotToken', block.botToken);
        setVal('telegramChatId', block.chatId);
    } else if (p.type === 'pushover') {
        setVal('pushoverApiToken', block.apiToken);
        setVal('pushoverUserKey', block.userKey);
        setVal('pushoverPriority', block.priority ?? 0);
        setVal('pushoverSound', block.sound);
        setVal('pushoverDevice', block.device);
    } else if (p.type === 'discord') {
        setVal('discordWebhookUrl', block.webhookUrl);
    } else if (p.type === 'slack') {
        setVal('slackWebhookUrl', block.webhookUrl);
    } else if (p.type === 'gotify') {
        setVal('gotifyServerUrl', block.serverUrl);
        setVal('gotifyAppToken', block.appToken);
        setVal('gotifyPriority', block.priority ?? 5);
    } else if (p.type === 'ntfy') {
        setVal('ntfyServerUrl', block.serverUrl);
        setVal('ntfyTopic', block.topic);
        setVal('ntfyPriority', block.priority || 'default');
        setVal('ntfyToken', block.token);
    } else if (p.type === 'teams') {
        setVal('teamsWebhookUrl', block.webhookUrl);
    }

    if (EMAIL_TYPES.includes(p.type)) {
        setVal('prvRecipients', p.recipients);
        setVal('prvCc', p.cc);
        setVal('prvBcc', p.bcc);
    }

    setText('providerFormEditingName', p.name);
    show('providerFormEditingBanner');
    document.getElementById('prvSaveBtn').textContent = 'Update Provider';

    // Disable delete if in use by rules
    const deleteBtn = document.getElementById('prvDeleteBtn');
    try {
        const r = await fetch(`/api/rules/in-use?providerId=${id}`);
        const d = await r.json();
        deleteBtn.disabled = d.inUse;
        deleteBtn.title = d.inUse ? 'Cannot delete — referenced by one or more rules' : '';
    } catch { deleteBtn.disabled = false; deleteBtn.title = ''; }

    renderList();
}

function onTypeChange() {
    const type = document.getElementById('prvType')?.value;
    showTypeSection(type);
}

function onSmtpSecurityChange() {
    const security = document.getElementById('smtpSecurity')?.value;
    const portEl = document.getElementById('smtpPort');
    if (!portEl || portEl.value) {
        const current = parseInt(portEl?.value);
        if (!current || current === 587 || current === 465 || current === 25) {
            if (security === 'ssl') portEl.value = 465;
            else if (security === 'none') portEl.value = 25;
            else portEl.value = 587;
        }
    }
}

function showTypeSection(type) {
    Object.values(TYPE_SECTIONS).forEach(id => hide(id));
    hide('prvRecipientsSection');
    hide('prvTestSection');
    if (type && TYPE_SECTIONS[type]) {
        show(TYPE_SECTIONS[type]);
        show('prvTestSection');
        if (EMAIL_TYPES.includes(type)) show('prvRecipientsSection');
    }
}

function buildPayload() {
    const name = document.getElementById('prvName')?.value.trim();
    const type = editingType || document.getElementById('prvType')?.value;
    if (!name || !type) return null;

    const payload = { name, type };

    if (EMAIL_TYPES.includes(type)) {
        payload.recipients = document.getElementById('prvRecipients')?.value.trim() || '';
        payload.cc  = document.getElementById('prvCc')?.value.trim() || '';
        payload.bcc = document.getElementById('prvBcc')?.value.trim() || '';
    }

    if (type === 'smtp') {
        payload.smtp = {
            host:      document.getElementById('smtpHost')?.value.trim(),
            port:      parseInt(document.getElementById('smtpPort')?.value) || 587,
            security:  document.getElementById('smtpSecurity')?.value || 'starttls',
            fromName:  document.getElementById('smtpFromName')?.value.trim(),
            username:  document.getElementById('smtpUsername')?.value.trim(),
            password:  document.getElementById('smtpPassword')?.value || '********',
            from:      document.getElementById('smtpFrom')?.value.trim(),
            ignoreTLS: document.getElementById('smtpIgnoreTLS')?.checked || false,
        };
    } else if (type === 'msgraph') {
        payload.msgraph = {
            tenantId:     document.getElementById('graphTenantId')?.value.trim(),
            clientId:     document.getElementById('graphClientId')?.value.trim(),
            clientSecret: document.getElementById('graphClientSecret')?.value || '********',
            from:         document.getElementById('graphFrom')?.value.trim(),
        };
    } else if (type === 'telegram') {
        payload.telegram = {
            botToken: document.getElementById('telegramBotToken')?.value || '********',
            chatId:   document.getElementById('telegramChatId')?.value.trim(),
        };
    } else if (type === 'pushover') {
        payload.pushover = {
            apiToken: document.getElementById('pushoverApiToken')?.value || '********',
            userKey:  document.getElementById('pushoverUserKey')?.value.trim(),
            priority: parseInt(document.getElementById('pushoverPriority')?.value) || 0,
            sound:    document.getElementById('pushoverSound')?.value || undefined,
            device:   document.getElementById('pushoverDevice')?.value.trim() || undefined,
        };
    } else if (type === 'discord') {
        payload.discord = { webhookUrl: document.getElementById('discordWebhookUrl')?.value.trim() };
    } else if (type === 'slack') {
        payload.slack = { webhookUrl: document.getElementById('slackWebhookUrl')?.value.trim() };
    } else if (type === 'gotify') {
        payload.gotify = {
            serverUrl: document.getElementById('gotifyServerUrl')?.value.trim(),
            appToken:  document.getElementById('gotifyAppToken')?.value || '********',
            priority:  parseInt(document.getElementById('gotifyPriority')?.value) || 5,
        };
    } else if (type === 'ntfy') {
        payload.ntfy = {
            serverUrl: document.getElementById('ntfyServerUrl')?.value.trim(),
            topic:     document.getElementById('ntfyTopic')?.value.trim(),
            priority:  document.getElementById('ntfyPriority')?.value || 'default',
            token:     document.getElementById('ntfyToken')?.value || '********',
        };
    } else if (type === 'teams') {
        payload.teams = { webhookUrl: document.getElementById('teamsWebhookUrl')?.value.trim() };
    }

    return payload;
}

async function saveProvider() {
    const payload = buildPayload();
    if (!payload) { await alert('Name and type are required'); return; }

    try {
        const url = editingId ? `/api/providers/${editingId}` : '/api/providers';
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); await alert(d.error || 'Save failed'); return; }
        const isNew = !editingId;
        if (isNew) {
            const created = await res.json();
            editingId = created.id;
            editingType = created.type;
        }
        await loadProviders();
        editProvider(editingId);
        window.showToast(isNew ? `Provider "${payload.name}" created` : `Provider "${payload.name}" updated`);
    } catch { await alert('Request failed'); }
}

async function deleteProvider() {
    if (!editingId) return;
    const p = providers.find(x => x.id === editingId);
    if (!await confirm(`Delete provider "${p?.name}"? This cannot be undone.`, 'Delete Provider')) return;
    try {
        const res = await fetch(`/api/providers/${editingId}`, { method: 'DELETE' });
        if (!res.ok) { const d = await res.json(); await alert(d.error || 'Delete failed'); return; }
        const name = p?.name || 'Provider';
        editingId = null;
        editingType = null;
        clearForm();
        show('providerFormEmpty');
        hide('providerForm');
        await loadProviders();
        window.showToast(`"${name}" deleted`, 'info');
    } catch { await alert('Request failed'); }
}

async function testProvider() {
    try {
        let res;
        const clientTs = { sentAt: new Date().toISOString(), locale: navigator.language || 'en-GB' };
        const payload = buildPayload();
        if (!payload) { await alert('Fill in the provider details first'); return; }
        res = await fetch('/api/providers/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, id: editingId || undefined, ...clientTs }),
        });

        if (res.ok) {
            window.showToast('Test notification sent successfully');
        } else {
            const d = await res.json();
            window.showToast(d.error || 'Send failed', 'error');
        }
    } catch {
        window.showToast('Request failed', 'error');
    }
}

function clearForm() {
    ['prvName'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const typeEl = document.getElementById('prvType');
    if (typeEl) { typeEl.value = ''; typeEl.disabled = false; }
    const ignoreTLSEl = document.getElementById('smtpIgnoreTLS');
    if (ignoreTLSEl) ignoreTLSEl.checked = false;
    ['smtpHost','smtpPort','smtpFromName','smtpUsername','smtpPassword','smtpFrom',
     'graphTenantId','graphClientId','graphClientSecret','graphFrom',
     'telegramBotToken','telegramChatId',
     'pushoverApiToken','pushoverUserKey','pushoverSound','pushoverDevice',
     'discordWebhookUrl', 'slackWebhookUrl', 'teamsWebhookUrl',
     'gotifyServerUrl','gotifyAppToken','gotifyPriority',
     'ntfyServerUrl','ntfyTopic','ntfyToken',
     'prvRecipients','prvCc','prvBcc',
    ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    setVal('smtpSecurity', 'starttls');
    setVal('pushoverPriority', '0');
    setVal('ntfyPriority', 'default');

    Object.values(TYPE_SECTIONS).forEach(id => hide(id));
    hide('prvRecipientsSection');
    hide('prvTestSection');
    hide('providerFormEditingBanner');
    hide('prvDeleteBtn');
    hide('prvTypeChangeHint');

}

function show(id) { document.getElementById(id)?.classList.remove('prv-hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('prv-hidden'); }
function setVal(id, val) { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; }
function esc(str) { return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

window.Providers = { init, newProvider, editProvider, saveProvider, deleteProvider, testProvider, clearForm, onSmtpSecurityChange };

init();
