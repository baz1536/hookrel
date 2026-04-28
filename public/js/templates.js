import { renderTokenHints } from './tokenHints.js';

let allTemplates = [];
let allSources = [];
let editingId = null;
let tplEditor = null;
let bodyMode = 'html'; // 'html' | 'source'
let isDirty = false;
let templateGroupStartMode = 'collapsed';
const collapsedGroups = new Set();
const knownGroups = new Set();

const GROUP_COLOURS = [
    '#c9a84c', '#5b8dd9', '#5baa7a', '#c95b8d', '#8d5bc9',
    '#5bc9c9', '#c9705b', '#7ac95b', '#c9c95b', '#5b7ac9',
];

const alert   = (msg) => window.showAlert(msg);
const confirm = (msg, title, ok) => window.showConfirm(msg, title, ok);

function tplShow(id) { document.getElementById(id)?.classList.remove('tpl-hidden'); }
function tplHide(id) { document.getElementById(id)?.classList.add('tpl-hidden'); }
function markDirty() { isDirty = true; }
function clearDirty() { isDirty = false; }
async function guardDirty() {
    if (!isDirty) return true;
    return confirm('You have unsaved changes. Discard them and continue?', 'Unsaved Changes', 'Discard');
}

function getBodyHtml() {
    if (bodyMode === 'source') return document.getElementById('tplBodySource')?.value || '';
    return tplEditor ? tplEditor.getHTML() : '';
}

function getBodyPlain() {
    return document.getElementById('tplBodyPlain')?.value || '';
}

function setBodyHtml(content) {
    const isFullDoc = /^\s*<!DOCTYPE|^\s*<html/i.test(content || '');
    if (isFullDoc) {
        if (bodyMode !== 'source') setBodyMode('source', true);
        const ta = document.getElementById('tplBodySource');
        if (ta) ta.value = content || '';
    } else {
        if (bodyMode !== 'html') setBodyMode('html', true);
        if (tplEditor) tplEditor.commands.setContent(content || '');
    }
    syncHtmlButtonState();
}

function syncHtmlButtonState() {
    const sourceEl = document.getElementById('tplBodySource');
    const htmlBtn  = document.getElementById('tplModeHtml');
    if (!sourceEl || !htmlBtn) return;
    const hasSourceContent = sourceEl.value.trim().length > 0;
    htmlBtn.style.display = hasSourceContent ? 'none' : '';
}

async function setBodyMode(mode, silent = false) {
    if (!silent && mode === 'source' && bodyMode !== 'source') {
        const ok = await confirm(
            'Switching to Source mode lets you edit raw HTML directly, but the visual editor will be unavailable until you switch back to HTML mode. Any content already in the editor will be preserved.\n\nSwitch to Source mode?',
            'Switch to Source Mode?',
            'Switch to Source'
        );
        if (!ok) return;
    }
    const current = getBodyHtml();
    bodyMode = mode;

    const editorEl  = document.getElementById('tplBodyEditor');
    const sourceEl  = document.getElementById('tplBodySource');
    const toolbar   = document.getElementById('tplEditorToolbar');
    const htmlBtn   = document.getElementById('tplModeHtml');
    const sourceBtn = document.getElementById('tplModeSource');

    editorEl.classList.add('tpl-hidden');
    sourceEl.classList.add('tpl-hidden');
    toolbar.classList.add('tpl-hidden');
    htmlBtn.classList.remove('tpl-mode-btn-active');
    sourceBtn.classList.remove('tpl-mode-btn-active');

    if (mode === 'source') {
        sourceEl.value = current;
        sourceEl.classList.remove('tpl-hidden');
        sourceBtn.classList.add('tpl-mode-btn-active');
    } else {
        if (tplEditor) tplEditor.commands.setContent(current || '');
        editorEl.classList.remove('tpl-hidden');
        toolbar.classList.remove('tpl-hidden');
        htmlBtn.classList.add('tpl-mode-btn-active');
    }

    syncHtmlButtonState();
}

// ── TipTap editor ─────────────────────────────────────────────────────────────

