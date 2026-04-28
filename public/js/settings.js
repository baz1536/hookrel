let users = [];
let editingUserId = null;

async function init() {
    await Promise.all([loadSettings(), loadEncryptionStatus(), loadUsers()]);
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const { retentionDays } = await res.json();
        const rd = document.getElementById('retentionDays');
        if (rd) rd.value = retentionDays ?? 90;
    } catch {}
}

async function loadEncryptionStatus() {
    const el = document.getElementById('encryptionStatus');
    if (!el) return;
    try {
        const res = await fetch('/api/settings/encryption-status');
        if (!res.ok) throw new Error();
        const { total, encrypted, unencrypted, keyConfigured } = await res.json();
        el.innerHTML = `
            <div class="settings-enc-row">
                <span class="settings-enc-label">Encryption key</span>
                <span class="badge ${keyConfigured ? 'badge-success' : 'badge-error'}">${keyConfigured ? 'Configured' : 'Not set'}</span>
            </div>
            <div class="settings-enc-row">
                <span class="settings-enc-label">Sensitive fields</span>
                <span class="settings-enc-value">${encrypted} / ${total} encrypted${unencrypted > 0 ? ` <span class="badge badge-warning">${unencrypted} unencrypted</span>` : ''}</span>
            </div>`;
    } catch {
        el.innerHTML = '<p class="loading">Failed to load encryption status</p>';
    }
}

async function saveRetention() {
    const days = parseInt(document.getElementById('retentionDays')?.value);
    if (!days || days < 1) { showResult('retentionResult', 'Enter a valid number of days', false); return; }
    try {
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ retentionDays: days }),
        });
        const d = await res.json();
        showResult('retentionResult', res.ok ? `Saved — logs older than ${days} days will be removed` : (d.error || 'Save failed'), res.ok);
    } catch { showResult('retentionResult', 'Request failed', false); }
}

async function changePassword() {
    const current = document.getElementById('currentPassword')?.value;
    const next    = document.getElementById('newPassword')?.value;
    const confirm = document.getElementById('confirmPassword')?.value;

    if (!current || !next || !confirm) { showResult('passwordResult', 'All fields are required', false); return; }
    if (next !== confirm) { showResult('passwordResult', 'New passwords do not match', false); return; }
    if (next.length < 8)  { showResult('passwordResult', 'New password must be at least 8 characters', false); return; }

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });
        const d = await res.json();
        if (res.ok) {
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        }
        showResult('passwordResult', res.ok ? 'Password updated successfully' : (d.error || 'Update failed'), res.ok);
    } catch { showResult('passwordResult', 'Request failed', false); }
}

// ── User management ───────────────────────────────────────────────────────────

async function loadUsers() {
    try {
        const res = await fetch('/api/auth/users');
        if (!res.ok) return;
        users = await res.json();
        renderUsers();
    } catch {}
}

function renderUsers() {
    const el = document.getElementById('userList');
    if (!el) return;
    if (!users.length) {
        el.innerHTML = '<p class="form-hint settings-users-empty">No users found.</p>';
        return;
    }
    const currentUsername = window.currentUser?.username;
    el.innerHTML = `<table class="settings-users-table">
        <thead><tr><td>Username</td><td>Role</td><td></td></tr></thead>
        <tbody>${users.map(u => `
            <tr class="${editingUserId === u._id ? 'settings-users-row-active' : ''}">
                <td>${esc(u.username)}${u.username === currentUsername ? ' <span class="badge badge-muted">you</span>' : ''}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-accent' : 'badge-muted'}">${esc(u.role)}</span></td>
                <td class="settings-users-actions"><button type="button" class="btn-secondary btn-sm" onclick="Settings.editUser('${u._id}')">Edit</button></td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

function newUser() {
    editingUserId = null;
    document.getElementById('userFormTitle').textContent = 'New User';
    document.getElementById('userFormUsername').value = '';
    document.getElementById('userFormPassword').value = '';
    document.getElementById('userFormRole').value = 'user';
    document.getElementById('userFormUsername').disabled = false;
    hide('userFormPasswordHint');
    hide('userDeleteBtn');
    hide('userFormResult');
    document.getElementById('userSaveBtn').textContent = 'Save User';
    show('userForm');
    document.getElementById('userFormUsername').focus();
    renderUsers();
}

function editUser(id) {
    const u = users.find(x => x._id === id);
    if (!u) return;
    editingUserId = id;
    document.getElementById('userFormTitle').textContent = `Edit — ${u.username}`;
    document.getElementById('userFormUsername').value = u.username;
    document.getElementById('userFormUsername').disabled = true;
    document.getElementById('userFormPassword').value = '';
    document.getElementById('userFormRole').value = u.role;
    show('userFormPasswordHint');
    show('userDeleteBtn');
    hide('userFormResult');
    document.getElementById('userSaveBtn').textContent = 'Update User';
    show('userForm');
    renderUsers();
}

function cancelUser() {
    editingUserId = null;
    hide('userForm');
    renderUsers();
}

async function saveUser() {
    const username = document.getElementById('userFormUsername')?.value.trim();
    const password = document.getElementById('userFormPassword')?.value;
    const role     = document.getElementById('userFormRole')?.value;

    if (!editingUserId && !username) { showResult('userFormResult', 'Username is required', false); return; }
    if (!editingUserId && (!password || password.length < 8)) { showResult('userFormResult', 'Password must be at least 8 characters', false); return; }
    if (editingUserId && password && password.length < 8) { showResult('userFormResult', 'Password must be at least 8 characters', false); return; }

    try {
        let res;
        if (editingUserId) {
            const body = { role };
            if (password) body.password = password;
            res = await fetch(`/api/auth/users/${editingUserId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } else {
            res = await fetch('/api/auth/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role }),
            });
        }
        const d = await res.json();
        if (!res.ok) { showResult('userFormResult', d.error || 'Save failed', false); return; }
        showResult('userFormResult', editingUserId ? 'User updated' : 'User created', true);
        await loadUsers();
        if (!editingUserId) cancelUser();
    } catch { showResult('userFormResult', 'Request failed', false); }
}

async function deleteUser() {
    if (!editingUserId) return;
    const u = users.find(x => x._id === editingUserId);
    if (!await window.showConfirm(`Delete user "${u?.username}"? This cannot be undone.`, 'Delete User')) return;
    try {
        const res = await fetch(`/api/auth/users/${editingUserId}`, { method: 'DELETE' });
        const d = await res.json();
        if (!res.ok) { showResult('userFormResult', d.error || 'Delete failed', false); return; }
        cancelUser();
        await loadUsers();
    } catch { showResult('userFormResult', 'Request failed', false); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showResult(id, msg, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `settings-result ${ok ? 'settings-result-ok' : 'settings-result-err'}`;
    if (ok) setTimeout(() => { el.className = 'settings-result settings-hidden'; }, 5000);
}

function show(id) { document.getElementById(id)?.classList.remove('settings-hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('settings-hidden'); }
function esc(str) { return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

window.Settings = { init, saveRetention, changePassword, newUser, editUser, cancelUser, saveUser, deleteUser };

init();
