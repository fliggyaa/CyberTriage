const ScriptPage = {
    async render(container) {
        // Windows 专属采集项
        const allCats = ['系统信息','用户账户','进程列表','网络连接','服务状态','启动项','计划任务','安全日志'];
        const windowsOnlyCats = ['注册表信息'];
        const renderCheckboxes = (os) => {
            const cats = os === 'windows' ? [...allCats, ...windowsOnlyCats] : allCats;
            return cats.map((cat, i) => `
                <label class="checkbox-item selected" data-cat="${cat}">
                    <input type="checkbox" checked value="${cat}"> ${cat}
                </label>
            `).join('');
        };
        container.innerHTML = `
            <div class="page-header">
                <h1>脚本生成</h1>
                <p>选择目标操作系统和采集项，生成应急响应采集脚本</p>
            </div>
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><span class="card-title">脚本配置</span></div>
                    <div class="form-group">
                        <label>目标操作系统</label>
                        <div class="preset-btns" id="os-presets">
                            <button class="preset-btn active" data-os="windows">Windows</button>
                            <button class="preset-btn" data-os="linux">Linux</button>
                            <button class="preset-btn" data-os="macos">macOS</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>采集项目（默认全选）</label>
                        <div class="checkbox-group" id="categories-group">
                            ${renderCheckboxes('windows')}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-lg" id="download-btn" style="width:100%">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        生成并下载脚本
                    </button>
                </div>
                <div class="card">
                    <div class="card-header"><span class="card-title">脚本预览</span></div>
                    <div id="script-preview" style="background:#1e293b;color:#e2e8f0;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;max-height:500px;overflow-y:auto;white-space:pre-wrap;">
                        选择操作系统和采集项后点击"生成并下载脚本"
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(container);
        await this.loadScriptList();
    },

    bindEvents(container) {
        const allCats = ['系统信息','用户账户','进程列表','网络连接','服务状态','启动项','计划任务','安全日志'];
        const windowsOnlyCats = ['注册表信息'];
        let selectedOS = 'windows';
        const selectedCats = new Set([...allCats, ...windowsOnlyCats]);

        const renderCheckboxes = (os) => {
            const cats = os === 'windows' ? [...allCats, ...windowsOnlyCats] : allCats;
            const group = container.querySelector('#categories-group');
            group.innerHTML = cats.map(cat => {
                const checked = selectedCats.has(cat) ? ' checked' : '';
                const selClass = selectedCats.has(cat) ? ' selected' : '';
                return `<label class="checkbox-item${selClass}" data-cat="${cat}">
                    <input type="checkbox"${checked} value="${cat}"> ${cat}
                </label>`;
            }).join('');
            bindCheckboxEvents(container, selectedCats);
        };

        const bindCheckboxEvents = (container, catsSet) => {
            container.querySelectorAll('.checkbox-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const cb = item.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    item.classList.toggle('selected', cb.checked);
                    if (cb.checked) catsSet.add(cb.value);
                    else catsSet.delete(cb.value);
                    this.updatePreview(selectedOS, catsSet);
                });
            });
        };

        container.querySelectorAll('#os-presets .preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('#os-presets .preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const newOS = btn.dataset.os;
                if (newOS !== selectedOS) {
                    selectedOS = newOS;
                    // Remove windows-only categories when switching away from Windows
                    if (selectedOS !== 'windows') {
                        windowsOnlyCats.forEach(c => selectedCats.delete(c));
                    } else {
                        // Restore windows-only on switch back (default: all checked)
                        windowsOnlyCats.forEach(c => selectedCats.add(c));
                    }
                    renderCheckboxes(selectedOS);
                }
                this.updatePreview(selectedOS, selectedCats);
            });
        });

        bindCheckboxEvents(container, selectedCats);

        container.querySelector('#download-btn').addEventListener('click', async () => {
            const btn = container.querySelector('#download-btn');
            const origText = btn.innerHTML;
            btn.innerHTML = '<span class="loading"></span> 生成中...';
            btn.disabled = true;

            try {
                const result = await API.scripts.download({
                    os_type: selectedOS,
                    categories: Array.from(selectedCats).join(',')
                });
                const url = URL.createObjectURL(result.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `emergency_collect_${selectedOS}${selectedOS === 'windows' ? '.ps1' : '.sh'}`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('脚本下载成功', 'success');
            } catch (e) {
                showToast('下载失败: ' + e.message, 'error');
            }
            btn.innerHTML = origText;
            btn.disabled = false;
        });
    },

    updatePreview(os, cats) {
        const preview = document.getElementById('script-preview');
        if (!preview) return;
        const ext = os === 'windows' ? '.ps1' : '.sh';
        preview.textContent = [
            `# ${os.toUpperCase()} 应急响应采集脚本`,
            `# 目标系统: ${os}`,
            `# 采集项目: ${Array.from(cats).join(', ')}`,
            '',
            `# 将在当前目录生成 emergency_collection_<timestamp>.json`,
            '',
            `# ... (${os}${ext} 完整脚本将在下载时提供)`,
        ].join('\n');
    },

    async loadScriptList() {
        try {
            const data = await API.scripts.list();
            const preview = document.getElementById('script-preview');
            if (preview && data.scripts) {
                const win = data.scripts.find(s => s.os_type === 'windows');
                if (win) {
                    preview.textContent = [
                        `# ${win.name}`,
                        `# 支持采集: ${win.categories.join(' | ')}`,
                        '',
                        `# 点击左侧按钮生成并下载脚本`,
                    ].join('\n');
                }
            }
        } catch (e) {}
    }
};