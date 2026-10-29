import { convertBlock } from './tables.js';

const MODULE_NAME = 'markdown_tables';
const defaultSettings = Object.freeze({
    enabled: true,
    styleAllTables: true,
});

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    return extensionSettings[MODULE_NAME];
}

// Replaces one <p> with the converted pieces, if it contains a table.
function processBlock(block) {
    const pieces = convertBlock(block.innerHTML);
    if (!pieces) return;

    const fragment = document.createDocumentFragment();
    const template = document.createElement('template');
    for (const piece of pieces) {
        if (piece.type === 'table') {
            template.innerHTML = piece.html;
            fragment.append(template.content.cloneNode(true));
        } else {
            const p = document.createElement('p');
            p.innerHTML = piece.html;
            fragment.append(p);
        }
    }
    block.replaceWith(fragment);
}

function processMessage(mesText) {
    if (!getSettings().enabled || !mesText.isConnected) return;
    for (const block of mesText.querySelectorAll('p')) {
        // Leave code blocks, existing tables, and edit boxes alone.
        if (block.closest('pre, code, table, .edit_textarea')) continue;
        processBlock(block);
    }
}

function processAll() {
    document.querySelectorAll('#chat .mes_text').forEach(processMessage);
}

// Watch the chat so new, streamed, edited, and swiped messages all get handled.
let observer = null;
const pending = new Set();
let scheduled = false;

function flush() {
    scheduled = false;
    const targets = [...pending];
    pending.clear();
    targets.forEach(processMessage);
    // Drop the mutation records caused by our own changes.
    observer?.takeRecords();
}

function queue(mesText) {
    pending.add(mesText);
    if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
    }
}

function startObserver() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            const target = m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentElement;
            const mesText = target?.closest?.('.mes_text');
            if (mesText) {
                queue(mesText);
                continue;
            }
            for (const node of m.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                if (node.matches('.mes_text')) queue(node);
                node.querySelectorAll('.mes_text').forEach(queue);
            }
        }
    });
    observer.observe(chat, { childList: true, subtree: true, characterData: true });
}

function applyStyleClass() {
    document.body.classList.toggle('mdt-style-all', !!getSettings().styleAllTables);
}

async function addSettingsPanel() {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    const settings = getSettings();

    const html = `
    <div class="markdown-tables-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Markdown Tables</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label" for="mdt_enabled">
                    <input type="checkbox" id="mdt_enabled">
                    <span>Render Markdown tables in messages</span>
                </label>
                <label class="checkbox_label" for="mdt_style_all">
                    <input type="checkbox" id="mdt_style_all">
                    <span>Apply table styling to all tables in chat</span>
                </label>
            </div>
        </div>
    </div>`;

    const container = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
    container?.insertAdjacentHTML('beforeend', html);

    const enabledBox = document.getElementById('mdt_enabled');
    const styleBox = document.getElementById('mdt_style_all');
    if (!enabledBox || !styleBox) return;

    enabledBox.checked = settings.enabled;
    styleBox.checked = settings.styleAllTables;

    enabledBox.addEventListener('change', async () => {
        settings.enabled = enabledBox.checked;
        saveSettingsDebounced();
        if (settings.enabled) {
            processAll();
        } else {
            // Re-render the chat to restore the original text.
            await SillyTavern.getContext().reloadCurrentChat?.();
        }
    });

    styleBox.addEventListener('change', () => {
        settings.styleAllTables = styleBox.checked;
        saveSettingsDebounced();
        applyStyleClass();
    });
}

(async function init() {
    getSettings();
    applyStyleClass();
    await addSettingsPanel();
    startObserver();
    processAll();

    // Backup in case a render happens outside the observed element.
    const { eventSource, event_types } = SillyTavern.getContext();
    const rerun = () => requestAnimationFrame(processAll);
    for (const name of ['CHAT_CHANGED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MORE_MESSAGES_LOADED']) {
        if (event_types[name]) eventSource.on(event_types[name], rerun);
    }
})();
