import { renderTokenHints } from './tokenHints.js';

let allRules = [];
let allGroups = [];
let allSources = [];
let allProviders = [];
let allTemplates = [];
let selectedGroupId = null;
let editingRuleId = null;
let openAccordions = new Set(['rules']); // 'settings' | 'rules'
let dragSrcIndex = null;

const OPERATORS = [
    { value: 'equals',       label: 'equals' },
    { value: 'not_equals',   label: 'not equals' },
    { value: 'contains',     label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with',  label: 'starts with' },
    { value: 'ends_with',    label: 'ends with' },
    { value: 'is_empty',     label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
];

const VALUE_LESS_OPS = new Set(['is_empty', 'is_not_empty']);

const alert   = (msg)            => window.showAlert(msg);
const confirm = (msg, title, ok) => window.showConfirm(msg, title, ok);

async function init() {
    await Promise.all([loadGroups(), loadSources(), loadProviders(), loadTemplates(), loadRules()]);
}

async function loadGroups() {
    try {
        const res = await fetch('/api/groups');
        if (res.ok) { allGroups = await res.json(); renderGroupList(); }
    } catch {}
}

async function loadSources() {
    try {
        const res = await fetch('/api/sources');
        if (res.ok) { allSources = await res.json(); populateSelect('ruleSourceId', allSources, '— Any source —'); }
    } catch {}
}

async function loadProviders() {
    try {
        const res = await fetch('/api/providers');
        if (res.ok) { allProviders = await res.json(); populateProviderAddSelect(); }
    } catch {}
}

function populateProviderAddSelect() {
    const sel = document.getElementById('ruleProviderAdd');
    if (!sel) return;
    sel.innerHTML = '<option value="">+ Add provider…</option>';
    allProviders.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name + (p.type ? ` (${p.type})` : '');
        sel.appendChild(opt);
    });
}

function getSelectedProviderIds() {
    return [...document.querySelectorAll('#ruleProviderChips .rule-provider-chip')].map(c => c.dataset.id);
}

function renderProviderChips(ids) {
    const container = document.getElementById('ruleProviderChips');
    container.innerHTML = '';
    (ids || []).forEach(id => addProviderChip(id));
}

function addProviderChip(id) {
    const container = document.getElementById('ruleProviderChips');
    if (container.querySelector(`[data-id="${id}"]`)) return; // already added
    const p = allProviders.find(p => p.id === id);
    if (!p) return;
    const chip = document.createElement('span');
    chip.className = 'rule-provider-chip';
    chip.dataset.id = id;
    chip.innerHTML = `${esc(p.name)}<span class="rule-provider-chip-type"> (${esc(p.type)})</span><button type="button" class="rule-provider-chip-remove" onclick="Rules.removeProvider('${id}')" title="Remove">✕</button>`;
    container.appendChild(chip);
}

function addProvider(sel) {
    if (!sel.value) return;
    addProviderChip(sel.value);
    sel.value = '';
}

function removeProvider(id) {
    document.querySelector(`#ruleProviderChips [data-id="${id}"]`)?.remove();
}

async function loadTemplates() {
    try {
        const res = await fetch('/api/templates');
        if (res.ok) { allTemplates = await res.json(); populateSelect('ruleTemplateId', allTemplates, '— No template (raw payload) —'); }
    } catch {}
}

async function loadRules() {
    try {
        const res = await fetch('/api/rules');
        if (!res.ok) throw new Error();
        allRules = await res.json();
        renderGroupList();
        if (selectedGroupId) renderGroupDetail(selectedGroupId);
    } catch {}
}

function populateSelect(id, items, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name + (item.type ? ` (${item.type})` : '');
        sel.appendChild(opt);
    });
    if (current) sel.value = current;
}

// ── Group list (left panel) ──────────────────────────────────────────────────