function initEditor() {
    if (tplEditor) return;
    const {
        Editor, Document, Paragraph, Text,
        Bold, Italic, Underline, Strike,
        Heading, BulletList, OrderedList, ListItem,
        Blockquote, HorizontalRule, HardBreak, History,
        Link, Image, Table, TableRow, TableHeader, TableCell,
        TextStyle, Color, Highlight,
    } = window.TipTapBundle;

    tplEditor = new Editor({
        element: document.getElementById('tplBodyEditor'),
        extensions: [
            Document, Paragraph, Text, HardBreak, History,
            Bold, Italic, Underline, Strike,
            TextStyle, Color, Highlight.configure({ multicolor: true }),
            Heading.configure({ levels: [1, 2, 3] }),
            BulletList, OrderedList, ListItem,
            Blockquote, HorizontalRule,
            Link.configure({ openOnClick: false }),
            Image.configure({ inline: false, allowBase64: false }),
            Table.configure({ resizable: true }),
            TableRow, TableHeader, TableCell,
        ],
        content: '',
        onUpdate: () => { markDirty(); updateToolbarState(); },
        onSelectionUpdate: updateToolbarState,
    });

    // Colour palette toggle helper
    function setupPalette(wrapId, paletteId, onSelect) {
        const wrap = document.getElementById(wrapId);
        const pal  = document.getElementById(paletteId);
        wrap.addEventListener('click', e => {
            if (e.target.closest('[data-color]')) return;
            const isOpen = pal.classList.contains('tpl-palette-open');
            document.querySelectorAll('.tpl-color-palette').forEach(p => p.classList.remove('tpl-palette-open'));
            if (!isOpen) pal.classList.add('tpl-palette-open');
        });
        pal.addEventListener('click', e => {
            const btn = e.target.closest('[data-color]');
            if (!btn) return;
            onSelect(btn.dataset.color);
            pal.classList.remove('tpl-palette-open');
            updateToolbarState();
        });
    }

    setupPalette('tplTextColorWrap', 'tplColorPalette', color => {
        if (color) tplEditor.chain().focus().setColor(color).run();
        else       tplEditor.chain().focus().unsetColor().run();
        document.getElementById('tplColorSwatch').style.background = color;
    });

    setupPalette('tplBgColorWrap', 'tplBgColorPalette', color => {
        if (color) tplEditor.chain().focus().setHighlight({ color }).run();
        else       tplEditor.chain().focus().unsetHighlight().run();
        document.getElementById('tplBgColorSwatch').style.background = color;
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.tpl-color-picker-wrap')) {
            document.querySelectorAll('.tpl-color-palette').forEach(p => p.classList.remove('tpl-palette-open'));
        }
    }, true);

    document.getElementById('tplEditorToolbar').addEventListener('click', e => {
        const btn = e.target.closest('[data-cmd]');
        if (!btn) return;
        const cmd = btn.dataset.cmd;
        const ed = tplEditor;
        const chain = ed.chain().focus();
        switch (cmd) {
            case 'bold':         chain.toggleBold().run(); break;
            case 'italic':       chain.toggleItalic().run(); break;
            case 'underline':    chain.toggleUnderline().run(); break;
            case 'strike':       chain.toggleStrike().run(); break;
            case 'h1':           chain.toggleHeading({ level: 1 }).run(); break;
            case 'h2':           chain.toggleHeading({ level: 2 }).run(); break;
            case 'h3':           chain.toggleHeading({ level: 3 }).run(); break;
            case 'bulletList':   chain.toggleBulletList().run(); break;
            case 'orderedList':  chain.toggleOrderedList().run(); break;
            case 'blockquote':   chain.toggleBlockquote().run(); break;
            case 'hr':           chain.setHorizontalRule().run(); break;
            case 'insertImage':  insertImage(); break;
            case 'undo':         chain.undo().run(); break;
            case 'redo':         chain.redo().run(); break;
            case 'insertTable':  chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
            case 'addRowAfter':  chain.addRowAfter().run(); break;
            case 'addColAfter':  chain.addColumnAfter().run(); break;
            case 'deleteRow':    chain.deleteRow().run(); break;
            case 'deleteCol':    chain.deleteColumn().run(); break;
            case 'deleteTable':  chain.deleteTable().run(); break;
        }
        updateToolbarState();
    });
}

