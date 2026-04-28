let allGroups = [];
let editingId = null;

const alert   = (msg) => window.showAlert(msg);
const confirm = (msg, title, ok) => window.showConfirm(msg, title, ok);

async function init() {
    await loadGroups();
}

async function loadGroups() {
    try {
        const res = await fetch('/api/groups');
        if (!res.ok) throw new Error();
        allGroups = await res.json();
        renderList();
    } catch {
        document.getElementById('groupList').innerHTML =
            '<p class="loading" style="padding:16px">Failed to load groups</p>';
    }
}

function renderList() {
    const el = document.getElementById('groupList');
    const count = document.getElementById('groupCount');
    count.textContent = allGroups.length;

    if (allGroups.length === 0) {
        el.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <h3>No groups yet</h3>
            <p>Create a group to start organising rules</p>
        </div>`;
        return;
    }

    el.innerHTML = allGroups.map(g => {
        const active = editingId === g.id ? ' active' : '';
        const statusBadge = g.active
            ? '<span class="badge badge-success">Active</span>'
            : '<span class="badge badge-muted">Disabled</span>';
        const modeBadge = g.matchMode === 'first'
            ? '<span class="badge badge-accent">First match</span>'
            : '<span class="badge badge-muted">All fire</span>';

        return `<div class="split-panel-item${active}" onclick="Groups.editGroup('${g.id}')">
            <div class="rule-item-info">
                <div class="split-panel-item-name">${esc(g.name)}</div>
                <div class="rule-item-badges">
                    ${statusBadge}
                    ${modeBadge}
                    ${g.description ? `<span class="grp-description">${esc(g.description)}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function newGroup() {
    editingId = null;
    showForm();
    clearFields();
    document.getElementById('groupEditingBanner').style.display = 'none';
    document.getElementById('groupDeleteBtn').style.display = 'none';
    document.getElementById('groupSaveBtn').textContent = 'Save Group';
    document.getElementById('groupRuleCount').classList.add('grp-hidden');
    renderList();
    document.getElementById('groupName')?.focus();
}

function editGroup(id) {
    const g = allGroups.find(g => g.id === id);
    if (!g) return;
    editingId = id;
    showForm();

    document.getElementById('groupName').value = g.name;
    document.getElementById('groupDescription').value = g.description || '';
    document.getElementById('groupMatchMode').value = g.matchMode || 'all';
    document.getElementById('groupActive').checked = g.active !== false;

    document.getElementById('groupEditingBanner').style.display = '';
    document.getElementById('groupEditingName').textContent = g.name;
    document.getElementById('groupDeleteBtn').style.display = '';
    document.getElementById('groupSaveBtn').textContent = 'Update Group';

    loadRuleCount(id);
    renderList();
}

async function loadRuleCount(groupId) {
    const el = document.getElementById('groupRuleCount');
    try {
        const res = await fetch('/api/rules');
        if (!res.ok) return;
        const rules = await res.json();
        const count = rules.filter(r => r.groupId === groupId).length;
        el.textContent = `This group contains ${count} rule${count === 1 ? '' : 's'}.`;
        el.classList.remove('grp-hidden');
    } catch {}
}

function showForm() {
    document.getElementById('groupForm').style.display = '';
    document.getElementById('groupFormEmpty').style.display = 'none';
}

function clearFields() {
    document.getElementById('groupName').value = '';
    document.getElementById('groupDescription').value = '';
    document.getElementById('groupMatchMode').value = 'all';
    document.getElementById('groupActive').checked = true;
}

function clearForm() {
    editingId = null;
    clearFields();
    document.getElementById('groupForm').style.display = 'none';
    document.getElementById('groupFormEmpty').style.display = '';
    document.getElementById('groupEditingBanner').style.display = 'none';
    document.getElementById('groupDeleteBtn').style.display = 'none';
    document.getElementById('groupRuleCount').classList.add('grp-hidden');
    renderList();
}

async function saveGroup() {
    const name = document.getElementById('groupName').value.trim();
    if (!name) { await alert('Group name is required'); return; }

    const payload = {
        name,
        description: document.getElementById('groupDescription').value.trim(),
        matchMode: document.getElementById('groupMatchMode').value,
        active: document.getElementById('groupActive').checked,
    };

    try {
        const res = await fetch(
            editingId ? `/api/groups/${editingId}` : '/api/groups',
            { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');

        const isNew = !editingId;
        if (isNew) {
            editingId = data.id;
            document.getElementById('groupDeleteBtn').style.display = '';
            document.getElementById('groupSaveBtn').textContent = 'Update Group';
            document.getElementById('groupEditingBanner').style.display = '';
            document.getElementById('groupEditingName').textContent = name;
        }
        await loadGroups();
        window.showToast(isNew ? `Group "${name}" created` : `Group "${name}" updated`);
    } catch (err) {
        await alert(err.message);
    }
}

async function deleteGroup() {
    if (!editingId) return;
    const g = allGroups.find(g => g.id === editingId);
    if (!await confirm(`Delete group "${g?.name}"? This cannot be undone.`, 'Delete Group')) return;

    try {
        const res = await fetch(`/api/groups/${editingId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        const name = g?.name || 'Group';
        clearForm();
        await loadGroups();
        window.showToast(`"${name}" deleted`, 'info');
    } catch (err) {
        await alert(err.message);
    }
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.Groups = { init, newGroup, editGroup, saveGroup, deleteGroup, clearForm };

init();
