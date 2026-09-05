/* ==========================================================================
   lattesZen — Cliente Google Drive (OAuth + primitivas REST, sem backend)
   --------------------------------------------------------------------------
   Camada fina sobre a Google Identity Services (autenticação, popup de
   consentimento do próprio usuário) e a Drive API v3 (fetch com Bearer
   token). Não conhece a taxonomia do Lattes nem a estrutura de pastas do
   app — storage.js usa isto como back-end alternativo à File System Access
   API (pasta local), operando só sobre arquivos que o próprio app cria
   (escopo drive.file — nunca o restante do Drive do usuário).
   ========================================================================== */
window.GDriveClient = (function () {
    const BASE = 'https://www.googleapis.com/drive/v3';
    const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
    const SCOPE = 'https://www.googleapis.com/auth/drive.file';

    let clientId = null;
    let tokenClient = null;
    let accessToken = null;
    let tokenExpiresAt = 0;

    function configure(id) { clientId = id || null; }
    function isConfigured() { return !!clientId; }
    function isConnected() { return !!accessToken; }

    function loadGis() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Não foi possível carregar o script de autenticação do Google — verifique sua conexão.'));
            document.head.appendChild(script);
        });
    }

    async function ensureTokenClient() {
        await loadGis();
        if (!tokenClient) {
            tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => {} });
        }
        return tokenClient;
    }

    function requestToken(prompt) {
        return new Promise(async (resolve, reject) => {
            if (!clientId) { reject(new Error('Client ID do Google não configurado neste site.')); return; }
            let client;
            try { client = await ensureTokenClient(); } catch (e) { reject(e); return; }
            client.callback = (resp) => {
                if (resp.error) { reject(new Error('Autorização do Google recusada ou cancelada (' + resp.error + ').')); return; }
                accessToken = resp.access_token;
                tokenExpiresAt = Date.now() + (resp.expires_in || 3600) * 1000;
                resolve(accessToken);
            };
            client.requestAccessToken({ prompt });
        });
    }

    // Abre o consentimento (interação do usuário) — só chamar a partir de um clique.
    async function connectInteractive() { return requestToken('consent'); }
    // Tenta renovar sem interação (sessão Google ativa + consentimento já concedido antes).
    async function connectSilent() { return requestToken(''); }

    function disconnect() {
        if (accessToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
            try { window.google.accounts.oauth2.revoke(accessToken, () => {}); } catch (_) {}
        }
        accessToken = null;
        tokenExpiresAt = 0;
    }

    async function ensureFreshToken() {
        if (accessToken && Date.now() < tokenExpiresAt - 60000) return accessToken;
        return connectSilent(); // lança se não conseguir renovar sem interação
    }

    async function req(method, url, opts) {
        opts = opts || {};
        await ensureFreshToken();
        async function tentar() {
            const headers = Object.assign({ Authorization: `Bearer ${accessToken}` }, opts.headers || {});
            try { return await fetch(url, { method, headers, body: opts.body }); }
            catch (e) {
                const err = new Error('Não foi possível conectar ao Google Drive — verifique sua conexão.');
                err.isNetworkError = true;
                throw err;
            }
        }
        let resp = await tentar();
        if (resp.status === 401) {
            // Token pode ter sido revogado/expirado fora do previsto — tenta renovar 1x.
            accessToken = null;
            await ensureFreshToken();
            resp = await tentar();
        }
        if (opts.okStatuses && opts.okStatuses.includes(resp.status)) return resp;
        if (!resp.ok) {
            const err = new Error(`Google Drive: ${method} → HTTP ${resp.status}`);
            err.status = resp.status;
            throw err;
        }
        return resp;
    }

    // Verifica a conexão e retorna o e-mail da conta conectada (usado para
    // abrir o Drive certo quando o navegador tem mais de uma conta Google
    // logada — ver Storage.gdriveFolderUrl).
    async function testConnection() {
        const resp = await req('GET', `${BASE}/about?fields=user(emailAddress)`, { okStatuses: [200] });
        try { const json = await resp.json(); return (json.user && json.user.emailAddress) || null; } catch (_) { return null; }
    }

    function escapeQ(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

    async function findChild(parentId, name, opts) {
        opts = opts || {};
        let q = `'${escapeQ(parentId)}' in parents and name = '${escapeQ(name)}' and trashed = false`;
        if (opts.foldersOnly) q += ` and mimeType = 'application/vnd.google-apps.folder'`;
        if (opts.excludeFolders) q += ` and mimeType != 'application/vnd.google-apps.folder'`;
        const resp = await req('GET', `${BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&spaces=drive`, { okStatuses: [200] });
        const json = await resp.json();
        return (json.files && json.files[0]) ? json.files[0].id : null;
    }
    async function findFolder(parentId, name) { return findChild(parentId, name, { foldersOnly: true }); }
    async function findFile(parentId, name) { return findChild(parentId, name, { excludeFolders: true }); }

    async function createFolder(parentId, name) {
        const resp = await req('POST', `${BASE}/files?fields=id`, {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
            okStatuses: [200],
        });
        return (await resp.json()).id;
    }
    async function ensureFolder(parentId, name) {
        const existing = await findFolder(parentId, name);
        return existing || createFolder(parentId, name);
    }

    // Lista os filhos diretos de uma pasta (arquivos e subpastas).
    async function listChildren(parentId) {
        const q = `'${escapeQ(parentId)}' in parents and trashed = false`;
        const resp = await req('GET', `${BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size)&pageSize=1000&spaces=drive`, { okStatuses: [200] });
        const json = await resp.json();
        return (json.files || []).map((f) => ({
            id: f.id, name: f.name,
            isDir: f.mimeType === 'application/vnd.google-apps.folder',
            size: f.size ? Number(f.size) : null,
        }));
    }

    const MIME_BY_EXT = {
        json: 'application/json', pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm',
        mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', zip: 'application/zip',
        tar: 'application/x-tar', gz: 'application/gzip',
    };
    function guessMime(name, data) {
        if (data && data.type) return data.type;
        const m = String(name).match(/\.([^.]+)$/);
        return (m && MIME_BY_EXT[m[1].toLowerCase()]) || 'application/octet-stream';
    }

    async function createFile(parentId, name, data) {
        const mimeType = guessMime(name, data);
        const boundary = 'lzb_' + Math.random().toString(36).slice(2);
        const metadata = JSON.stringify({ name, parents: [parentId] });
        const contentBlob = (data instanceof Blob) ? data : new Blob([data], { type: mimeType });
        const body = new Blob([
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
            `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
            contentBlob,
            `\r\n--${boundary}--`,
        ]);
        const resp = await req('POST', `${UPLOAD_BASE}/files?uploadType=multipart&fields=id`, {
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
            body,
            okStatuses: [200],
        });
        return (await resp.json()).id;
    }
    async function updateFileContent(fileId, name, data) {
        const mimeType = guessMime(name, data);
        const contentBlob = (data instanceof Blob) ? data : new Blob([data], { type: mimeType });
        await req('PATCH', `${UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
            headers: { 'Content-Type': mimeType },
            body: contentBlob,
            okStatuses: [200],
        });
    }
    // Cria OU atualiza (por nome, dentro da pasta) — replica a semântica de
    // "escrever no caminho" da pasta local/WebDAV, já que o Drive permite
    // nomes duplicados na mesma pasta (por isso o find-antes-de-criar).
    async function upsertFile(parentId, name, data) {
        const existingId = await findFile(parentId, name);
        if (existingId) { await updateFileContent(existingId, name, data); return existingId; }
        return createFile(parentId, name, data);
    }

    async function getFileContent(fileId) {
        const resp = await req('GET', `${BASE}/files/${fileId}?alt=media`, { okStatuses: [200, 404] });
        return resp.status === 404 ? null : await resp.blob();
    }
    async function deleteFile(fileId) {
        await req('DELETE', `${BASE}/files/${fileId}`, { okStatuses: [200, 204, 404] });
    }
    async function removeFileIfExists(parentId, name) {
        const id = await findFile(parentId, name);
        if (id) await deleteFile(id);
    }
    async function renameFile(fileId, newName) {
        await req('PATCH', `${BASE}/files/${fileId}`, {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName }),
            okStatuses: [200],
        });
    }
    async function moveFile(fileId, addParentId, removeParentId) {
        const url = `${BASE}/files/${fileId}?addParents=${encodeURIComponent(addParentId)}&removeParents=${encodeURIComponent(removeParentId)}`;
        await req('PATCH', url, { headers: { 'Content-Type': 'application/json' }, body: '{}', okStatuses: [200] });
    }
    async function moveAndRename(fileId, addParentId, removeParentId, newName) {
        const url = `${BASE}/files/${fileId}?addParents=${encodeURIComponent(addParentId)}&removeParents=${encodeURIComponent(removeParentId)}`;
        await req('PATCH', url, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }), okStatuses: [200] });
    }

    return {
        configure, isConfigured, isConnected, connectInteractive, connectSilent, disconnect, testConnection,
        findFolder, findFile, createFolder, ensureFolder, listChildren,
        createFile, updateFileContent, upsertFile, getFileContent, deleteFile, removeFileIfExists,
        renameFile, moveFile, moveAndRename,
    };
})();
