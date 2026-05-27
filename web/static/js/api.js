const API = {
    base: '/api',

    async get(url, params = {}) {
        const qs = new URLSearchParams(params).toString();
        const fullUrl = `${this.base}${url}${qs ? '?' + qs : ''}`;
        try {
            const res = await fetch(fullUrl);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (e) {
            throw e;
        }
    },

    async post(url, body = {}) {
        try {
            const res = await fetch(`${this.base}${url}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (e) {
            throw e;
        }
    },

    async put(url, body = {}) {
        try {
            const res = await fetch(`${this.base}${url}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (e) {
            throw e;
        }
    },

    async del(url) {
        try {
            const res = await fetch(`${this.base}${url}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (e) {
            throw e;
        }
    },

    async upload(url, formData) {
        try {
            const res = await fetch(`${this.base}${url}`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (e) {
            throw e;
        }
    },

    async download(url, params = {}) {
        const qs = new URLSearchParams(params).toString();
        const fullUrl = `${this.base}${url}${qs ? '?' + qs : ''}`;
        const res = await fetch(fullUrl);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Download failed');
        }
        const blob = await res.blob();
        const taskId = res.headers.get('X-Task-ID');
        return { blob, taskId };
    },

    scripts: {
        list() { return API.get('/scripts/list'); },
        download(params) { return API.download('/scripts/download', params); }
    },

    tasks: {
        list() { return API.get('/tasks'); },
        create(data) { return API.post('/tasks', data); },
        get(id) { return API.get(`/tasks/${id}`); },
        update(id, data) { return API.put(`/tasks/${id}`, data); },
        delete(id) { return API.del(`/tasks/${id}`); }
    },

    reports: {
        list() { return API.get('/reports'); },
        get(id) { return API.get(`/reports/${id}`); },
        upload(formData) { return API.upload('/reports/upload', formData); },
        delete(id) { return API.del(`/reports/${id}`); }
    },

    ai: {
        analyze(data) { return API.post('/ai/analyze', data); },
        getAnalysis(taskId) { return API.get(`/ai/analysis/${taskId}`); }
    },

    chat: {
        send(data) { return API.post('/chat', data); }
    },

    conversations: {
        list() { return API.get('/conversations'); },
        create(data) { return API.post('/conversations', data); },
        delete(id) { return API.del(`/conversations/${id}`); },
        getMessages(id) { return API.get(`/conversations/${id}/messages`); },
        updateTask(id, taskId) { return API.put(`/conversations/${id}/task`, { task_id: taskId }); }
    },

    models: {
        list() { return API.get('/models'); },
        create(data) { return API.post('/models', data); },
        update(id, data) { return API.put(`/models/${id}`, data); },
        delete(id) { return API.del(`/models/${id}`); },
        activate(id) { return API.post(`/models/${id}/activate`); },
        test(id) { return API.post(`/models/${id}/test`); },
        testConnection(data) { return API.post('/models/test-connection', data); }
    }
};