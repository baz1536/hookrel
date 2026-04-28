// Shared token hints renderer — used by templates.js and rules.js
// Call renderTokenHints(listEl, data) to populate a hints container.
// data shape: { eventTokenMap?, sampleTokenPaths?, learned? }

export function renderTokenHints(list, data, onInsert) {
    list.innerHTML = '';

    if (!data.sampleTokenPaths?.length && !data.eventTokenMap) {
        list.innerHTML = data?.learned
            ? '<span class="form-hint">No tokens learned yet — send a test webhook to this source to populate hints.</span>'
            : '<span class="form-hint">No hints available for this source type</span>';
        return;
    }

    if (data.eventTokenMap) {
        Object.entries(data.eventTokenMap).forEach(([event, tokens]) => {
            const section = document.createElement('div');
            section.className = 'tpl-hint-section';

            const header = document.createElement('div');
            header.className = 'tpl-hint-section-header';
            header.textContent = event;
            section.appendChild(header);

            const table = document.createElement('table');
            table.className = 'tpl-hint-table';
            tokens.forEach(({ token, desc }) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><code class="tpl-hint-chip" title="${onInsert ? 'Click to insert' : ''}">${esc('{{')}${esc(token)}${esc('}}')}</code></td><td class="tpl-hint-desc">${esc(desc)}</td>`;
                if (onInsert) {
                    tr.querySelector('code').addEventListener('click', () => onInsert(`{{${token}}}`));
                }
                table.appendChild(tr);
            });
            section.appendChild(table);
            list.appendChild(section);
        });
    } else {
        if (data.learned) {
            const note = document.createElement('div');
            note.className = 'tpl-hint-learned-note';
            note.textContent = 'Tokens learned from live payloads — click to insert';
            list.appendChild(note);
        }
        data.sampleTokenPaths.forEach(p => {
            const chip = document.createElement('code');
            chip.textContent = `{{${p}}}`;
            chip.className = 'tpl-hint-chip';
            if (onInsert) {
                chip.title = 'Click to insert';
                chip.addEventListener('click', () => onInsert(`{{${p}}}`));
            }
            list.appendChild(chip);
        });
        if (data.knownEvents?.length) {
            const label = document.createElement('div');
            label.className = 'tpl-hint-events-label';
            label.textContent = 'Known event types';
            list.appendChild(label);
            data.knownEvents.forEach(e => {
                const chip = document.createElement('span');
                chip.className = 'badge badge-muted';
                chip.textContent = e;
                list.appendChild(chip);
            });
        }
    }
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