function renderGroupList() {
    const el    = document.getElementById('ruleGroupList');
    const count = document.getElementById('ruleGroupCount');
    count.textContent = allGroups.length;

    if (allGroups.length === 0) {
        el.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <h3>No groups yet</h3>
            <p>Create your first group</p>
        </div>`;
        showRight('empty');
        return;
    }

    el.innerHTML = allGroups.map(g => {
        const n       = allRules.filter(r => r.groupId === g.id).length;
        const active  = selectedGroupId === g.id ? ' active' : '';
        const badge   = g.active
            ? '<span class="badge badge-success">Active</span>'
            : '<span class="badge badge-muted">Disabled</span>';
        return `<div class="split-panel-item${active}" onclick="Rules.selectGroup('${g.id}')">
            <div class="split-panel-item-name">${esc(g.name)}</div>
            <div class="split-panel-item-meta">${badge} <span class="badge badge-muted">${n} rule${n !== 1 ? 's' : ''}</span></div>
        </div>`;
    }).join('');
}

// ── Right panel visibility ───────────────────────────────────────────────────

function showRight(which) {
    const detail = document.getElementById('ruleGroupDetail');
    const empty  = document.getElementById('ruleRightEmpty');
    detail.classList.toggle('rg-hidden', which !== 'group');
    empty.classList.toggle('rg-hidden',  which !== 'empty');
}

// ── Accordion open/close ─────────────────────────────────────────────────────

function toggleAccordion(key) {
    if (openAccordions.has(key)) openAccordions.delete(key);
    else openAccordions.add(key);
    applyAccordions();
}

function applyAccordions() {
    ['settings', 'rules'].forEach(key => {
        const body    = document.getElementById(`rgBody${cap(key)}`);
        const chevron = document.getElementById(`rgChevron${cap(key)}`);
        const acc     = document.getElementById(`rgAccordion${cap(key)}`);
        if (!body) return;
        const open = openAccordions.has(key);
        body.classList.toggle('rg-hidden', !open);
        if (chevron) chevron.textContent = open ? '▾' : '▸';
        if (acc) acc.classList.toggle('rg-accordion-open', open);
    });
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Select group ─────────────────────────────────────────────────────────────

function selectGroup(id) {
    selectedGroupId = id;
    editingRuleId   = null;
    renderGroupList();
    renderGroupDetail(id);
    showRight('group');
    hideRuleForm();
}

function renderGroupDetail(groupId) {
    const g = allGroups.find(g => g.id === groupId);
    if (!g) return;

    // Populate settings fields
    document.getElementById('rgSettingsTitle').textContent = `${g.name} — Settings`;
    document.getElementById('ruleGrpName').value           = g.name;
    document.getElementById('ruleGrpDescription').value    = g.description || '';
    document.getElementById('ruleGrpMatchMode').value      = g.matchMode || 'all';
    document.getElementById('ruleGrpActiveToggle').checked = g.active !== false;
    document.getElementById('ruleGrpDeleteBtn').classList.remove('rg-hidden');

    // Settings badge (shown in header when collapsed)
    const modeBadge   = g.matchMode === 'first' ? '<span class="badge badge-accent">First match</span>' : '<span class="badge badge-muted">All fire</span>';
    const activeBadge = g.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Disabled</span>';
    document.getElementById('rgSettingsBadges').innerHTML = activeBadge + modeBadge;

    // Rules
    const groupRules = allRules.filter(r => r.groupId === groupId).sort((a, b) => a.order - b.order);
    const badge = groupRules.length ? `<span class="badge badge-muted">${groupRules.length}</span>` : '';
    document.getElementById('rgRulesBadge').innerHTML = badge;

    renderRuleAccordions(groupRules);
    applyAccordions();
}

// ── Rule accordions (nested inside Rules accordion) ──────────────────────────

function renderRuleAccordions(rules) {
    const container = document.getElementById('rgRuleList');
    // Rescue the form before wiping innerHTML (it may be inside container)
    const form = document.getElementById('rgRuleForm');
    if (form && container.contains(form)) container.after(form);

    if (rules.length === 0) {
        container.innerHTML = `<div class="rg-rules-empty">No rules yet — click <strong>+ New Rule</strong> to add one.</div>`;
        return;
    }

    container.innerHTML = rules.map((r, i) => {
        const source   = allSources.find(s => s.id === r.sourceId)?.name || 'Any source';
        const providerNames = (r.providerIds || []).map(id => allProviders.find(p => p.id === id)?.name || '(deleted)');
        const template = allTemplates.find(t => t.id === r.templateId)?.name || null;
        const evt      = !r.eventType || r.eventType === '*' ? 'All events' : r.eventType;
        const editing  = editingRuleId === r.id;

        const condBadge = r.conditions?.length
            ? `<span class="badge badge-muted">${r.conditions.length} cond${r.conditions.length > 1 ? 's' : ''}</span>`
            : '';

        const providerBadges = providerNames.map(n => `<span class="rg-rule-provider">→ ${esc(n)}</span>`).join('');

        return `<div class="rg-rule-item${editing ? ' rg-rule-item-open' : ''}" draggable="true"
                     data-rule-id="${r.id}" data-index="${i}"
                     ondragstart="Rules.onDragStart(event,${i})"
                     ondragover="Rules.onDragOver(event)"
                     ondrop="Rules.onDrop(event,${i})"
                     ondragend="Rules.onDragEnd(event)">
            <div class="rg-rule-item-header" onclick="Rules.toggleRuleItem('${r.id}')">
                <span class="rg-drag-handle" title="Drag to reorder">⠿</span>
                <span class="rg-rule-name">${esc(r.name)}</span>
                <span class="rg-rule-badges">
                    <span class="badge badge-accent">${esc(source)}</span>
                    <span class="badge badge-muted">${esc(evt)}</span>
                    ${condBadge}
                    ${providerBadges}
                    ${template ? `<span class="rg-rule-tpl">· ${esc(template)}</span>` : ''}
                </span>
                <label class="toggle rg-header-toggle" onclick="event.stopPropagation()" title="Toggle rule active">
                    <input type="checkbox" ${r.active !== false ? 'checked' : ''} onchange="Rules.toggleRuleActive('${r.id}', this)">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>`;
    }).join('');
}

function toggleRuleItem(ruleId) {
    if (editingRuleId === ruleId) {
        editingRuleId = null;
        hideRuleForm();
        renderGroupDetail(selectedGroupId);
        return;
    }
    editingRuleId = ruleId;
    renderGroupDetail(selectedGroupId);
    populateRuleForm(ruleId);
    showRuleForm(ruleId);
}

// ── Rule form ────────────────────────────────────────────────────────────────

function newRule(event) {
    event?.stopPropagation();
    if (!selectedGroupId) return;
    editingRuleId = null;
    renderGroupDetail(selectedGroupId);
    clearRuleFields();
    document.getElementById('rgRuleFormTitle').textContent    = 'New Rule';
    document.getElementById('ruleDeleteBtn').classList.add('rg-hidden');
    document.getElementById('ruleDuplicateBtn').classList.add('rg-hidden');
    document.getElementById('ruleSaveBtn').textContent = 'Save Rule';
    document.getElementById('ruleDryRunBtn').disabled = true;
    showRuleForm();
    if (!openAccordions.has('rules')) { openAccordions.add('rules'); applyAccordions(); }
}

function populateRuleForm(id) {
    const r = allRules.find(r => r.id === id);
    if (!r) return;
    document.getElementById('ruleName').value           = r.name;
    document.getElementById('ruleSourceId').value       = r.sourceId || '';
    onRuleSourceChange();
    document.getElementById('ruleEventType').value      = r.eventType === '*' ? '' : (r.eventType || '');
    renderProviderChips(r.providerIds || []);
    document.getElementById('ruleTemplateId').value     = r.templateId || '';
    document.getElementById('ruleConditionMode').value  = r.conditionMode || 'and';
    renderConditions(r.conditions || []);
    document.getElementById('rgRuleFormTitle').textContent    = `Editing — ${r.name}`;
    document.getElementById('ruleDeleteBtn').classList.remove('rg-hidden');
    document.getElementById('ruleDuplicateBtn').classList.remove('rg-hidden');
    document.getElementById('ruleSaveBtn').textContent = 'Update Rule';
    document.getElementById('ruleDryRunBtn').disabled = false;
    document.getElementById('dryRunPanel').classList.add('rg-hidden');
}

function showRuleForm(ruleId) {
    const form = document.getElementById('rgRuleForm');
    form.classList.remove('rg-hidden');
    if (ruleId) {
        // Move form inside the expanded rule item
        const item = document.querySelector(`.rg-rule-item[data-rule-id="${ruleId}"]`);
        if (item) item.appendChild(form);
    } else {
        // New rule — place form below the list
        document.getElementById('rgRuleList').after(form);
    }
}
function hideRuleForm() {
    const form = document.getElementById('rgRuleForm');
    form.classList.add('rg-hidden');
    // Return form to its default position (after rgRuleList) so it's ready for next use
    document.getElementById('rgRuleList')?.after(form);
}

function closeRuleForm() {
    editingRuleId = null;
    hideRuleForm();
    renderGroupDetail(selectedGroupId);
}

function clearRuleFields() {
    ['ruleName', 'ruleEventType'].forEach(id => document.getElementById(id).value = '');
    ['ruleSourceId', 'ruleTemplateId', 'ruleConditionMode'].forEach(id => document.getElementById(id).value = '');
    renderProviderChips([]);
    document.getElementById('dryRunPanel').classList.add('rg-hidden');
    document.getElementById('ruleTokenHintsPanel').classList.add('rg-hidden');
    renderConditions([]);
}

function clearForm() { closeRuleForm(); }

// ── Group save/delete ────────────────────────────────────────────────────────

function newGroup() {
    selectedGroupId = null;
    renderGroupList();
    document.getElementById('rgSettingsTitle').textContent = 'Group Settings';
    document.getElementById('ruleGrpName').value        = '';
    document.getElementById('ruleGrpDescription').value = '';
    document.getElementById('ruleGrpMatchMode').value   = 'all';
    document.getElementById('ruleGrpActiveToggle').checked = true;
    document.getElementById('ruleGrpDeleteBtn').classList.add('rg-hidden');
    document.getElementById('rgSettingsBadges').innerHTML = '';
    document.getElementById('rgRulesBadge').innerHTML   = '';
    document.getElementById('rgRuleList').innerHTML     = '';
    hideRuleForm();
    openAccordions.add('settings');
    openAccordions.delete('rules');
    applyAccordions();
    showRight('group');
}

async function saveGroup() {
    const name = document.getElementById('ruleGrpName').value.trim();
    if (!name) { await alert('Group name is required'); return; }

    const isNew  = !selectedGroupId || !allGroups.find(g => g.id === selectedGroupId);
    const method = isNew ? 'POST' : 'PUT';
    const url    = isNew ? '/api/groups' : `/api/groups/${selectedGroupId}`;

    const payload = {
        name,
        description: document.getElementById('ruleGrpDescription').value.trim(),
        matchMode:   document.getElementById('ruleGrpMatchMode').value,
        active:      document.getElementById('ruleGrpActiveToggle').checked,
    };

    try {
        const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        if (isNew) selectedGroupId = data.id;
        await loadGroups();
        await loadRules();
        showRight('group');
        renderGroupDetail(selectedGroupId);
        window.showToast(isNew ? `Group "${name}" created` : `Group "${name}" updated`);
    } catch (err) { await alert(err.message); }
}

async function deleteGroup() {
    const g = allGroups.find(g => g.id === selectedGroupId);
    const ruleCount = allRules.filter(r => r.groupId === selectedGroupId).length;
    const msg = ruleCount > 0
        ? `Delete group "${g?.name}" and its ${ruleCount} rule${ruleCount !== 1 ? 's' : ''}? This cannot be undone.`
        : `Delete group "${g?.name}"? This cannot be undone.`;
    if (!await confirm(msg, 'Delete Group')) return;
    try {
        const url = `/api/groups/${selectedGroupId}${ruleCount > 0 ? '?deleteRules=true' : ''}`;
        const res  = await fetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        const name = g?.name || 'Group';
        selectedGroupId = null;
        await loadGroups();
        await loadRules();
        showRight('empty');
        const detail = data.rulesDeleted > 0 ? ` and ${data.rulesDeleted} rule${data.rulesDeleted !== 1 ? 's' : ''}` : '';
        window.showToast(`"${name}"${detail} deleted`, 'info');
    } catch (err) { await alert(err.message); }
}

// ── Rule save/delete/duplicate ───────────────────────────────────────────────

async function saveRule() {
    const name        = document.getElementById('ruleName').value.trim();
    const providerIds = getSelectedProviderIds();
    if (!name)                    { await alert('Rule name is required');          return; }
    if (!selectedGroupId)         { await alert('No group selected');              return; }
    if (providerIds.length === 0) { await alert('At least one provider required'); return; }

    const payload = {
        name,
        groupId:       selectedGroupId,
        sourceId:      document.getElementById('ruleSourceId').value   || null,
        eventType:     document.getElementById('ruleEventType').value.trim() || '*',
        conditions:    readConditions(),
        conditionMode: document.getElementById('ruleConditionMode').value,
        providerIds,
        templateId:    document.getElementById('ruleTemplateId').value || null,
        active:        editingRuleId ? (allRules.find(r => r.id === editingRuleId)?.active ?? true) : true,
    };

    try {
        const isNew = !editingRuleId;
        const res   = await fetch(
            isNew ? '/api/rules' : `/api/rules/${editingRuleId}`,
            { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        if (isNew) editingRuleId = data.id;
        await loadRules();
        renderGroupDetail(selectedGroupId);
        showRuleForm(editingRuleId);
        populateRuleForm(editingRuleId);
        window.showToast(isNew ? `Rule "${name}" created` : `Rule "${name}" updated`);
    } catch (err) { await alert(err.message); }
}

async function deleteRule() {
    if (!editingRuleId) return;
    const r = allRules.find(r => r.id === editingRuleId);
    if (!await confirm(`Delete rule "${r?.name}"? This cannot be undone.`, 'Delete Rule')) return;
    try {
        const res  = await fetch(`/api/rules/${editingRuleId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        const name = r?.name || 'Rule';
        editingRuleId = null;
        hideRuleForm();
        await loadRules();
        renderGroupDetail(selectedGroupId);
        window.showToast(`"${name}" deleted`, 'info');
    } catch (err) { await alert(err.message); }
}

async function duplicateRule() {
    if (!editingRuleId) return;
    const r = allRules.find(r => r.id === editingRuleId);
    if (!r) return;
    try {
        const res  = await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `${r.name} (copy)`, groupId: r.groupId, sourceId: r.sourceId, eventType: r.eventType, conditions: r.conditions, conditionMode: r.conditionMode, providerIds: r.providerIds || [], templateId: r.templateId, active: r.active }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Duplicate failed');
        await loadRules();
        editingRuleId = data.id;
        renderGroupDetail(selectedGroupId);
        showRuleForm(data.id);
        populateRuleForm(data.id);
        window.showToast('Rule duplicated');
    } catch (err) { await alert(err.message); }
}

