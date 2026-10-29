// Core parsing for Markdown pipe tables. Plain string functions with no DOM use,
// so this file can be tested outside the browser.

// Splits HTML into lines on <br> tags and newlines, keeping the delimiters
// so text around a table can be rebuilt exactly as it was.
export function splitLines(html) {
    const parts = html.split(/(<br\s*\/?>\s*\n?|\n)/i);
    const lines = [];
    const delims = [];
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) lines.push(parts[i]);
        else delims.push(parts[i]);
    }
    return { lines, delims };
}

export function stripTags(html) {
    return html.replace(/<[^>]*>/g, '');
}

// Splits one line of HTML into cells on "|". Pipes inside tags, inside <code>,
// or escaped with a backslash are kept as text. Returns null if the line has
// no splitting pipe.
export function parseRow(html) {
    const cells = [];
    let current = '';
    let codeDepth = 0;
    let foundPipe = false;
    let i = 0;

    while (i < html.length) {
        const ch = html[i];

        if (ch === '<') {
            const end = html.indexOf('>', i);
            if (end !== -1) {
                const tag = html.slice(i, end + 1);
                if (/^<code[\s>]/i.test(tag)) codeDepth++;
                else if (/^<\/code\s*>/i.test(tag)) codeDepth = Math.max(0, codeDepth - 1);
                current += tag;
                i = end + 1;
                continue;
            }
        }

        if (ch === '\\' && html[i + 1] === '|') {
            current += '|';
            i += 2;
            continue;
        }

        if (ch === '|' && codeDepth === 0) {
            cells.push(current);
            current = '';
            foundPipe = true;
            i++;
            continue;
        }

        current += ch;
        i++;
    }
    cells.push(current);

    if (!foundPipe) return null;

    // Leading and trailing pipes are optional in Markdown and don't make cells.
    if (cells.length > 1 && stripTags(cells[0]).trim() === '' && !/<(img|code)/i.test(cells[0])) cells.shift();
    if (cells.length > 1 && stripTags(cells[cells.length - 1]).trim() === '' && !/<(img|code)/i.test(cells[cells.length - 1])) cells.pop();

    return cells.map(c => c.trim());
}

const SEPARATOR_CELL = /^\s*:?-+:?\s*$/;

// Returns column alignments ('left' | 'center' | 'right' | '') if the line is a
// table separator such as "| :--- | :---: | ---: |", otherwise null.
export function parseSeparator(html) {
    const text = stripTags(html).trim();
    if (!text.includes('|') && !/^:?-+:?$/.test(text)) return null;
    if (!/^[\s|:\-]+$/.test(text)) return null;

    let cells = text.split('|');
    if (cells.length > 1 && cells[0].trim() === '') cells.shift();
    if (cells.length > 1 && cells[cells.length - 1].trim() === '') cells.pop();
    if (cells.length === 0 || !cells.every(c => SEPARATOR_CELL.test(c))) return null;

    return cells.map(c => {
        const t = c.trim();
        const left = t.startsWith(':');
        const right = t.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return '';
    });
}

function buildTable(header, aligns, rows) {
    const cols = aligns.length;
    const cell = (tag, content, idx) => {
        const align = aligns[idx] ? ` style="text-align: ${aligns[idx]}"` : '';
        return `<${tag}${align}>${content ?? ''}</${tag}>`;
    };
    const row = (tag, cells) => {
        let out = '<tr>';
        for (let c = 0; c < cols; c++) out += cell(tag, cells[c], c);
        return out + '</tr>';
    };

    let html = '<div class="mdt-wrap"><table class="mdt-table">';
    html += '<thead>' + row('th', header) + '</thead>';
    if (rows.length) html += '<tbody>' + rows.map(r => row('td', r)).join('') + '</tbody>';
    html += '</table></div>';
    return html;
}

// Converts any pipe tables inside a block of HTML (usually a <p>'s contents).
// Returns null if no table was found. Otherwise returns a list of pieces:
// { type: 'text', html } for surrounding text and { type: 'table', html }.
export function convertBlock(html) {
    if (!html.includes('|')) return null;

    const { lines, delims } = splitLines(html);
    const pieces = [];
    let textStart = 0;
    let found = false;

    const flushText = (end) => {
        if (end <= textStart) return;
        let out = '';
        for (let k = textStart; k < end; k++) {
            out += lines[k];
            if (k < end - 1) out += delims[k];
        }
        if (stripTags(out).trim() !== '' || /<img/i.test(out)) {
            pieces.push({ type: 'text', html: out });
        }
    };

    let i = 0;
    while (i < lines.length - 1) {
        const header = parseRow(lines[i]);
        const aligns = header ? parseSeparator(lines[i + 1]) : null;

        if (!header || !aligns || header.length !== aligns.length) {
            i++;
            continue;
        }

        const rows = [];
        let j = i + 2;
        while (j < lines.length) {
            if (stripTags(lines[j]).trim() === '') break;
            const r = parseRow(lines[j]);
            if (!r) break;
            rows.push(r);
            j++;
        }

        flushText(i);
        pieces.push({ type: 'table', html: buildTable(header, aligns, rows) });
        found = true;
        textStart = j;
        i = j;
    }

    if (!found) return null;
    flushText(lines.length);
    return pieces;
}
