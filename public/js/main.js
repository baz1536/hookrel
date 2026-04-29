/* global requestAnimationFrame */
import { loadAboutInfo } from './about.js';

const tabPartials = {
    dashboard: '/partials/dashboard.html',
    rules:     '/partials/rules.html',
    sources:   '/partials/sources.html',
    providers: '/partials/providers.html',
    templates: '/partials/templates.html',
    logs:      '/partials/logs.html',
    settings:  '/partials/settings.html',
    about:     '/partials/about.html',
};

const loadedTabs = new Set();

export async function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav-item, .mobile-nav-item').forEach(el => el.classList.remove('active'));

    const tabEl = document.getElementById(`${tabName}-tab`);
    if (tabEl) tabEl.classList.add('active');

    document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(el => el.classList.add('active'));

    if (!loadedTabs.has(tabName) && tabPartials[tabName]) {
        const response = await fetch(tabPartials[tabName]);
        const html = await response.text();
        // innerHTML won't execute scripts — parse and re-inject them
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        tabEl.innerHTML = '';
        tmp.childNodes.forEach(node => {
            if (node.nodeName === 'SCRIPT') {
                const s = document.createElement('script');
                if (node.src) s.src = node.src;
                if (node.type) s.type = node.type;
                if (!node.src) s.textContent = node.textContent;
                tabEl.appendChild(s);
            } else {
                tabEl.appendChild(node.cloneNode(true));
            }
        });
        loadedTabs.add(tabName);
    }

    if (tabName === 'about') loadAboutInfo();
    if (tabName === 'templates' && window.Templates) window.Templates.refreshSources();
    if (tabName === 'rules'     && window.Rules)     window.Rules.refreshSources();
}

export function closeModal(event) {
    if (!event || event.target === event.currentTarget) {
        document.getElementById('connectionModal').style.display = 'none';
    }
}

export function showModal(iconClass, title, body) {
    const iconEl = document.getElementById('modalIcon');
    iconEl.className = `modal-icon ${iconClass || 'info'}`;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    document.getElementById('connectionModal').style.display = 'flex';
}

// showAlert — replaces alert(). Returns a promise that resolves when dismissed.
export function showAlert(message, title = 'Notice', iconClass = 'info') {
    return new Promise(resolve => {
        showModal(iconClass, title, message);
        const btn = document.getElementById('connectionModal').querySelector('.btn-primary');
        const original = btn.onclick;
        btn.onclick = () => { closeModal(); btn.onclick = original; resolve(); };
    });
}

// showConfirm — replaces confirm(). Returns a promise that resolves true/false.
export function showConfirm(message, title = 'Confirm', okLabel = 'Delete') {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalBody').textContent = message;
        const okBtn = document.getElementById('confirmModalOk');
        okBtn.textContent = okLabel;
        modal.style.display = 'flex';

        function finish(result) {
            modal.style.display = 'none';
            okBtn.onclick = null;
            document.getElementById('confirmModalCancel').onclick = null;
            modal.onclick = null;
            resolve(result);
        }

        okBtn.onclick = () => finish(true);
        document.getElementById('confirmModalCancel').onclick = () => finish(false);
        modal.onclick = (e) => { if (e.target === modal) finish(false); };
    });
}

export function openHelp(title, html) {
    document.getElementById('helpDrawerTitle').textContent = title;
    document.getElementById('helpDrawerBody').innerHTML = html;
    document.getElementById('helpDrawer').classList.add('help-drawer-open');
    document.getElementById('helpDrawerOverlay').classList.add('help-drawer-overlay-open');
}

export function closeHelp() {
    document.getElementById('helpDrawer').classList.remove('help-drawer-open');
    document.getElementById('helpDrawerOverlay').classList.remove('help-drawer-overlay-open');
}

export function logout() {
    fetch('/api/auth/logout', { method: 'POST' })
        .finally(() => { window.location.href = '/login.html'; });
}

// showToast — non-blocking feedback. type: 'success' | 'error' | 'info'
export function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

export function applyTheme(themeId) {
    const link = document.getElementById('app-theme');
    if (!link) return;
    if (!themeId) {
        link.removeAttribute('href');
    } else {
        link.href = `/css/themes/${themeId}.css`;
    }
}

// Expose to inline onclick handlers and module scripts
window.switchTab = switchTab;
window.closeModal = closeModal;
window.showAlert = showAlert;
window.showToast = showToast;
window.showConfirm = showConfirm;
window.logout = logout;
window.openHelp = openHelp;
window.closeHelp = closeHelp;
window.applyTheme = applyTheme;

// Boot — verify session then load
let currentUser = null;

async function boot() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { window.location.replace('/login.html'); return; }
        currentUser = await res.json();
    } catch {
        window.location.replace('/login.html');
        return;
    }

    applyTheme(currentUser.theme || '');

    // Hide admin-only nav items for regular users
    if (currentUser.role !== 'admin') {
        document.querySelectorAll('[data-admin-only]').forEach(el => el.style.display = 'none');
    }

    // Hide logout when auth is disabled
    if (currentUser.openAccess) {
        document.querySelectorAll('[data-auth-only]').forEach(el => el.style.display = 'none');
    }

    switchTab('dashboard');
}

window.currentUser = currentUser;
boot();
