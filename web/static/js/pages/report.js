const ReportPage = {
    currentTab: 'upload',
    chartInstances: {},
    reports: [],

    async render(container) {
        container.innerHTML = `
            <div class="page-header flex-between">
                <div>
                    <h1>报告管理</h1>
                    <p>上传采集文件，查看分析报告</p>
                </div>
                <button class="btn btn-primary" id="refresh-btn">刷新</button>
            </div>
            <div class="tabs">
                <div class="tab-item active" data-tab="upload">上传文件</div>
                <div class="tab-item" data-tab="list">报告列表</div>
                <div class="tab-item" data-tab="detail" style="display:none" id="detail-tab">报告详情</div>
            </div>
            <div id="tab-content"></div>
        `;
        this.bindEvents(container);
        await this.showUpload(container);
    },

    bindEvents(container) {
        container.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', async () => {
                container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                this.destroyCharts();
                if (this.currentTab === 'upload') await this.showUpload(container);
                else if (this.currentTab === 'list') await this.showList(container);
                else if (this.currentTab === 'detail' && this._detail) {
                    this.showDetail(container, this._detail.report, this._detail.task);
                }
            });
        });
        container.querySelector('#refresh-btn').addEventListener('click', async () => {
            if (this.currentTab === 'upload') await this.showUpload(container);
            else if (this.currentTab === 'list') await this.showList(container);
        });
    },

    async showUpload(container) {
        const tabContent = container.querySelector('#tab-content');
        tabContent.innerHTML = `
            <div class="card mt-16">
                <div class="card-header"><span class="card-title">上传采集文件</span></div>
                <div class="form-group">
                    <label>关联任务（可选）</label>
                    <select class="form-select" id="task-select"><option value="">加载中...</option></select>
                </div>
                <div class="form-group">
                    <label>采集文件（.json）</label>
                    <div style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all 0.2s" 
                         id="drop-zone" 
                         onmouseover="this.style.borderColor='#4f46e5';this.style.background='rgba(79,70,229,0.03)'" 
                         onmouseout="this.style.borderColor='#cbd5e1';this.style.background=''">
                        <input type="file" id="file-input" accept=".json,.txt" style="display:none">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:8px">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p style="color:#94a3b8;margin:0">点击或拖拽文件到此处上传</p>
                        <p style="color:#cbd5e1;font-size:12px;margin:4px 0 0">支持 .json / .txt 格式</p>
                        <div id="file-name" style="margin-top:8px;color:#4f46e5;font-weight:500"></div>
                    </div>
                </div>
                <button class="btn btn-primary btn-lg" id="upload-btn" style="width:100%">上传并分析</button>
                <div id="upload-progress" class="mt-16"></div>
            </div>
        `;

        this.bindUploadEvents(container);
        await this.loadTasksForSelect(container);
    },

    bindUploadEvents(container) {
        const dropZone = container.querySelector('#drop-zone');
        const fileInput = container.querySelector('#file-input');
        const fileName = container.querySelector('#file-name');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#4f46e5'; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#cbd5e1'; });
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.style.borderColor = '#cbd5e1';
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                fileName.textContent = e.dataTransfer.files[0].name;
            }
        });
        fileInput.addEventListener('change', () => {
            fileName.textContent = fileInput.files[0]?.name || '';
        });

        container.querySelector('#upload-btn').addEventListener('click', async () => {
            const taskId = container.querySelector('#task-select').value || '0';
            const file = fileInput.files[0];
            if (!file) { showToast('请选择文件', 'warning'); return; }

            const btn = container.querySelector('#upload-btn');
            btn.innerHTML = '<span class="loading"></span> 上传分析中...';
            btn.disabled = true;

            try {
                const formData = new FormData();
                formData.append('task_id', taskId);
                formData.append('file', file);
                const result = await API.reports.upload(formData);
                showToast('上传成功，报告已生成', 'success');
                this.showDetail(container, result.report, result.task);
            } catch (e) {
                showToast('上传失败: ' + e.message, 'error');
            }
            btn.innerHTML = '上传并分析';
            btn.disabled = false;
        });
    },

    async loadTasksForSelect(container) {
        try {
            const data = await API.tasks.list();
            const sel = container.querySelector('#task-select');
            sel.innerHTML = '<option value="0">不选择（自动创建任务）</option>' +
                data.tasks.map(t => `<option value="${t.id}">#${t.id} ${t.name} (${t.os_type})</option>`).join('');
        } catch (e) {
            container.querySelector('#task-select').innerHTML = '<option value="">加载失败</option>';
        }
    },

    async showList(container) {
        const tabContent = container.querySelector('#tab-content');
        tabContent.innerHTML = '<div style="text-align:center;padding:40px"><span class="loading loading-dark"></span> 加载中...</div>';
        try {
            const data = await API.reports.list();
            this.reports = data.reports || [];
            if (this.reports.length === 0) {
                tabContent.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <h3>暂无报告</h3><p>请先上传采集文件</p>
                    </div>`;
                return;
            }
            tabContent.innerHTML = `
                <div class="card mt-16">
                    <div class="table-container">
                        <table>
                            <thead><tr>
                                <th>ID</th><th>任务名称</th><th>系统类型</th><th>风险等级</th><th>AI分析</th><th>时间</th><th>操作</th>
                            </tr></thead>
                            <tbody>${this.reports.map(r => `
                                <tr>
                                    <td>#${r.id}</td>
                                    <td><strong>${escHtml(r.task_name || '-')}</strong></td>
                                    <td><span class="badge badge-info">${escHtml(r.os_type || '-')}</span></td>
                                    <td>${riskBadge(r.risk_level)}</td>
                                    <td>${r.ai_completed ? '<span class="badge badge-success">已完成</span>' : '<span class="badge badge-warning">未分析</span>'}</td>
                                    <td>${formatDate(r.created_at)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline view-report" data-id="${r.id}">查看</button>
                                        <button class="btn btn-sm btn-danger del-report ml-8" data-id="${r.id}">删除</button>
                                    </td>
                                </tr>
                            `).join('')}</tbody>
                        </table>
                    </div>
                </div>`;
            this.bindListEvents(container);
        } catch (e) {
            tabContent.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escHtml(e.message)}</p></div>`;
        }
    },

    bindListEvents(container) {
        container.querySelectorAll('.view-report').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    const data = await API.reports.get(id);
                    this.showDetail(container, data.report, data.task);
                } catch (e) { showToast('加载失败: ' + e.message, 'error'); }
            });
        });
        container.querySelectorAll('.del-report').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('确定删除此报告？')) return;
                try {
                    await API.reports.delete(btn.dataset.id);
                    showToast('删除成功', 'success');
                    await this.showList(container);
                } catch (e) { showToast('删除失败: ' + e.message, 'error'); }
            });
        });
    },

    showDetail(container, report, task) {
        this.destroyCharts();
        const taskName = task?.name || '未知任务';
        
        // Make detail tab visible with task name
        const detailTab = container.querySelector('#detail-tab');
        detailTab.style.display = '';
        detailTab.textContent = taskName;
        
        // Activate detail tab
        container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        detailTab.classList.add('active');
        this.currentTab = 'detail';
        // Store current detail for switching back
        this._detail = { report, task };

        let parsed = null;
        let chartsData = {};
        try { chartsData = JSON.parse(report.charts_data || '{}'); } catch(e) {}
        try { parsed = JSON.parse(report.parsed_data || '{}'); } catch(e) {}

        const renameHTML = task ? `
            <span class="rename-task-btn ml-8" data-task-id="${task.id}" title="重命名任务" style="cursor:pointer;font-size:14px;opacity:0.5;transition:opacity .2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">✏️</span>` : '';
        const tabContent = container.querySelector('#tab-content');
        tabContent.innerHTML = `
            <div class="mt-16">
                <div class="flex-between mb-16">
                    <div>
                        <h2 style="font-size:18px">报告 #${report.id} - <span class="task-name-display">${escHtml(taskName)}</span><span class="task-name-edit" style="display:none"><input class="task-name-input" style="font-size:16px;padding:2px 6px;border:1px solid #4f46e5;border-radius:4px;width:300px"></span>${renameHTML}</h2>
                        <span class="text-sm text-secondary">${escHtml(task?.os_type || '')} | ${formatDate(report.created_at)}</span>
                    </div>
                    <div>${riskBadge(report.risk_level)}</div>
                </div>
                ${this.renderOverview(chartsData)}
                ${this.renderCharts(chartsData)}
                ${this.renderParsedData(parsed)}
                ${report.ai_analysis ? this.renderAISection(report) : ''}
            </div>`;

        if (chartsData) this.initCharts(container);

        // Bind rename events
        if (task) {
            this._bindRenameEvents(container, task);
        }
    },

    _bindRenameEvents(container, task) {
        const renameBtn = container.querySelector('.rename-task-btn');
        if (!renameBtn) return;
        const displayEl = container.querySelector('.task-name-display');
        const editEl = container.querySelector('.task-name-edit');
        const inputEl = container.querySelector('.task-name-input');

        renameBtn.addEventListener('click', () => {
            displayEl.style.display = 'none';
            editEl.style.display = '';
            inputEl.value = displayEl.textContent;
            inputEl.focus();
            inputEl.select();
        });

        const doRename = async () => {
            const newName = inputEl.value.trim();
            if (!newName || newName === task.name) {
                displayEl.style.display = '';
                editEl.style.display = 'none';
                return;
            }
            try {
                await API.tasks.update(task.id, { name: newName, os_type: task.os_type, description: task.description || '' });
                task.name = newName;
                displayEl.textContent = newName;
                const detailTab = container.querySelector('#detail-tab');
                if (detailTab) detailTab.textContent = newName;
                showToast('任务已重命名', 'success');
            } catch (e) {
                showToast('重命名失败: ' + e.message, 'error');
            }
            displayEl.style.display = '';
            editEl.style.display = 'none';
        };

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); doRename(); }
            if (e.key === 'Escape') {
                displayEl.style.display = '';
                editEl.style.display = 'none';
            }
        });
        inputEl.addEventListener('blur', () => {
            setTimeout(doRename, 150);
        });
    },

    renderOverview(cd) {
        const ov = cd.overview || {};
        return `
            <div class="grid-4 mb-16">
                <div class="stat-card"><div class="stat-icon blue">P</div><div class="stat-info"><h4>进程数</h4><span class="value">${ov.total_processes || 0}</span></div></div>
                <div class="stat-card"><div class="stat-icon green">U</div><div class="stat-info"><h4>用户数</h4><span class="value">${ov.total_users || 0}</span></div></div>
                <div class="stat-card"><div class="stat-icon orange">N</div><div class="stat-info"><h4>网络连接</h4><span class="value">${ov.total_connections || 0}</span></div></div>
                <div class="stat-card"><div class="stat-icon purple">S</div><div class="stat-info"><h4>服务数</h4><span class="value">${ov.total_services || 0}</span></div></div>
            </div>`;
    },

    renderCharts(cd) {
        let html = '<div class="grid-2 mb-16">';
        if (cd.process_by_user && cd.process_by_user.labels?.length) {
            html += '<div class="card"><div class="card-title mb-8">进程用户分布</div><div class="chart-container"><canvas id="chart-proc-user"></canvas></div></div>';
        }
        if (cd.network_connections && cd.network_connections.labels?.length) {
            html += '<div class="card"><div class="card-title mb-8">网络连接状态</div><div class="chart-container"><canvas id="chart-net-conn"></canvas></div></div>';
        }
        if (cd.service_status && cd.service_status.labels?.length) {
            html += '<div class="card"><div class="card-title mb-8">服务状态</div><div class="chart-container"><canvas id="chart-svc"></canvas></div></div>';
        }
        if (cd.user_privilege && cd.user_privilege.labels?.length) {
            html += '<div class="card"><div class="card-title mb-8">用户权限分布</div><div class="chart-container"><canvas id="chart-user-priv"></canvas></div></div>';
        }
        html += '</div>';
        return html;
    },

    renderParsedData(parsed) {
        if (!parsed || !parsed.system_info) return '';
        const si = parsed.system_info;
        let html = '<div class="card mb-16"><div class="card-title mb-16">系统信息</div>';
        html += `<div class="report-item"><span class="key">主机名</span><span class="value">${escHtml(si.hostname)}</span></div>`;
        html += `<div class="report-item"><span class="key">操作系统</span><span class="value">${escHtml(si.os_name)} ${escHtml(si.os_version)}</span></div>`;
        html += `<div class="report-item"><span class="key">架构</span><span class="value">${escHtml(si.os_arch)}</span></div>`;
        html += `<div class="report-item"><span class="key">CPU</span><span class="value">${escHtml(si.cpu_model)} (${si.cpu_cores}核)</span></div>`;
        html += `<div class="report-item"><span class="key">内存</span><span class="value">${escHtml(si.total_memory)}</span></div>`;
        html += `<div class="report-item"><span class="key">运行时间</span><span class="value">${escHtml(si.uptime)}</span></div>`;
        html += `<div class="report-item"><span class="key">当前用户</span><span class="value">${escHtml(si.current_user)}</span></div>`;
        html += '</div>';

        if (parsed.users?.length) {
            const admins = parsed.users.filter(u => u.is_admin);
            html += `<div class="card mb-16"><div class="card-title mb-16">用户账户 (管理员:${admins.length} / 总计:${parsed.users.length})</div><div class="table-container"><table><thead><tr><th>用户名</th><th>UID</th><th>组</th><th>管理员</th><th>最后登录</th></tr></thead><tbody>`;
            parsed.users.slice(0, 10).forEach(u => {
                html += `<tr><td>${escHtml(u.username)}</td><td>${escHtml(u.uid)}</td><td>${escHtml(u.group)}</td><td>${u.is_admin ? '<span class="badge badge-danger">是</span>' : '<span class="badge badge-info">否</span>'}</td><td>${escHtml(u.last_login)}</td></tr>`;
            });
            html += `</tbody></table></div>`;
            if (parsed.users.length > 10) {
                html += `<button class="btn btn-outline btn-sm mt-8" onclick="ReportPage.showUsersModal()">查看全部用户 (${parsed.users.length}个)</button>`;
            }
            html += `</div>`;
            this._usersData = parsed.users;
        }

        if (parsed.processes?.length) {
            // Sort by combined CPU+memory score
            const sorted = [...parsed.processes].sort((a, b) => {
                const scoreA = parseFloat(a.cpu) + parseFloat(a.memory);
                const scoreB = parseFloat(b.cpu) + parseFloat(b.memory);
                return scoreB - scoreA;
            });
            const topN = sorted.slice(0, 10);
            const rest = sorted.slice(10);
            html += `<div class="card mb-16"><div class="card-title mb-16">进程列表 (TOP10 / 共${parsed.processes.length})</div><div class="table-container"><table><thead><tr><th>PID</th><th>进程名</th><th>用户</th><th>CPU%</th><th>内存</th></tr></thead><tbody>`;
            topN.forEach(p => {
                html += `<tr><td>${p.pid}</td><td><strong>${escHtml(p.name)}</strong></td><td>${escHtml(p.user)}</td><td>${p.cpu}</td><td>${p.memory}</td></tr>`;
            });
            html += `</tbody></table></div>`;
            if (rest.length) {
                html += `<button class="btn btn-outline btn-sm mt-8" onclick="ReportPage.showProcessModal()">查看全部进程详情 (${parsed.processes.length}个)</button>`;
            }
            html += `</div>`;
            // Store full data for modal
            this._processData = parsed.processes;
        }

        if (parsed.network_conns?.length) {
            const topN = parsed.network_conns.slice(0, 10);
            const listeners = parsed.network_conns.filter(c => c.state && c.state.toLowerCase().includes('listen'));
            const established = parsed.network_conns.filter(c => c.state && c.state.toLowerCase().includes('estab'));
            html += `<div class="card mb-16"><div class="card-title mb-16">网络连接 (监听:${listeners.length} | 已建立:${established.length} | 总计:${parsed.network_conns.length})</div><div class="table-container"><table><thead><tr><th>协议</th><th>本地地址</th><th>远程地址</th><th>状态</th><th>进程</th></tr></thead><tbody>`;
            topN.forEach(c => {
                const stateClass = c.state && c.state.toLowerCase().includes('listen') ? 'color:#22c55e;font-weight:600' : '';
                html += `<tr><td>${c.proto}</td><td>${escHtml(c.local_addr)}:${c.local_port}</td><td>${escHtml(c.remote_addr)}:${c.remote_port}</td><td style="${stateClass}">${escHtml(c.state)}</td><td>${escHtml(c.proc_name)} (${c.pid})</td></tr>`;
            });
            html += `</tbody></table></div>`;
            if (parsed.network_conns.length > 10) {
                html += `<button class="btn btn-outline btn-sm mt-8" onclick="ReportPage.showNetworkModal()">查看全部网络连接 (${parsed.network_conns.length}个)</button>`;
            }
            html += `</div>`;
            this._networkData = parsed.network_conns;
        }

        if (parsed.services?.length) {
            const running = parsed.services.filter(s => s.status && (s.status.toLowerCase() === 'running' || s.status === '0'));
            html += `<div class="card mb-16"><div class="card-title mb-16">服务状态 (运行中:${running.length} / 总计:${parsed.services.length})</div><div class="table-container"><table><thead><tr><th>名称</th><th>状态</th><th>启动类型</th></tr></thead><tbody>`;
            parsed.services.slice(0, 10).forEach(s => {
                const isRunning = s.status && (s.status.toLowerCase() === 'running' || s.status === '0');
                const statusBadge = isRunning ? '<span class="badge badge-success">' + escHtml(s.status) + '</span>' : '<span class="badge badge-secondary">' + escHtml(s.status) + '</span>';
                html += `<tr><td><strong>${escHtml(s.name)}</strong></td><td>${statusBadge}</td><td>${escHtml(s.start_type)}</td></tr>`;
            });
            html += `</tbody></table></div>`;
            if (parsed.services.length > 10) {
                html += `<button class="btn btn-outline btn-sm mt-8" onclick="ReportPage.showServiceModal()">查看全部服务 (${parsed.services.length}个)</button>`;
            }
            html += `</div>`;
            this._serviceData = parsed.services;
        }

        if (parsed.startup_items?.length) {
            html += `<div class="card mb-16"><div class="card-title mb-16">启动项 (${parsed.startup_items.length})</div><div class="table-container"><table><thead><tr><th>名称</th><th>命令</th><th>位置</th></tr></thead><tbody>`;
            parsed.startup_items.slice(0, 10).forEach(item => {
                html += `<tr><td>${escHtml(item.name)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.command)}</td><td>${escHtml(item.location)}</td></tr>`;
            });
            html += `</tbody></table></div>`;
            if (parsed.startup_items.length > 10) {
                html += `<button class="btn btn-outline btn-sm mt-8" onclick="ReportPage.showStartupModal()">查看全部启动项 (${parsed.startup_items.length}个)</button>`;
            }
            html += `</div>`;
            this._startupData = parsed.startup_items;
        }

        // 注册表隐藏账户
        if (parsed.reg_hidden_accounts?.length) {
            const highRisk = parsed.reg_hidden_accounts.filter(a => a.risk === 'high');
            html += `<div class="card mb-16" style="border-left:3px solid ${highRisk.length ? '#ef4444' : '#f59e0b'}"><div class="card-title mb-16">🔍 注册表隐藏账户 (${parsed.reg_hidden_accounts.length}${highRisk.length ? ' | ⚠高危:' + highRisk.length : ''})</div><div class="table-container"><table><thead><tr><th>来源</th><th>账户名</th><th>值</th><th>风险</th><th>说明</th></tr></thead><tbody>`;
            parsed.reg_hidden_accounts.forEach(a => {
                const riskBadge = a.risk === 'high' ? '<span class="badge badge-danger">高危</span>' : '<span class="badge badge-warning">中危</span>';
                html += `<tr><td><span class="badge badge-info">${escHtml(a.source)}</span></td><td><strong>${escHtml(a.name)}</strong></td><td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.value)}</td><td>${riskBadge}</td><td style="font-size:12px;color:#94a3b8">${escHtml(a.note)}</td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        }

        // 注册表计划任务路径
        if (parsed.reg_task_paths?.length) {
            html += `<div class="card mb-16"><div class="card-title mb-16">📋 注册表计划任务路径 (${parsed.reg_task_paths.length}条)</div><div class="table-container"><table><thead><tr><th>GUID</th><th>任务路径</th><th>执行动作</th></tr></thead><tbody>`;
            parsed.reg_task_paths.slice(0, 20).forEach(t => {
                html += `<tr><td style="font-family:monospace;font-size:11px">${escHtml(t.guid).substring(0, 8)}...</td><td>${escHtml(t.path)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.actions) || '-'}</td></tr>`;
            });
            if (parsed.reg_task_paths.length > 20) {
                html += `<tr><td colspan="3" style="text-align:center;color:#94a3b8">... 还有 ${parsed.reg_task_paths.length - 20} 条</td></tr>`;
            }
            html += `</tbody></table></div></div>`;
        }

        // 注册表安全关键项
        if (parsed.reg_security_keys?.length) {
            const highRiskKeys = parsed.reg_security_keys.filter(k => k.risk === 'high');
            const medRiskKeys = parsed.reg_security_keys.filter(k => k.risk === 'medium');
            html += `<div class="card mb-16" style="border-left:3px solid ${highRiskKeys.length ? '#ef4444' : '#f59e0b'}"><div class="card-title mb-16">🛡 注册表安全关键项 (${parsed.reg_security_keys.length}${highRiskKeys.length ? ' | ⚠高危:' + highRiskKeys.length : ''}${medRiskKeys.length ? ' | 注意:' + medRiskKeys.length : ''})</div><div class="table-container"><table><thead><tr><th>类别</th><th>键名</th><th>值</th><th>风险</th></tr></thead><tbody>`;
            parsed.reg_security_keys.forEach(k => {
                let riskBadgeHtml;
                switch (k.risk) {
                    case 'high': riskBadgeHtml = '<span class="badge badge-danger">高危</span>'; break;
                    case 'medium': riskBadgeHtml = '<span class="badge badge-warning">注意</span>'; break;
                    default: riskBadgeHtml = '<span class="badge badge-info">正常</span>';
                }
                html += `<tr><td><span class="badge badge-info">${escHtml(k.category)}</span></td><td><strong>${escHtml(k.name)}</strong></td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(k.value)}</td><td>${riskBadgeHtml}</td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        }

        return html;
    },

    renderAISection(report) {
        return `
            <div class="card mb-16" style="border-left:3px solid #4f46e5">
                <div class="card-header"><span class="card-title">AI 智能分析</span><span class="badge badge-success">已完成</span></div>
                <div class="ai-analysis-content">${renderMarkdown(report.ai_analysis)}</div>
            </div>`;
    },

    initCharts(container) {
        const chartConfigs = [
            { id: 'chart-proc-user', data: this.getChartData('process_by_user'), type: 'doughnut', label: '进程数' },
            { id: 'chart-net-conn', data: this.getChartData('network_connections'), type: 'pie', label: '连接数' },
            { id: 'chart-svc', data: this.getChartData('service_status'), type: 'bar', label: '服务数' },
            { id: 'chart-user-priv', data: this.getChartData('user_privilege'), type: 'doughnut', label: '用户数' }
        ];

        const colors = ['#4f46e5','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];

        chartConfigs.forEach(cfg => {
            const canvas = container.querySelector('#' + cfg.id);
            if (!canvas || !cfg.data) return;
            this.chartInstances[cfg.id] = new Chart(canvas, {
                type: cfg.type,
                data: {
                    labels: cfg.data.labels,
                    datasets: [{
                        label: cfg.label,
                        data: cfg.data.values,
                        backgroundColor: colors.slice(0, cfg.data.values.length),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 16, font: { size: 11 } } }
                    }
                }
            });
        });
    },

    getChartData(key) {
        const report = this.reports.find(r => {
            try {
                const cd = JSON.parse(r.charts_data || '{}');
                return cd[key] && cd[key].labels?.length;
            } catch(e) { return false; }
        });
        if (report) {
            try { return JSON.parse(report.charts_data || '{}')[key]; } catch(e) {}
        }
        return null;
    },

    destroyCharts() {
        Object.values(this.chartInstances).forEach(c => c.destroy());
        this.chartInstances = {};
    },

    // Modal helpers with search for all data sections
    showUsersModal() {
        const data = this._usersData || [];
        this._showSearchableModal('用户账户详情', '#user-search',
            ['用户名', 'UID', '组', '管理员', '最后登录'],
            data, u => [escHtml(u.username), escHtml(u.uid), escHtml(u.group), u.is_admin ? '是' : '否', escHtml(u.last_login)]);
    },

    showProcessModal() {
        const data = this._processData || [];
        const sorted = [...data].sort((a, b) => (parseFloat(b.cpu)+parseFloat(b.memory)) - (parseFloat(a.cpu)+parseFloat(a.memory)));
        this._showSearchableModal('进程详情', '#proc-search',
            ['PID', '名称', '用户', 'CPU%', '内存', '命令行'],
            sorted, p => [p.pid, escHtml(p.name), escHtml(p.user), p.cpu, p.memory, escHtml(p.cmd_line)]);
    },

    showNetworkModal() {
        const data = this._networkData || [];
        const modal = this._showSearchableModal('网络连接详情', '#net-search',
            ['协议', '本地', '远程', '状态', '进程', '地理位置'],
            data, c => [c.proto, escHtml(c.local_addr)+':'+c.local_port, escHtml(c.remote_addr)+':'+c.remote_port, escHtml(c.state), escHtml(c.proc_name)+' ('+c.pid+')', '<span class="geo-loading" data-ip="'+escHtml(c.remote_addr)+'">查询中...</span>']);
        // Async fetch geo IP info for public IPs
        this._fetchGeoIPs(modal);
    },

    showServiceModal() {
        const data = this._serviceData || [];
        this._showSearchableModal('服务详情', '#svc-search',
            ['名称', '显示名', '状态', '启动类型'],
            data, s => [escHtml(s.name), s.display ? escHtml(s.display) : '-', escHtml(s.status), escHtml(s.start_type)]);
    },

    showStartupModal() {
        const data = this._startupData || [];
        this._showSearchableModal('启动项详情', '#startup-search',
            ['名称', '命令', '位置'],
            data, item => [escHtml(item.name), escHtml(item.command), escHtml(item.location)]);
    },

    _showSearchableModal(title, searchId, headers, data, rowFn) {
        const existing = document.querySelector('.modal-overlay');
        if (existing) existing.remove();

        const rowHtml = data.map((d, i) => {
            const cells = rowFn(d).map(v => `<td>${v}</td>`).join('');
            return `<tr data-idx="${i}">${cells}</tr>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-width:960px;width:95%">
                <div class="modal-header">
                    <h3>${title} (${data.length}条)</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div style="padding:0 20px 12px">
                    <div class="search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="${searchId.replace('#','')}" placeholder="输入关键词搜索..." class="search-input">
                        <span class="search-count" id="${searchId.replace('#','')}-count">${data.length}条</span>
                    </div>
                </div>
                <div style="max-height:60vh;overflow:auto;padding:0 20px">
                    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${rowHtml}</tbody></table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">关闭</button>
                </div>
            </div>`;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);

        // Bind search
        const searchInput = overlay.querySelector(searchId);
        const countEl = overlay.querySelector(searchId + '-count');
        const tbody = overlay.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');

        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            let visible = 0;
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const match = !q || text.includes(q);
                row.style.display = match ? '' : 'none';
                if (match) visible++;
            });
            countEl.textContent = q ? `${visible}/${data.length}条` : `${data.length}条`;
        });

        return overlay;
    },

    async _fetchGeoIPs(modal) {
        const geoSpans = modal.querySelectorAll('.geo-loading');
        if (!geoSpans.length) return;

        // Collect unique public IPs
        const ipSet = new Set();
        const privateRE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|::1|fc|fd)/;
        geoSpans.forEach(span => {
            const ip = span.dataset.ip;
            if (ip && !privateRE.test(ip) && ip !== '*' && ip !== '0.0.0.0' && ip !== '::') {
                ipSet.add(ip);
            }
        });

        const uniqueIPs = [...ipSet].slice(0, 100); // Limit to 100 per request
        if (!uniqueIPs.length) {
            geoSpans.forEach(s => { s.textContent = '-'; s.classList.remove('geo-loading'); });
            return;
        }

        try {
            const resp = await fetch('http://ip-api.com/batch?lang=zh-CN', {
                method: 'POST',
                body: JSON.stringify(uniqueIPs),
                headers: { 'Content-Type': 'application/json' }
            });
            const results = await resp.json();
            const geoMap = {};
            if (Array.isArray(results)) {
                results.forEach((r, i) => {
                    const ip = uniqueIPs[i];
                    if (r.status === 'success') {
                        geoMap[ip] = [r.country, r.city, r.org].filter(Boolean).join(' / ');
                    } else {
                        geoMap[ip] = '未知';
                    }
                });
            }

            geoSpans.forEach(span => {
                span.textContent = geoMap[span.dataset.ip] || '-';
                span.classList.remove('geo-loading');
            });
        } catch (e) {
            geoSpans.forEach(s => { s.textContent = '查询失败'; s.classList.remove('geo-loading'); });
        }
    },
};