// ── Drag-to-reorder ──────────────────────────────────────────────────────────

function onDragStart(event, index) {
    dragSrcIndex = index;
    event.currentTarget.classList.add('rg-dragging');
    event.dataTransfer.effectAllowed = 'move';
}

function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.rg-rule-item').forEach(el => el.classList.remove('rg-drag-over'));
    event.currentTarget.closest('.rg-rule-item')?.classList.add('rg-drag-over');
}

function onDrop(event, targetIndex) {
    event.preventDefault();
    if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
    const groupRules = allRules.filter(r => r.groupId === selectedGroupId).sort((a, b) => a.order - b.order);
    const moved = groupRules.splice(dragSrcIndex, 1)[0];
    groupRules.splice(targetIndex, 0, moved);
    const reorderPayload = groupRules.map((r, i) => ({ id: r.id, order: i + 1 }));
    fetch('/api/rules/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reorderPayload),
    }).then(() => loadRules());
}

function onDragEnd(_event) {
    dragSrcIndex = null;
    document.querySelectorAll('.rg-rule-item').forEach(el => {
        el.classList.remove('rg-dragging', 'rg-drag-over');
    });
}

// ── Conditions builder ───────────────────────────────────────────────────────

function renderConditions(conditions) {
    const container = document.getElementById('ruleConditions');
    const modeRow   = document.getElementById('ruleConditionModeRow');
    container.innerHTML = '';
    conditions.forEach((c, i) => container.appendChild(buildConditionRow(c, i)));
    modeRow.classList.toggle('rg-hidden', conditions.length <= 1);
}