function updateToolbarState() {
    if (!tplEditor) return;
    const ed = tplEditor;
    const map = {
        bold:        () => ed.isActive('bold'),
        italic:      () => ed.isActive('italic'),
        underline:   () => ed.isActive('underline'),
        strike:      () => ed.isActive('strike'),
        h1:          () => ed.isActive('heading', { level: 1 }),
        h2:          () => ed.isActive('heading', { level: 2 }),
        h3:          () => ed.isActive('heading', { level: 3 }),
        bulletList:  () => ed.isActive('bulletList'),
        orderedList: () => ed.isActive('orderedList'),
        blockquote:  () => ed.isActive('blockquote'),
    };
    document.querySelectorAll('#tplEditorToolbar [data-cmd]').forEach(btn => {
        const fn = map[btn.dataset.cmd];
        btn.classList.toggle('tpl-tb-btn-active', fn ? fn() : false);
    });

    // Update swatches to reflect cursor position
    const textSwatch = document.getElementById('tplColorSwatch');
    if (textSwatch) {
        const color = ed.getAttributes('textStyle').color || '';
        textSwatch.style.background = color;
        document.querySelectorAll('#tplColorPalette .tpl-color-dot').forEach(dot => {
            dot.classList.toggle('tpl-color-active', !!color && dot.dataset.color === color);
        });
    }
    const bgSwatch = document.getElementById('tplBgColorSwatch');
    if (bgSwatch) {
        const hlColor = ed.getAttributes('highlight').color || '';
        bgSwatch.style.background = hlColor;
        document.querySelectorAll('#tplBgColorPalette .tpl-color-dot').forEach(dot => {
            dot.classList.toggle('tpl-color-active', !!hlColor && dot.dataset.color === hlColor);
        });
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const s = await res.json();
            templateGroupStartMode = s.templateGroupStartMode ?? 'collapsed';
        }
    } catch {}
    await loadSources();
    await loadTemplates();
    initEditorResize();
    document.getElementById('tplBodySource')?.addEventListener('input', () => { markDirty(); syncHtmlButtonState(); });
    ['tplName', 'tplSubject'].forEach(id =>
        document.getElementById(id)?.addEventListener('input', markDirty)
    );
    document.getElementById('tplSourceId')?.addEventListener('change', markDirty);
    document.getElementById('tplBodyPlain')?.addEventListener('input', markDirty);
    document.getElementById('templateList')?.addEventListener('click', e => {
        const header = e.target.closest('.tpl-group-header');
        if (header?.dataset.group) toggleGroup(header.dataset.group);
    });
}

async function loadSources() {
    try {
        const res = await fetch('/api/sources');
        if (res.ok) {
            allSources = await res.json();
            populateSourceDropdown();
        }
    } catch {}
}

async function loadTemplates() {
    try {
        const res = await fetch('/api/templates');
        if (!res.ok) throw new Error();
        allTemplates = await res.json();
        renderList();
    } catch {
        document.getElementById('templateList').innerHTML =
            '<p class="loading" style="padding:16px">Failed to load templates</p>';
    }
}

function populateSourceDropdown() {
    const sel = document.getElementById('tplSourceId');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Any source —</option>';
    allSources.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        sel.appendChild(opt);
    });
    if (current) sel.value = current;
    sel.addEventListener('change', onSourceChange);
}

async function onSourceChange() {
    const sourceId = document.getElementById('tplSourceId').value;
    if (!sourceId) { tplHide('tokenHintsPanel'); return; }

    try {
        const res = await fetch(`/api/templates/token-hints/${sourceId}`);
        if (!res.ok) { tplHide('tokenHintsPanel'); return; }
        const data = await res.json();
        const source = allSources.find(s => s.id === sourceId);
        document.getElementById('tokenHintsSourceName').textContent = source?.name || '';

        const list = document.getElementById('tokenHintsList');
        renderTokenHints(list, data, insertToken);
        tplShow('tokenHintsPanel');
    } catch {
        tplHide('tokenHintsPanel');
    }
}

function insertImage() {
    const url = prompt('Image URL\n\nSupports {{token}} syntax, e.g. {{movie.remotePoster}}');
    if (!url || !url.trim()) return;
    tplEditor.chain().focus().setImage({ src: url.trim() }).run();
}

