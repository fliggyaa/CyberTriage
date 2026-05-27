function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN');
}

function riskBadge(level) {
    const labels = {
        critical: '严重', high: '高危', medium: '中危',
        low: '低危', info: '信息', unknown: '未知'
    };
    return `<span class="risk-tag ${level}">${labels[level] || level}</span>`;
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Render Markdown-like text to HTML.
 * Supports: headers, bold, italic, inline code, code blocks, lists, blockquotes, hr.
 */
function renderMarkdown(text) {
    if (!text) return '';

    // Escape HTML first, then selectively re-insert safe tags
    let html = escHtml(text);

    // Code blocks: ``` ... ``` → <pre><code>...</code></pre>
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code${lang ? ' class="language-' + lang + '"' : ''}>${code.trim()}</code></pre>`;
    });

    // Inline code: `text` → <code>text</code>
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (single, not double)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');

    // Headers: ### text, ## text, # text
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // Horizontal rules: --- or ***
    html = html.replace(/^(---|\*\*\*)$/gm, '<hr>');

    // Blockquotes: > text
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists: consecutive lines starting with -, *, +
    html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (match) => {
        const items = match.trim().split('\n').map(line =>
            '<li>' + line.replace(/^[-*+] /, '') + '</li>'
        ).join('');
        return '<ul>' + items + '</ul>';
    });

    // Ordered lists: consecutive lines starting with 1. 2. etc
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
        const items = match.trim().split('\n').map(line =>
            '<li>' + line.replace(/^\d+\. /, '') + '</li>'
        ).join('');
        return '<ol>' + items + '</ol>';
    });

    // Paragraphs: blank lines → </p><p>
    html = html.replace(/\n\n+/g, '</p><p>');
    // Single line breaks within paragraphs
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped in a block element
    if (!html.match(/^<(h[2-4]|ul|ol|pre|blockquote|hr)/)) {
        html = '<p>' + html + '</p>';
    }

    return html;
}

const pages = {
    script: ScriptPage,
    report: ReportPage,
    chat: ChatPage,
    ai: AIPage,
    model: ModelPage
};

let currentPage = 'script';

function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    const container = document.getElementById('page-content');
    if (pages[page]) {
        pages[page].render(container);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
    navigateTo('script');
});