function buildConditionRow(c = {}, index) {
    const row = document.createElement('div');
    row.className    = 'rule-condition-row';
    row.dataset.index = index;
    const isValueLess = VALUE_LESS_OPS.has(c.operator);
    row.innerHTML = `
        <input type="text" class="rule-cond-field" placeholder="field (e.g. series.title)" value="${esc(c.field || '')}">
        <select class="rule-cond-operator" title="Operator" onchange="Rules.onOperatorChange(this)">
            ${OPERATORS.map(op => `<option value="${op.value}"${c.operator === op.value ? ' selected' : ''}>${op.label}</option>`).join('')}
        </select>
        <input type="text" class="rule-cond-value${isValueLess ? ' rule-cond-value-hidden' : ''}" placeholder="value" value="${esc(c.value || '')}">
        <button type="button" class="rule-cond-remove" onclick="Rules.removeCondition(this)" title="Remove">✕</button>
    `;
    return row;
}

function addCondition() {
    const container = document.getElementById('ruleConditions');
    container.appendChild(buildConditionRow({}, container.children.length));
    document.getElementById('ruleConditionModeRow').classList.toggle('rg-hidden', container.children.length <= 1);
}

function removeCondition(btn) {
    btn.closest('.rule-condition-row').remove();
    const container = document.getElementById('ruleConditions');
    document.getElementById('ruleConditionModeRow').classList.toggle('rg-hidden', container.children.length <= 1);
}

