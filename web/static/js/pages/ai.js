const AIPage = {
    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1>AI 智能分析</h1>
                <p>选择已完成采集的任务和模型，由AI生成专业安全分析报告</p>
            </div>
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><span class="card-title">分析配置</span></div>
                    <div class="form-group">
                        <label>选择任务</label>
                        <select class="form-select" id="ai-task-select"><option value="">加载中...</option></select>
                    </div>
                    <div class="form-group">
                        <label>选择模型</label>
                        <select class="form-select" id="ai-model-select"><option value="0">使用激活模型（自动）</option></select>
                    </div>
                    <button class="btn btn-primary btn-lg" id="ai-analyze-btn" style="width:100%">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        开始 AI 分析
                    </button>
                    <div id="ai-status" class="mt-16"></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">分析结果</span>
                        <button class="btn btn-sm btn-outline" id="ai-copy-btn" style="display:none">复制</button>
                    </div>
                    <div id="ai-result" style="min-height:300px">
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                            </svg>
                            <h3>等待分析</h3><p>选择任务后点击开始分析</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.bindEvents(container);
        await this.loadTasks(container);
        await this.loadModels(container);
        
        // Restore previous analysis if exists
        if (this._lastResult) {
            this._restoreResult(container);
        }
    },

    bindEvents(container) {
        container.querySelector('#ai-analyze-btn').addEventListener('click', async () => {
            const taskId = parseInt(container.querySelector('#ai-task-select').value);
            const modelId = parseInt(container.querySelector('#ai-model-select').value);

            if (!taskId) { showToast('请选择任务', 'warning'); return; }

            const btn = container.querySelector('#ai-analyze-btn');
            const statusEl = container.querySelector('#ai-status');
            const resultEl = container.querySelector('#ai-result');

            btn.innerHTML = '<span class="loading"></span> AI分析中... 可能需要1-3分钟';
            btn.disabled = true;
            statusEl.innerHTML = '<div style="color:#4f46e5;font-size:13px"><span class="loading loading-dark"></span> 正在调用AI模型分析系统数据...</div>';
            resultEl.innerHTML = '<div style="text-align:center;padding:40px"><span class="loading loading-dark"></span></div>';

            try {
                const data = await API.ai.analyze({ task_id: taskId, model_config_id: modelId });
                // Store result for persistence across page switches
                this._lastResult = {
                    taskId: taskId,
                    modelId: modelId,
                    riskLevel: data.risk_level,
                    analysis: data.analysis
                };
                statusEl.innerHTML = '<span class="badge badge-success" style="font-size:13px">分析完成</span>';
                this._renderResultContent(container, data.risk_level, data.analysis);
                container.querySelector('#ai-copy-btn').style.display = '';
                showToast('AI分析完成', 'success');
            } catch (e) {
                statusEl.innerHTML = '<span class="badge badge-danger" style="font-size:13px">分析失败</span>';
                resultEl.innerHTML = `<div class="empty-state"><h3>分析失败</h3><p>${escHtml(e.message)}</p></div>`;
                showToast('AI分析失败: ' + e.message, 'error');
            }
            btn.innerHTML = btn.innerHTML.replace(/<span.*?span>/, '');
            const origSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
            btn.innerHTML = origSvg + ' 开始 AI 分析';
            btn.disabled = false;
        });

        container.querySelector('#ai-copy-btn').addEventListener('click', () => {
            const text = container.querySelector('#ai-result .ai-analysis-content')?.textContent || '';
            navigator.clipboard.writeText(text).then(() => {
                showToast('已复制到剪贴板', 'success');
            });
        });
    },

    async loadTasks(container) {
        try {
            const data = await API.tasks.list();
            const sel = container.querySelector('#ai-task-select');
            sel.innerHTML = '<option value="">-- 选择任务 --</option>' +
                data.tasks.map(t => `<option value="${t.id}">#${t.id} ${t.name} (${t.os_type}) [${t.status}]</option>`).join('');
        } catch (e) {
            container.querySelector('#ai-task-select').innerHTML = '<option value="">加载失败</option>';
        }
    },

    async loadModels(container) {
        try {
            const data = await API.models.list();
            const sel = container.querySelector('#ai-model-select');
            const configs = data.model_configs || [];
            sel.innerHTML = '<option value="0">使用激活模型（自动）</option>' +
                configs.map(m => `<option value="${m.id}">${m.name} (${m.provider}) ${m.is_active ? '[已激活]' : ''}</option>`).join('');
        } catch (e) {}
    },

    _renderResultContent(container, riskLevel, analysis) {
        const resultEl = container.querySelector('#ai-result');
        resultEl.innerHTML = `
            <div style="margin-bottom:12px">
                <span style="font-weight:600">风险等级: </span>${riskBadge(riskLevel)}
            </div>
            <div class="ai-analysis-content">${renderMarkdown(analysis)}</div>`;
    },

    _restoreResult(container) {
        const r = this._lastResult;
        const taskSel = container.querySelector('#ai-task-select');
        const modelSel = container.querySelector('#ai-model-select');
        if (taskSel) {
            // Check if the task still exists in the loaded options
            let taskExists = false;
            for (const opt of taskSel.options) {
                if (opt.value === String(r.taskId)) {
                    taskExists = true;
                    break;
                }
            }
            if (!taskExists) {
                // Task was deleted, clear cached result
                this._lastResult = null;
                return;
            }
            taskSel.value = String(r.taskId);
        }
        if (modelSel) modelSel.value = String(r.modelId);
        const statusEl = container.querySelector('#ai-status');
        if (statusEl) statusEl.innerHTML = '<span class="badge badge-success" style="font-size:13px">分析完成</span>';
        this._renderResultContent(container, r.riskLevel, r.analysis);
        const copyBtn = container.querySelector('#ai-copy-btn');
        if (copyBtn) copyBtn.style.display = '';
    }
};