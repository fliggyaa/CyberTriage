const ChatPage = {
    conversations: [],
    currentConvId: null,
    isStreaming: false,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1>AI 对话</h1>
                <p>多轮对话分析，对话内容自动保存</p>
            </div>
            <div class="grid-chat-layout">
                <div class="chat-main-panel">
                    <div class="chat-toolbar">
                        <span class="chat-task-badge" id="chat-task-badge">未关联任务</span>
                        <span class="chat-conv-title" id="chat-conv-title"></span>
                    </div>
                    <div class="chat-messages" id="chat-messages">
                        <div class="chat-empty-state">
                            <div class="chat-empty-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                            </div>
                            <p>点击右侧 <b>+ 新建对话</b> 开始</p>
                        </div>
                    </div>
                    <div class="chat-input-area">
                        <textarea id="chat-input" placeholder="输入您的问题... (Enter发送，Shift+Enter换行)" rows="2" disabled></textarea>
                        <button id="chat-send-btn" class="btn btn-primary" disabled>发送</button>
                    </div>
                </div>
                <div class="chat-side-panel">
                    <button class="btn btn-primary btn-new-chat" id="chat-new-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        新建对话
                    </button>
                    <!-- Inline new-conversation form (hidden by default) -->
                    <div class="chat-new-form" id="chat-new-form" style="display:none">
                        <label style="font-size:12px;color:var(--secondary)">关联任务（可选）</label>
                        <select class="form-select" id="chat-new-task-select"><option value="">不关联任务</option></select>
                        <div style="display:flex;gap:6px;margin-top:8px">
                            <button class="btn btn-sm btn-primary" id="chat-new-confirm">创建</button>
                            <button class="btn btn-sm btn-outline" id="chat-new-cancel">取消</button>
                        </div>
                    </div>
                    <div class="chat-conv-list" id="chat-conv-list">
                        <div class="chat-conv-empty">加载中...</div>
                    </div>
                </div>
            </div>
            <!-- New conversation modal backdrop -->
            <div class="chat-modal-overlay" id="chat-modal" style="display:none">
                <div class="chat-modal-box">
                    <h4 style="margin:0 0 12px;font-size:15px">新建对话</h4>
                    <label style="font-size:12px;color:var(--secondary)">关联任务（可选，创建后不可更改）</label>
                    <select class="form-select" id="chat-modal-task" style="margin-top:4px"><option value="">不关联任务</option></select>
                    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
                        <button class="btn btn-sm btn-outline" id="chat-modal-cancel">取消</button>
                        <button class="btn btn-sm btn-primary" id="chat-modal-confirm">创建对话</button>
                    </div>
                </div>
            </div>
        `;
        this._bindEvents(container);
        this._loadTaskList();

        // Bug fix: clear before loading, avoid duplicates
        this.conversations = [];

        try {
            const data = await API.conversations.list();
            const convs = data.conversations || [];
            for (const c of convs) {
                const msgData = await API.conversations.getMessages(c.id);
                this.conversations.push({
                    id: 'db_' + c.id,
                    dbId: c.id,
                    title: c.title,
                    taskId: c.task_id || 0,
                    messages: (msgData.messages || []).map(m => ({ role: m.role, content: m.content })),
                    createdAt: c.created_at
                });
            }
        } catch (e) { /* ignore */ }

        this._renderSidebar();

        if (this.currentConvId) {
            this._restoreCurrentConv();
        } else if (this.conversations.length > 0) {
            this._switchConversation(this.conversations[0].id);
        }
    },

    _getConv() {
        return this.conversations.find(c => c.id === this.currentConvId);
    },

    _bindEvents(container) {
        const input = container.querySelector('#chat-input');
        const sendBtn = container.querySelector('#chat-send-btn');
        const newBtn = container.querySelector('#chat-new-btn');

        sendBtn.addEventListener('click', () => this._sendMessage());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._sendMessage();
            }
        });

        newBtn.addEventListener('click', () => this._showNewConvModal());

        // Modal events
        container.querySelector('#chat-modal-cancel').addEventListener('click', () => this._hideNewConvModal());
        container.querySelector('#chat-modal-confirm').addEventListener('click', () => this._confirmNewConv());
        // Close on backdrop click
        container.querySelector('#chat-modal').addEventListener('click', (e) => {
            if (e.target.id === 'chat-modal') this._hideNewConvModal();
        });
    },

    async _loadTaskList() {
        try {
            const data = await API.tasks.list();
            const opts = '<option value="">不关联任务</option>' + data.tasks.map(t =>
                `<option value="${t.id}">#${t.id} ${t.name} (${t.os_type})</option>`
            ).join('');
            const sel1 = document.getElementById('chat-modal-task');
            if (sel1) sel1.innerHTML = opts;
            const sel2 = document.getElementById('chat-new-task-select');
            if (sel2) sel2.innerHTML = opts;
        } catch (e) { /* silent */ }
    },

    _showNewConvModal() {
        document.getElementById('chat-modal').style.display = 'flex';
        document.getElementById('chat-modal-task').value = '';
        document.getElementById('chat-modal-task').focus();
    },

    _hideNewConvModal() {
        document.getElementById('chat-modal').style.display = 'none';
    },

    async _confirmNewConv() {
        const taskId = parseInt(document.getElementById('chat-modal-task').value) || 0;
        this._hideNewConvModal();
        await this._newConversation(taskId);
    },

    // ===== Conversation Management =====
    async _newConversation(taskId) {
        if (this.isStreaming) return;
        taskId = taskId || 0;

        const conv = {
            id: 'tmp_' + Date.now(),
            dbId: null,
            title: '新对话',
            taskId: taskId,
            messages: [{ role: 'assistant', content: '您好，我是您的应急响应助手，您可以向我提问。' }],
            createdAt: new Date().toISOString()
        };
        this.conversations.unshift(conv);
        this.currentConvId = conv.id;

        try {
            const data = await API.conversations.create({ title: '新对话', task_id: taskId });
            conv.dbId = data.id;
            conv.id = 'db_' + data.id;
            await this._saveMessageToDB(data.id, 'assistant', '您好，我是您的应急响应助手，您可以向我提问。');
        } catch (e) {
            showToast('创建对话失败: ' + e.message, 'error');
        }

        this._enableInput();
        this._renderMessages();
        this._renderSidebar();
        this._updateTaskBadge();
        this._updateTitle();
    },

    _switchConversation(convId) {
        if (this.isStreaming) return;
        this.currentConvId = convId;
        const conv = this._getConv();
        if (!conv) return;
        this._enableInput();
        this._renderMessages();
        this._renderSidebar();
        this._updateTaskBadge();
        this._updateTitle();
    },

    async _deleteConversation(convId, e) {
        e.stopPropagation();
        const conv = this.conversations.find(c => c.id === convId);
        if (conv && conv.dbId) {
            try { await API.conversations.delete(conv.dbId); } catch (e) { /* ignore */ }
        }
        this.conversations = this.conversations.filter(c => c.id !== convId);
        if (this.currentConvId === convId) {
            if (this.conversations.length > 0) {
                this._switchConversation(this.conversations[0].id);
            } else {
                this.currentConvId = null;
                this._showEmpty();
                this._renderSidebar();
                this._updateTaskBadge();
                this._updateTitle();
                this._disableInput();
            }
        } else {
            this._renderSidebar();
        }
    },

    _restoreCurrentConv() {
        const conv = this._getConv();
        if (!conv) { this.currentConvId = null; return; }
        this._enableInput();
        this._renderMessages();
        this._renderSidebar();
        this._updateTaskBadge();
        this._updateTitle();
    },

    _enableInput() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
    },

    _disableInput() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (input) input.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
    },

    async _saveMessageToDB(convDbId, role, content) {
        try {
            await fetch('/api/conversations/' + convDbId + '/messages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, content })
            });
        } catch (e) { /* ignore */ }
    },

    // ===== Rendering =====
    _renderSidebar() {
        const list = document.getElementById('chat-conv-list');
        if (!list) return;
        if (this.conversations.length === 0) {
            list.innerHTML = '<div class="chat-conv-empty">暂无对话记录</div>';
            return;
        }
        list.innerHTML = this.conversations.map(c => {
            const isActive = c.id === this.currentConvId;
            const time = new Date(c.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            const taskLabel = c.taskId > 0 ? ` | 任务#${c.taskId}` : '';
            return `
                <div class="chat-conv-item ${isActive ? 'active' : ''}" data-conv-id="${c.id}">
                    <div class="chat-conv-item-main" data-action="switch">
                        <div class="chat-conv-item-title">${escHtml(c.title)}</div>
                        <div class="chat-conv-item-meta">${time}${taskLabel}</div>
                    </div>
                    <button class="chat-conv-item-del" data-action="delete" title="删除">&times;</button>
                </div>
            `;
        }).join('');
        list.querySelectorAll('.chat-conv-item-main').forEach(el => {
            el.addEventListener('click', () => this._switchConversation(el.parentElement.dataset.convId));
        });
        list.querySelectorAll('.chat-conv-item-del').forEach(el => {
            el.addEventListener('click', (e) => this._deleteConversation(el.parentElement.dataset.convId, e));
        });
    },

    _renderMessages() {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const conv = this._getConv();
        if (!conv || conv.messages.length === 0) { this._showEmpty(); return; }

        container.innerHTML = '';
        conv.messages.forEach(msg => {
            const row = document.createElement('div');
            row.className = 'chat-msg-row ' + (msg.role === 'user' ? 'chat-row-user' : 'chat-row-ai');

            // Avatar
            const avatar = document.createElement('div');
            avatar.className = 'chat-avatar ' + (msg.role === 'user' ? 'avatar-user' : 'avatar-ai');
            if (msg.role === 'user') {
                avatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
            } else {
                avatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>';
            }

            // Bubble
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble ' + (msg.role === 'user' ? 'chat-user' : 'chat-ai');
            bubble.innerHTML = renderMarkdown(msg.content);

            row.appendChild(avatar);
            row.appendChild(bubble);
            container.appendChild(row);
        });
        this._scrollBottom();
    },

    _showEmpty() {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        container.innerHTML = `
            <div class="chat-empty-state">
                <div class="chat-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <p>点击右侧 <b>+ 新建对话</b> 开始</p>
            </div>
        `;
    },

    _updateTaskBadge() {
        const el = document.getElementById('chat-task-badge');
        if (!el) return;
        const conv = this._getConv();
        if (!conv) { el.textContent = '未关联任务'; el.className = 'chat-task-badge'; return; }
        if (conv.taskId > 0) {
            el.textContent = '📋 已关联任务 #' + conv.taskId;
            el.className = 'chat-task-badge badge-linked';
        } else {
            el.textContent = '未关联任务';
            el.className = 'chat-task-badge';
        }
    },

    _updateTitle() {
        const el = document.getElementById('chat-conv-title');
        if (!el) return;
        const conv = this._getConv();
        el.textContent = conv ? conv.title : '';
    },

    // ===== Messaging with Typewriter Effect =====
    async _sendMessage() {
        if (this.isStreaming) return;

        const input = document.getElementById('chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        let conv = this._getConv();
        if (!conv) {
            await this._newConversation(0);
            conv = this._getConv();
        }

        input.value = '';
        input.disabled = true;
        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        // Auto-title from first user message
        if (conv.messages.length === 1 && conv.messages[0].role === 'assistant') {
            conv.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
            if (conv.dbId) {
                try { await API.put('/conversations/' + conv.dbId, { title: conv.title }); } catch (e) { /* ignore */ }
            }
            this._renderSidebar();
            this._updateTitle();
        }

        conv.messages.push({ role: 'user', content: text });
        const container = document.getElementById('chat-messages');
        const emptyEl = container.querySelector('.chat-empty-state');
        if (emptyEl) emptyEl.remove();

        // User message row with avatar
        const userRow = document.createElement('div');
        userRow.className = 'chat-msg-row chat-row-user';
        userRow.innerHTML = `
            <div class="chat-avatar avatar-user">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div class="chat-bubble chat-user">${renderMarkdown(text)}</div>
        `;
        container.appendChild(userRow);
        if (conv.dbId) this._saveMessageToDB(conv.dbId, 'user', text);
        this._scrollBottom();

        // Thinking row with AI avatar
        const thinkRow = document.createElement('div');
        thinkRow.className = 'chat-msg-row chat-row-ai';
        thinkRow.innerHTML = `
            <div class="chat-avatar avatar-ai">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>
            </div>
            <div class="chat-bubble chat-ai chat-streaming">
                <span class="thinking-text">🤔 AI thinking</span><span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
        `;
        container.appendChild(thinkRow);
        this._scrollBottom();

        this.isStreaming = true;

        try {
            const messagesToSend = conv.messages.filter(m => m.role !== 'system').map(m => ({
                role: m.role, content: m.content
            }));

            const data = await API.chat.send({
                task_id: conv.taskId || 0,
                messages: messagesToSend
            });

            const fullReply = data.reply || '';
            const replyBubble = thinkRow.querySelector('.chat-bubble');
            replyBubble.classList.remove('chat-streaming');
            replyBubble.innerHTML = '<span class="streaming-cursor"></span>';

            // Typewriter effect
            let pos = 0;
            const speed = 25;
            const renderStream = () => {
                if (pos >= fullReply.length) {
                    replyBubble.innerHTML = renderMarkdown(fullReply);
                    conv.messages.push({ role: 'assistant', content: fullReply });
                    if (conv.dbId) this._saveMessageToDB(conv.dbId, 'assistant', fullReply);
                    this.isStreaming = false;
                    input.disabled = false;
                    if (sendBtn) sendBtn.disabled = false;
                    input.focus();
                    return;
                }
                const snippet = fullReply.substring(0, pos);
                replyBubble.innerHTML = escHtml(snippet).replace(/\n/g, '<br>') + '<span class="streaming-cursor"></span>';
                this._scrollBottom();
                pos += Math.max(1, Math.floor(Math.random() * 4));
                setTimeout(renderStream, speed + Math.random() * 20);
            };
            renderStream();

        } catch (e) {
            const replyBubble = thinkRow.querySelector('.chat-bubble');
            replyBubble.classList.remove('chat-streaming');
            replyBubble.classList.add('chat-error');
            replyBubble.textContent = '⚠️ 错误: ' + e.message;
            this.isStreaming = false;
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
        }
    },

    _scrollBottom() {
        const container = document.getElementById('chat-messages');
        if (container) { container.scrollTop = container.scrollHeight; }
    }
};