function onOperatorChange(sel) {
    const valueInput = sel.closest('.rule-condition-row').querySelector('.rule-cond-value');
    if (VALUE_LESS_OPS.has(sel.value)) {
        valueInput.classList.add('rule-cond-value-hidden');
        valueInput.value = '';
    } else {
        valueInput.classList.remove('rule-cond-value-hidden');
    }
}

function readConditions() {
    const rows = document.querySelectorAll('#ruleConditions .rule-condition-row');
    const out  = [];
    rows.forEach(row => {
        const field    = row.querySelector('.rule-cond-field').value.trim();
        const operator = row.querySelector('.rule-cond-operator').value;
        const value    = row.querySelector('.rule-cond-value').value.trim();
        if (field && operator) out.push({ field, operator, value });
    });
    return out;
}

// ── Instant active toggles ───────────────────────────────────────────────────

async function toggleGroupActive(checkbox) {
    if (!selectedGroupId) return;
    const active = checkbox.checked;
    if (active) {
        const hasActiveRule = allRules.some(r => r.groupId === selectedGroupId && r.active !== false);
        if (!hasActiveRule) {
            checkbox.checked = false;
            await alert('Enable at least one rule in this group before activating it.');
            return;
        }
    }
    try {
        const res  = await fetch(`/api/groups/${selectedGroupId}/toggle`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Toggle failed');
        // Sync local state
        const g = allGroups.find(g => g.id === selectedGroupId);
        if (g) g.active = data.active;
        checkbox.checked = data.active;
        const modeBadge   = (g?.matchMode === 'first') ? '<span class="badge badge-accent">First match</span>' : '<span class="badge badge-muted">All fire</span>';
        const activeBadge = data.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Disabled</span>';
        document.getElementById('rgSettingsBadges').innerHTML = activeBadge + modeBadge;
        renderGroupList();
        window.showToast(data.active ? 'Group enabled' : 'Group disabled', 'info');
    } catch (err) {
        checkbox.checked = !active; // revert
        await alert(err.message);
    }
}

async function toggleRuleActive(ruleId, checkbox) {
    const active = checkbox.checked;
    try {
        const res  = await fetch(`/api/rules/${ruleId}/toggle`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Toggle failed');
        const r = allRules.find(r => r.id === ruleId);
        if (r) r.active = data.active;
        checkbox.checked = data.active;
        window.showToast(data.active ? 'Rule enabled' : 'Rule disabled', 'info');
    } catch (err) {
        checkbox.checked = !active; // revert
        await alert(err.message);
    }
}

// ── Dry run ──────────────────────────────────────────────────────────────────

async function dryRun() {
    const sourceId = document.getElementById('ruleSourceId').value;
    if (!sourceId) { await alert('Select a source to run a dry run'); return; }
    const eventType = document.getElementById('ruleEventType').value.trim() || 'unknown';
    try {
        const res  = await fetch('/api/rules/dry-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId, eventType }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Dry run failed');
        const panel   = document.getElementById('dryRunPanel');
        const content = document.getElementById('dryRunContent');
        content.innerHTML = data.matched === 0
            ? '<p class="form-hint">No rules would match this source + event type combination.</p>'
            : `<p class="rule-dry-run-summary">${data.matched} rule(s) would fire:</p>` +
              data.rules.map((r, i) => `<div class="rule-dry-run-row">
                  <span class="badge badge-muted">#${i + 1}</span>
                  <strong class="rule-dry-run-name">${esc(r.name)}</strong>
                  <span class="badge badge-muted">${esc(r.groupName)}</span>
                  <span class="rule-dry-run-meta">→ ${(r.providerNames || []).map(n => esc(n)).join(', ')}</span>
                  ${r.templateName !== '(none)' ? `<span class="rule-dry-run-tpl">· ${esc(r.templateName)}</span>` : ''}
              </div>`).join('');
        panel.classList.remove('rg-hidden');
    } catch (err) { await alert(err.message); }
}

// ── Token hints ──────────────────────────────────────────────────────────────

async function onRuleSourceChange() {
    const sourceId = document.getElementById('ruleSourceId').value;
    const panel    = document.getElementById('ruleTokenHintsPanel');
    const list     = document.getElementById('ruleTokenHintsList');
    const chevron  = document.getElementById('ruleHintsChevron');
    if (!sourceId) { panel.classList.add('rg-hidden'); return; }
    try {
        const res = await fetch(`/api/templates/token-hints/${sourceId}`);
        if (!res.ok) { panel.classList.add('rg-hidden'); return; }
        const data = await res.json();
        const source = allSources.find(s => s.id === sourceId);
        document.getElementById('ruleTokenHintsSourceName').textContent = source?.name || '';
        list.innerHTML = '';
        list.classList.add('tpl-hidden');
        chevron.textContent = '▸';
        renderTokenHints(list, data, null);
        panel.classList.remove('rg-hidden');
    } catch { panel.classList.add('rg-hidden'); }
}

function toggleRuleHints() {
    const list    = document.getElementById('ruleTokenHintsList');
    const chevron = document.getElementById('ruleHintsChevron');
    const open    = list.classList.toggle('tpl-hidden');
    chevron.textContent = open ? '▸' : '▾';
}


// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function refreshSources() { loadSources(); }

window.Rules = {
    init, selectGroup, refreshSources,
    toggleAccordion, toggleRuleItem,
    newGroup, newRule, saveRule, deleteRule, duplicateRule, closeRuleForm, clearForm,
    saveGroup, deleteGroup, toggleGroupActive, toggleRuleActive,
    dryRun, addCondition, removeCondition, onOperatorChange,
    onDragStart, onDragOver, onDrop, onDragEnd,
    onRuleSourceChange, toggleRuleHints,
    addProvider, removeProvider,
};

init();
