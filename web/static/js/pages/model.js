const ModelPage = {
    currentTab: 'list',
    editingId: null,

    async render(container) {
        container.innerHTML = `
            <div class="page-header flex-between">
                <div>
                    <h1>模型配置</h1>
                    <p>配置大模型连接参数，支持 OpenAI/DeepSeek/GLM 等</p>
                </div>
                <div class="flex gap-8">
                    <button class="btn btn-outline" id="model-refresh-btn">刷新</button>
                    <button class="btn btn-primary" id="model-add-btn">添加模型</button>
                </div>
            </div>
            <div class="tabs">
                <div class="tab-item active" data-tab="list">模型列表</div>
                <div class="tab-item" data-tab="form" id="model-form-tab" style="display:none">编辑模型</div>
            </div>
            <div id="model-tab-content"></div>
        `;
        this.bindEvents(container);
        await this.showList(container);
    },

    bindEvents(container) {
        container.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', async () => {
                container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                if (this.currentTab === 'list') await this.showList(container);
            });
        });
        container.querySelector('#model-refresh-btn').addEventListener('click', () => this.showList(container));
        container.querySelector('#model-add-btn').addEventListener('click', () => {
            this.editingId = null;
            this.showForm(container);
        });
    },

    async showList(container) {
        const content = container.querySelector('#model-tab-content');
        content.innerHTML = '<div style="text-align:center;padding:40px"><span class="loading loading-dark"></span> 加载中...</div>';
        try {
            const data = await API.models.list();
            const configs = data.model_configs || [];
            if (configs.length === 0) {
                content.innerHTML = `<div class="empty-state"><h3>暂无模型配置</h3><p>点击"添加模型"开始配置</p></div>`;
                return;
            }
            content.innerHTML = configs.map(c => `
                <div class="card mb-16">
                    <div class="flex-between">
                        <div>
                            <span style="font-weight:600;font-size:15px">${escHtml(c.name)}</span>
                            ${c.is_active ? '<span class="badge badge-success ml-8">已激活</span>' : ''}
                            <span class="badge badge-info ml-8">${escHtml(c.provider)}</span>
                        </div>
                        <div class="flex gap-8">
                            <button class="btn btn-sm btn-outline test-model" data-id="${c.id}">测试连接</button>
                            ${!c.is_active ? `<button class="btn btn-sm btn-success activate-model" data-id="${c.id}">激活</button>` : ''}
                            <button class="btn btn-sm btn-outline edit-model" data-id="${c.id}">编辑</button>
                            <button class="btn btn-sm btn-danger del-model" data-id="${c.id}">删除</button>
                        </div>
                    </div>
                    <div class="mt-8 flex gap-16 text-sm" style="color:var(--text-secondary)">
                        <span>端点: ${escHtml(c.endpoint)}</span>
                        <span>模型: ${escHtml(c.model_name)}</span>
                        <span>温度: ${c.temperature}</span>
                        <span>Token: ${c.max_tokens}</span>
                    </div>
                    ${c.description ? `<div class="mt-8 text-sm" style="color:var(--text-light)">${escHtml(c.description)}</div>` : ''}
                </div>
            `).join('');

            this.bindListActions(container);
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escHtml(e.message)}</p></div>`;
        }
    },

    bindListActions(container) {
        container.querySelectorAll('.edit-model').forEach(btn => {
            btn.addEventListener('click', () => {
                this.editingId = parseInt(btn.dataset.id);
                this.showForm(container);
            });
        });
        container.querySelectorAll('.del-model').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('确定删除此模型配置？')) return;
                try {
                    await API.models.delete(btn.dataset.id);
                    showToast('删除成功', 'success');
                    await this.showList(container);
                } catch (e) { showToast('删除失败: ' + e.message, 'error'); }
            });
        });
        container.querySelectorAll('.activate-model').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await API.models.activate(btn.dataset.id);
                    showToast('激活成功', 'success');
                    await this.showList(container);
                } catch (e) { showToast('激活失败: ' + e.message, 'error'); }
            });
        });
        container.querySelectorAll('.test-model').forEach(btn => {
            btn.addEventListener('click', async () => {
                const origText = btn.textContent;
                btn.textContent = '测试中...';
                btn.disabled = true;
                try {
                    const result = await API.models.test(btn.dataset.id);
                    if (result.success) showToast('连接成功', 'success');
                    else showToast('连接失败: ' + result.message, 'error');
                } catch (e) {
                    showToast('测试失败: ' + e.message, 'error');
                }
                btn.textContent = origText;
                btn.disabled = false;
            });
        });
    },

    async showForm(container) {
        const formTab = container.querySelector('#model-form-tab');
        const listTab = container.querySelector('[data-tab="list"]');
        listTab.classList.remove('active');
        formTab.style.display = '';
        formTab.classList.add('active');
        this.currentTab = 'form';

        let model = null;
        if (this.editingId) {
            try {
                const data = await API.models.list();
                model = (data.model_configs || []).find(m => m.id === this.editingId);
            } catch(e) {}
        }

        const content = container.querySelector('#model-tab-content');
        content.innerHTML = `
            <div class="card mt-16">
                <div class="card-title mb-16">${this.editingId ? '编辑模型' : '添加模型'}</div>
                <div class="form-group">
                    <label>预设模板</label>
                    <div class="preset-btns" id="preset-btns">
                        <button class="preset-btn" data-preset="openai">OpenAI</button>
                        <button class="preset-btn" data-preset="deepseek">DeepSeek</button>
                        <button class="preset-btn" data-preset="glm">GLM / ChatGLM</button>
                        <button class="preset-btn" data-preset="custom">自定义</button>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="form-group">
                        <label>名称 *</label>
                        <input class="form-input" id="m-name" value="${escHtml(model?.name || '')}" placeholder="如：生产环境GPT-4">
                    </div>
                    <div class="form-group">
                        <label>提供商</label>
                        <input class="form-input" id="m-provider" value="${escHtml(model?.provider || '')}" placeholder="如：OpenAI / DeepSeek / GLM">
                    </div>
                </div>
                <div class="form-group">
                    <label>API端点 *</label>
                    <input class="form-input" id="m-endpoint" value="${escHtml(model?.endpoint || '')}" placeholder="如：https://api.openai.com/v1/chat/completions">
                </div>
                <div class="form-group">
                    <label>API密钥</label>
                    <input class="form-input" id="m-apikey" value="${escHtml(model?.api_key || '')}" placeholder="sk-..." type="password">
                </div>
                <div class="grid-2">
                    <div class="form-group">
                        <label>模型名称</label>
                        <input class="form-input" id="m-modelname" value="${escHtml(model?.model_name || '')}" placeholder="如：gpt-4 / deepseek-chat / glm-4">
                    </div>
                    <div class="form-group">
                        <label>Temperature</label>
                        <input class="form-input" id="m-temp" value="${model?.temperature ?? 0.7}" type="number" step="0.1" min="0" max="2">
                    </div>
                </div>
                <div class="form-group">
                    <label>最大Token数</label>
                    <input class="form-input" id="m-maxtokens" value="${model?.max_tokens ?? 4096}" type="number" min="1">
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea class="form-textarea" id="m-desc" placeholder="模型用途说明">${escHtml(model?.description || '')}</textarea>
                </div>
                <div class="flex gap-8 mt-16">
                    <button class="btn btn-primary btn-lg" id="m-save-btn">保存</button>
                    <button class="btn btn-outline btn-lg" id="m-test-btn">测试连接</button>
                    <button class="btn btn-outline btn-lg" id="m-cancel-btn">取消</button>
                </div>
            </div>`;

        this.bindFormEvents(container);
    },

    bindFormEvents(container) {
        const presets = {
            openai: { provider: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', modelname: 'gpt-4' },
            deepseek: { provider: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions', modelname: 'deepseek-chat' },
            glm: { provider: 'GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', modelname: 'glm-4' },
            custom: { provider: '', endpoint: '', modelname: '' }
        };

        container.querySelectorAll('#preset-btns .preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('#preset-btns .preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const p = presets[btn.dataset.preset];
                if (p) {
                    document.getElementById('m-provider').value = p.provider;
                    document.getElementById('m-endpoint').value = p.endpoint;
                    document.getElementById('m-modelname').value = p.modelname;
                }
            });
        });

        container.querySelector('#m-save-btn').addEventListener('click', async () => {
            const data = {
                name: document.getElementById('m-name').value,
                provider: document.getElementById('m-provider').value,
                endpoint: document.getElementById('m-endpoint').value,
                api_key: document.getElementById('m-apikey').value,
                model_name: document.getElementById('m-modelname').value,
                temperature: parseFloat(document.getElementById('m-temp').value) || 0.7,
                max_tokens: parseInt(document.getElementById('m-maxtokens').value) || 4096,
                description: document.getElementById('m-desc').value
            };

            if (!data.name || !data.endpoint) {
                showToast('名称和端点是必填项', 'warning');
                return;
            }

            try {
                if (this.editingId) {
                    await API.models.update(this.editingId, data);
                    showToast('更新成功', 'success');
                } else {
                    await API.models.create(data);
                    showToast('创建成功', 'success');
                }
                this.currentTab = 'list';
                container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                const listTab = container.querySelector('[data-tab="list"]');
                listTab.classList.add('active');
                container.querySelector('#model-form-tab').style.display = 'none';
                await this.showList(container);
            } catch (e) {
                showToast('保存失败: ' + e.message, 'error');
            }
        });

        container.querySelector('#m-test-btn').addEventListener('click', async () => {
            const data = {
                endpoint: document.getElementById('m-endpoint').value,
                api_key: document.getElementById('m-apikey').value,
                model_name: document.getElementById('m-modelname').value
            };
            if (!data.endpoint) {
                showToast('请先填写 API 端点', 'warning');
                return;
            }
            const btn = container.querySelector('#m-test-btn');
            const origText = btn.textContent;
            btn.textContent = '测试中...';
            btn.disabled = true;
            try {
                const result = await API.models.testConnection(data);
                if (result.success) showToast('连接成功', 'success');
                else showToast('连接失败: ' + result.message, 'error');
            } catch (e) {
                showToast('测试失败: ' + e.message, 'error');
            }
            btn.textContent = origText;
            btn.disabled = false;
        });

        container.querySelector('#m-cancel-btn').addEventListener('click', async () => {
            this.currentTab = 'list';
            container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            const listTab = container.querySelector('[data-tab="list"]');
            listTab.classList.add('active');
            container.querySelector('#model-form-tab').style.display = 'none';
            await this.showList(container);
        });
    }
};