function insertToken(token) {
    if (tplEditor) {
        tplEditor.chain().focus().insertContent(token).run();
    }
}

function renderList() {
    const el = document.getElementById('templateList');
    const count = document.getElementById('templateCount');
    count.textContent = allTemplates.length;

    if (allTemplates.length === 0) {
        el.innerHTML = `<div class="empty-state tpl-list-empty">
            <div class="empty-state-icon">📝</div>
            <h3>No templates yet</h3>
            <p>Create a template to format notifications</p>
        </div>`;
        return;
    }

    const filter = (document.getElementById('tplFilterInput')?.value || '').toLowerCase().trim();

    const filtered = allTemplates.filter(t => {
        if (!filter) return true;
        const sourceName = allSources.find(s => s.id === t.sourceId)?.name || '';
        return t.name.toLowerCase().includes(filter) || sourceName.toLowerCase().includes(filter);
    });

    if (filtered.length === 0) {
        el.innerHTML = `<div class="empty-state tpl-list-empty"><p>No templates match your filter.</p></div>`;
        return;
    }

    // Group by source
    const groups = {};
    filtered.forEach(t => {
        const sourceName = allSources.find(s => s.id === t.sourceId)?.name || 'Any source';
        if (!groups[sourceName]) groups[sourceName] = [];
        groups[sourceName].push(t);
    });

    const groupNames = Object.keys(groups).sort();
    const showGroups = groupNames.length > 1 || !filter;

    // sortedNames === groupNames (already sorted) — kept for colour index lookup
    const sortedNames = groupNames;

    // Apply start mode for groups seen for the first time
    groupNames.forEach(name => {
        if (!knownGroups.has(name)) {
            if (templateGroupStartMode === 'collapsed') collapsedGroups.add(name);
            knownGroups.add(name);
        }
    });

    el.innerHTML = groupNames.map((groupName) => {
        const collapsed = collapsedGroups.has(groupName);
        const items = groups[groupName].map(t => {
            const active = editingId === t.id ? ' active' : '';
            return `<div class="split-panel-item${active}" onclick="Templates.editTemplate('${t.id}')">
                <div class="split-panel-item-name">${esc(t.name)}</div>
            </div>`;
        }).join('');

        if (!showGroups) return items;

        const colourIndex = sortedNames.indexOf(groupName) % GROUP_COLOURS.length;
        const colour = GROUP_COLOURS[colourIndex];
        const chevron = collapsed ? '▸' : '▾';

        return `<div class="tpl-group">
            <div class="tpl-group-header" style="color:${colour};border-left:3px solid ${colour}" data-group="${esc(groupName)}">
                <span class="tpl-group-chevron">${chevron}</span>${esc(groupName)}
            </div>
            <div class="tpl-group-items${collapsed ? ' tpl-hidden' : ''}">${items}</div>
        </div>`;
    }).join('');
}

function filterList() {
    renderList();
}

function toggleGroup(groupName) {
    if (collapsedGroups.has(groupName)) {
        collapsedGroups.delete(groupName);
    } else {
        collapsedGroups.add(groupName);
    }
    renderList();
}

function applyStartMode(mode) {
    templateGroupStartMode = mode;
    collapsedGroups.clear();
    knownGroups.clear();
    renderList();
}

async function newTemplate() {
    if (!await guardDirty()) return;
    editingId = null;
    clearDirty();
    const filterEl = document.getElementById('tplFilterInput');
    if (filterEl) filterEl.value = '';
    showForm();
    clearFields();
    tplHide('templateFormEditingBanner');
    tplHide('tplDeleteBtn');
    tplHide('tplDuplicateBtn');
    document.getElementById('tplSaveBtn').textContent = 'Save Template';
    renderList();
}

async function editTemplate(id) {
    if (!await guardDirty()) return;
    const t = allTemplates.find(t => t.id === id);
    if (!t) return;
    editingId = id;
    showForm();

    document.getElementById('tplName').value = t.name;
    document.getElementById('tplSourceId').value = t.sourceId || '';
    document.getElementById('tplSubject').value = t.subject || '';

    setBodyHtml(t.bodyHtml || '');
    document.getElementById('tplBodyPlain').value = t.bodyPlain || '';

    tplShow('templateFormEditingBanner');
    document.getElementById('templateFormEditingName').textContent = t.name;
    tplShow('tplDeleteBtn');
    tplShow('tplDuplicateBtn');
    document.getElementById('tplSaveBtn').textContent = 'Update Template';
    tplHide('previewPanel');

    // Disable delete if in use by rules
    const deleteBtn = document.getElementById('tplDeleteBtn');
    try {
        const r = await fetch(`/api/rules/in-use?templateId=${id}`);
        const d = await r.json();
        deleteBtn.disabled = d.inUse;
        deleteBtn.title = d.inUse ? 'Cannot delete — referenced by one or more rules' : '';
    } catch { deleteBtn.disabled = false; deleteBtn.title = ''; }

    clearDirty();
    onSourceChange();
    renderList();
}

function showForm() {
    document.getElementById('templateForm').style.display = '';
    document.getElementById('templateFormEmpty').style.display = 'none';
    // Initialise editor lazily on first form open (bundle must be loaded)
    if (!tplEditor && window.TipTapBundle) initEditor();
}

function clearFields() {
    ['tplName', 'tplSubject'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('tplSourceId').value = '';
    document.getElementById('tplBodyPlain').value = '';
    // Clear source textarea first so setBodyMode doesn't carry old content into TipTap
    const sourceEl = document.getElementById('tplBodySource');
    if (sourceEl) sourceEl.value = '';
    if (bodyMode !== 'html') setBodyMode('html', true);
    if (tplEditor) tplEditor.commands.setContent('');
    tplHide('tokenHintsPanel');
    tplHide('previewPanel');
    syncHtmlButtonState();
    clearDirty();
}

function clearForm() {
    editingId = null;
    clearFields();
    document.getElementById('templateForm').style.display = 'none';
    document.getElementById('templateFormEmpty').style.display = '';
    tplHide('templateFormEditingBanner');
    tplHide('tplDeleteBtn');
    tplHide('tplDuplicateBtn');
    renderList();
}

async function saveTemplate() {
    const name = document.getElementById('tplName').value.trim();
    const bodyHtml = getBodyHtml();
    const bodyPlain = getBodyPlain();
    if (!name) { await alert('Template name is required'); return; }
    const htmlEmpty = !bodyHtml || bodyHtml === '<p></p>';
    if (htmlEmpty && !bodyPlain) { await alert('At least one body (HTML or plain text) is required'); return; }

    const payload = {
        name,
        sourceId: document.getElementById('tplSourceId').value || null,
        subject: document.getElementById('tplSubject').value.trim(),
        bodyHtml: htmlEmpty ? '' : bodyHtml,
        bodyPlain,
    };

    try {
        const res = await fetch(
            editingId ? `/api/templates/${editingId}` : '/api/templates',
            { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');

        const isNew = !editingId;
        if (isNew) {
            editingId = data.id;
            tplShow('tplDeleteBtn');
            tplShow('tplDuplicateBtn');
            document.getElementById('tplSaveBtn').textContent = 'Update Template';
            tplShow('templateFormEditingBanner');
            document.getElementById('templateFormEditingName').textContent = name;
        }
        clearDirty();
        await loadTemplates();
        window.showToast(isNew ? `Template "${name}" created` : `Template "${name}" updated`);
    } catch (err) {
        await alert(err.message);
    }
}

async function deleteTemplate() {
    if (!editingId) return;
    const t = allTemplates.find(t => t.id === editingId);
    if (!await confirm(`Delete template "${t?.name}"? This cannot be undone.`, 'Delete Template')) return;

    try {
        const res = await fetch(`/api/templates/${editingId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        const name = t?.name || 'Template';
        clearForm();
        await loadTemplates();
        window.showToast(`"${name}" deleted`, 'info');
    } catch (err) {
        await alert(err.message);
    }
}

async function duplicateTemplate() {
    if (!editingId) return;
    try {
        const res = await fetch(`/api/templates/${editingId}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Duplicate failed');
        await loadTemplates();
        editTemplate(data.id);
        window.showToast('Template duplicated');
    } catch (err) {
        await alert(err.message);
    }
}

async function previewTemplate() {
    const subject = document.getElementById('tplSubject').value;
    const bodyHtml = getBodyHtml();
    const bodyPlain = getBodyPlain();
    const htmlEmpty = !bodyHtml || bodyHtml === '<p></p>';
    if (htmlEmpty && !bodyPlain) { await alert('Enter a body to preview'); return; }

    const samplePayload = buildSamplePayload((bodyHtml || '') + ' ' + (bodyPlain || '') + ' ' + subject);

    try {
        const res = await fetch('/api/templates/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, bodyHtml: htmlEmpty ? '' : bodyHtml, bodyPlain, payload: samplePayload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Preview failed');

        if (data.subject) {
            document.getElementById('previewSubject').textContent = data.subject;
            tplShow('previewSubjectRow');
        } else {
            tplHide('previewSubjectRow');
        }

        // HTML preview
        const previewBody = document.getElementById('previewBody');
        const previewCard = document.querySelector('.tpl-preview-card');
        if (data.bodyHtml) {
            const isFullDoc = /^\s*<!DOCTYPE|^\s*<html/i.test(data.bodyHtml);
            if (isFullDoc) {
                if (previewCard) previewCard.classList.add('tpl-preview-card-iframe');
                previewBody.innerHTML = '';
                const iframe = document.createElement('iframe');
                iframe.className = 'tpl-preview-iframe';
                iframe.setAttribute('sandbox', 'allow-same-origin');
                previewBody.appendChild(iframe);
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                doc.open(); doc.write(data.bodyHtml); doc.close();
                setTimeout(() => { iframe.style.height = (doc.documentElement.scrollHeight + 4) + 'px'; }, 50);
            } else {
                if (previewCard) previewCard.classList.remove('tpl-preview-card-iframe');
                previewBody.innerHTML = data.bodyHtml;
            }
            tplShow('previewHtmlRow');
        } else {
            tplHide('previewHtmlRow');
        }

        // Plain text preview — not shown in preview panel

        tplShow('previewPanel');
    } catch (err) {
        await alert(err.message);
    }
}

function buildSamplePayload(template) {
    const TOKEN_RE = /\{\{\s*([\w.[\]]+)\s*(?:\|[^}]*)?\}\}/g;
    const payload = {};
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(template)) !== null) {
        const path = m[1];
        setPath(payload, path, `<${path}>`);
    }
    return payload;
}

function setPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
}

function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function initEditorResize() {
    const handle = document.getElementById('tplEditorResizeHandle');
    const wrap = document.getElementById('tplEditorWrap');
    if (!handle || !wrap) return;

    let startY, startHeight;

    handle.addEventListener('mousedown', (e) => {
        startY = e.clientY;
        startHeight = wrap.offsetHeight;
        document.body.style.cursor = 'ns-resize';

        function onMove(e) {
            const newHeight = Math.max(160, startHeight + (e.clientY - startY));
            wrap.style.height = newHeight + 'px';
            const content = document.getElementById('tplBodyEditor');
            const source = document.getElementById('tplBodySource');
            const toolbarH = document.getElementById('tplEditorToolbar')?.offsetHeight || 0;
            const handleH = handle.offsetHeight || 10;
            const innerH = Math.max(100, newHeight - toolbarH - handleH) + 'px';
            if (content) { content.style.minHeight = innerH; content.style.maxHeight = innerH; }
            if (source)  { source.style.minHeight = innerH;  source.style.maxHeight = innerH; }
        }

        function onUp() {
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    });
}

function toggleHints() {
    const list    = document.getElementById('tokenHintsList');
    const chevron = document.getElementById('tplHintsChevron');
    const open    = list.classList.toggle('tpl-hidden');
    chevron.textContent = open ? '▸' : '▾';
}

function refreshSources() { loadSources(); }

window.Templates = { init, newTemplate, editTemplate, saveTemplate, deleteTemplate, duplicateTemplate, previewTemplate, clearForm, setBodyMode, initEditorResize, toggleHints, refreshSources, filterList, toggleGroup, applyStartMode };

// Load TipTap bundle then init
const script = document.createElement('script');
script.src = '/js/tiptap.bundle.js';
script.onload = init;
document.head.appendChild(script);
