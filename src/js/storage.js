/* ==========================================================================
   lattesZen — Camada de armazenamento
   --------------------------------------------------------------------------
   - Índice do catálogo: localStorage (chave lz_catalog) — funciona sempre.
   - Arquivos (ID.pdf / ID.json): File System Access API, num diretório
     escolhido pelo usuário e persistido no IndexedDB (o handle é
     estruturável-clonável e sobrevive entre sessões, mediante permissão).
   ========================================================================== */
window.Storage = (function () {
    const K = APP_CONFIG.storageKeys;
    const IDB_NAME = 'lattesZen';
    const IDB_STORE = 'handles';
    const IDB_KEY = 'dirHandle';

    /* ---------------- IndexedDB (guarda o handle do diretório) ------------- */
    function idb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async function idbSet(key, val) {
        const db = await idb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(val, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    async function idbGet(key) {
        const db = await idb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const r = tx.objectStore(IDB_STORE).get(key);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    }
    async function idbDel(key) {
        const db = await idb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /* -------------------------- Diretório (FS Access) --------------------- */
    let dirHandle = null;

    const supportsFS = 'showDirectoryPicker' in window;

    /* ---------------- Google Drive (alternativa à pasta local) -------------
       `mode` decide qual back-end os métodos de arquivo abaixo usam. Em modo
       'gdrive', `gdriveCfg` guarda { pasta, rootFolderId, folderCache } — o
       Drive não tem "caminho" de verdade (só relações pai/filho por ID), por
       isso o cache: evita relistar/recriar a mesma cadeia de pastas a cada
       operação. Persiste em settings; o token de acesso em si NUNCA é salvo
       (fica só em memória, renovado via GDriveClient quando preciso).
       ------------------------------------------------------------------- */
    let mode = 'local'; // 'local' | 'gdrive'
    let gdriveCfg = null;
    function storageMode() { return mode; }
    function persistGDriveConfig() {
        const s = loadSettings();
        s.gdrive = { pasta: gdriveCfg.pasta, rootFolderId: gdriveCfg.rootFolderId, folderCache: gdriveCfg.folderCache, email: gdriveCfg.email || null };
        saveSettings(s);
    }
    // E-mail da conta Google conectada, buscando e guardando em cache (na
    // config em memória + settings) se ainda não tiver sido resolvido nesta
    // conexão (ex.: conexões feitas antes desse recurso existir).
    async function ensureGDriveEmail() {
        if (gdriveCfg.email) return gdriveCfg.email;
        try {
            const email = await window.GDriveClient.testConnection();
            if (email) { gdriveCfg.email = email; persistGDriveConfig(); }
            return email;
        } catch (_) { return null; }
    }
    // Resolve o ID da pasta correspondente a um caminho relativo à pasta raiz
    // (ex.: "Evidências/01 Dados gerais"), criando cada segmento se `create`.
    // Usa e alimenta o cache por caminho completo (e por prefixo, ao longo do
    // caminho) para não repetir buscas já feitas.
    async function resolveFolder(path, create) {
        if (!path) return gdriveCfg.rootFolderId;
        const cache = gdriveCfg.folderCache;
        if (cache[path]) return cache[path];
        const segs = String(path).split('/').filter(Boolean);
        let parentId = gdriveCfg.rootFolderId;
        let acumulado = '';
        for (const seg of segs) {
            acumulado = acumulado ? `${acumulado}/${seg}` : seg;
            if (cache[acumulado]) { parentId = cache[acumulado]; continue; }
            const id = create ? await window.GDriveClient.ensureFolder(parentId, seg) : await window.GDriveClient.findFolder(parentId, seg);
            if (!id) return null;
            cache[acumulado] = id;
            parentId = id;
        }
        persistGDriveConfig();
        return parentId;
    }
    // Localiza a pasta MAIS PROFUNDA que já existe na cadeia de um
    // subdiretório, sem criar nada — ex.: se "Evidências/Formação" ainda não
    // existe (nenhum arquivo enviado ali) mas "Evidências" existe, retorna o
    // ID de "Evidências" (exact: false). Sempre resolve a algo — na pior das
    // hipóteses, a própria pasta raiz do lattesZen no Drive (exact: true
    // quando path vazio). Erros de rede/autenticação SOBEM pro chamador (não
    // são confundidos com "pasta não existe").
    async function resolveDeepestExistingFolder(path) {
        if (!path) return { id: gdriveCfg.rootFolderId, exact: true };
        const cache = gdriveCfg.folderCache;
        if (cache[path]) return { id: cache[path], exact: true };
        const segs = String(path).split('/').filter(Boolean);
        let parentId = gdriveCfg.rootFolderId;
        let acumulado = '';
        for (const seg of segs) {
            acumulado = acumulado ? `${acumulado}/${seg}` : seg;
            if (cache[acumulado]) { parentId = cache[acumulado]; continue; }
            const id = await window.GDriveClient.findFolder(parentId, seg);
            if (!id) return { id: parentId, exact: false };
            cache[acumulado] = id;
            parentId = id;
        }
        persistGDriveConfig();
        return { id: parentId, exact: true };
    }
    // URL da pasta no Google Drive de um subdiretório — a pasta exata se já
    // existir, ou a pasta ancestral mais próxima que existir (sempre abre em
    // algum lugar do Drive; nunca falha por "pasta não existe" sozinho).
    // Retorna null só fora do modo Google Drive. Erros de rede/autenticação
    // sobem pro chamador — ver AppCore.openGDriveFolder.
    async function gdriveFolderUrl(subdir) {
        if (mode !== 'gdrive' || !gdriveCfg) return null;
        const { id: parentId, exact } = await resolveDeepestExistingFolder(subdir);
        const email = await ensureGDriveEmail();
        const base = `https://drive.google.com/drive/folders/${parentId}`;
        return { url: email ? `${base}?authuser=${encodeURIComponent(email)}` : base, exact };
    }
    // Abre o seletor de arquivos do Google (Picker) pra anexar, como
    // evidência, um arquivo já existente no Drive do usuário (em vez de
    // enviar do computador). Baixa o conteúdo na hora (fica pronto pra
    // entrar no mesmo fluxo de evidências que um arquivo local) e informa se
    // o arquivo escolhido já estava dentro da pasta do lattesZen no Drive —
    // nesse caso, o chamador deve apagar o original depois de gravar a cópia
    // com o nome/pasta corretos (efeito de "mover"); se estava fora, o
    // original fica intocado (efeito de "copiar"). Retorna null se o usuário
    // cancelar o seletor.
    async function pickDriveEvidenceFile() {
        if (mode !== 'gdrive' || !gdriveCfg) throw new Error('Conecte o Google Drive antes de usar este recurso.');
        const picked = await window.GDriveClient.pickFile(APP_CONFIG.googlePickerApiKey);
        if (!picked) return null;
        const driveSourceInside = await window.GDriveClient.isDescendantOf(picked.id, gdriveCfg.rootFolderId);
        const blob = await window.GDriveClient.getFileContent(picked.id);
        if (!blob) throw new Error('Não foi possível baixar o conteúdo do arquivo selecionado.');
        const file = new File([blob], picked.name, { type: blob.type || picked.mimeType || 'application/octet-stream' });
        return { file, driveSourceId: picked.id, driveSourceInside };
    }
    // Completa o efeito de "mover" após pickDriveEvidenceFile(): apaga o
    // arquivo original no Drive (só deveria ser chamado depois que a cópia já
    // foi gravada com sucesso no lugar certo). Silencioso em caso de falha —
    // o pior cenário é uma sobra no Drive, não um dado perdido.
    async function deleteDriveFileById(fileId) {
        if (mode !== 'gdrive') return;
        try { await window.GDriveClient.deleteFile(fileId); } catch (_) {}
    }
    async function connectGoogleDrive(cfg) {
        const pasta = String((cfg && cfg.pasta) || '').trim() || 'lattesZen';
        window.GDriveClient.configure(APP_CONFIG.googleDriveClientId);
        await window.GDriveClient.connectInteractive(); // abre o consentimento do Google
        const email = await window.GDriveClient.testConnection();
        const rootFolderId = await window.GDriveClient.ensureFolder('root', pasta);
        gdriveCfg = { pasta, rootFolderId, folderCache: {}, email: email || null };
        mode = 'gdrive';
        persistGDriveConfig();
        return gdriveCfg;
    }

    // Copia recursivamente TODO o conteúdo da pasta LOCAL ativa (dirHandle)
    // para dentro da pasta já conectada no Google Drive (gdriveCfg), mantendo
    // a mesma estrutura de subpastas. Usado na migração local → Drive:
    // conectGoogleDrive() já deve ter rodado antes (gdriveCfg preenchido).
    // NÃO apaga nada da pasta local — é só cópia; quem chama decide depois
    // se orienta o usuário a excluir a pasta local manualmente. Idempotente:
    // se falhar no meio e for chamada de novo, os arquivos já copiados só são
    // sobrescritos (upsertFile), não duplicados.
    async function migrateLocalToGoogleDrive(onProgress) {
        if (!dirHandle) throw new Error('Nenhuma pasta local configurada para migrar.');
        if (!gdriveCfg) throw new Error('Conecte ao Google Drive antes de migrar os arquivos.');
        let copiados = 0;
        async function copyDir(localHandle, driveParentId) {
            for await (const [name, h] of localHandle.entries()) {
                if (h.kind === 'file') {
                    const file = await h.getFile();
                    await window.GDriveClient.upsertFile(driveParentId, name, file);
                    copiados++;
                    if (onProgress) onProgress(copiados, name);
                } else if (h.kind === 'directory') {
                    const subId = await window.GDriveClient.ensureFolder(driveParentId, name);
                    await copyDir(h, subId);
                }
            }
        }
        await copyDir(dirHandle, gdriveCfg.rootFolderId);
        return copiados;
    }

    async function verifyPermission(handle, readWrite = true) {
        const opts = { mode: readWrite ? 'readwrite' : 'read' };
        if ((await handle.queryPermission(opts)) === 'granted') return true;
        if ((await handle.requestPermission(opts)) === 'granted') return true;
        return false;
    }

    async function chooseDirectory() {
        if (!supportsFS) throw new Error('Navegador sem suporte à File System Access API (use Chrome ou Edge).');
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        dirHandle = handle;
        mode = 'local';
        await idbSet(IDB_KEY, handle);
        return handle;
    }

    // Restaura a config salva (pasta local OU Google Drive), sem pedir
    // permissão/reautenticar automaticamente. Drive tem prioridade se ambos
    // estiverem salvos (não deveria acontecer via UI normal).
    async function restoreDirectory() {
        const s = loadSettings();
        if (s.gdrive && s.gdrive.rootFolderId) {
            gdriveCfg = { pasta: s.gdrive.pasta, rootFolderId: s.gdrive.rootFolderId, folderCache: s.gdrive.folderCache || {}, email: s.gdrive.email || null };
            mode = 'gdrive';
            window.GDriveClient.configure(APP_CONFIG.googleDriveClientId);
            return gdriveCfg;
        }
        if (!supportsFS) return null;
        const handle = await idbGet(IDB_KEY);
        if (handle) { dirHandle = handle; mode = 'local'; }
        return handle || null;
    }

    async function ensureDirReady() {
        if (!dirHandle) throw new Error('Nenhum diretório configurado. Vá em Configurações e escolha uma pasta.');
        const ok = await verifyPermission(dirHandle, true);
        if (!ok) throw new Error('Permissão de escrita negada para o diretório.');
        return dirHandle;
    }

    function hasDirectory() { return mode === 'gdrive' ? !!gdriveCfg : !!dirHandle; }
    async function directoryName() {
        if (mode === 'gdrive') return gdriveCfg ? `Google Drive — /${gdriveCfg.pasta}` : null;
        return dirHandle ? dirHandle.name : null;
    }

    // Verifica se a pasta configurada ainda está acessível de verdade — não
    // só se HÁ um handle guardado, mas se a permissão continua concedida e se
    // a pasta em si ainda existe no disco (pode ter sido movida, renomeada ou
    // apagada fora do navegador, o que não revoga a permissão sozinho).
    // { requestIfNeeded: true } reprograma a permissão (mostra o prompt do
    // navegador) — só use isso a partir de um clique do usuário (gesto),
    // nunca em checagem automática (silenciosa) ao abrir o app.
    async function checkHealth(opts) {
        opts = opts || {};
        if (mode === 'gdrive') {
            if (!gdriveCfg) return { ok: true, hasDir: false };
            try {
                await window.GDriveClient.testConnection();
                return { ok: true, hasDir: true };
            } catch (e) {
                if (e.status === 401 || e.status === 403) return { ok: false, hasDir: true, reason: 'permission', message: e.message };
                if (e.isNetworkError) return { ok: false, hasDir: true, reason: 'network', message: e.message };
                return { ok: false, hasDir: true, reason: 'missing', message: e.message };
            }
        }
        if (!dirHandle) return { ok: true, hasDir: false };
        try {
            let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted' && opts.requestIfNeeded) {
                perm = await dirHandle.requestPermission({ mode: 'readwrite' });
            }
            if (perm !== 'granted') return { ok: false, hasDir: true, reason: 'permission' };
        } catch (e) {
            return { ok: false, hasDir: true, reason: 'permission', message: e.message };
        }
        // Sondagem leve, só de leitura: se a pasta em si não existir mais,
        // isso falha (ex.: NotFoundError) mesmo com a permissão concedida.
        try { await dirHandle.values().next(); }
        catch (e) { return { ok: false, hasDir: true, reason: 'missing', message: e.message }; }
        return { ok: true, hasDir: true };
    }

    async function forgetDirectory() {
        if (mode === 'gdrive') {
            window.GDriveClient.disconnect();
            gdriveCfg = null;
            const s = loadSettings(); delete s.gdrive; saveSettings(s);
            mode = 'local';
            return;
        }
        dirHandle = null;
        await idbDel(IDB_KEY);
    }

    /* -------------------------- Escrita de arquivos ---------------------- */
    // Anda por um caminho de subdiretórios ("A/B/C"), criando cada segmento
    // se `create` for true. Usado porque a File System Access API só resolve
    // um nível por chamada — não aceita caminhos com "/" de uma vez.
    async function walkDir(dir, subdirPath, create) {
        if (!subdirPath) return dir;
        let d = dir;
        for (const seg of String(subdirPath).split('/').filter(Boolean)) {
            d = await d.getDirectoryHandle(seg, { create: !!create });
        }
        return d;
    }

    // Cria os subdiretórios (um por categoria) dentro da pasta escolhida.
    // Cada nome pode ser um caminho com "/" (ex.: "Evidências/01 Dados gerais").
    async function ensureSubdirs(names) {
        if (mode === 'gdrive') {
            for (const name of names) { try { await resolveFolder(name, true); } catch (_) {} }
            return;
        }
        const dir = await ensureDirReady();
        for (const name of names) {
            try { await walkDir(dir, name, true); } catch (_) {}
        }
    }

    // Resolve o diretório-alvo: a raiz ou um subdiretório/caminho (criado se necessário)
    async function targetDir(subdir) {
        const dir = await ensureDirReady();
        return walkDir(dir, subdir, true);
    }

    async function writeFile(filename, data, subdir) {
        if (mode === 'gdrive') {
            const parentId = await resolveFolder(subdir, true);
            await window.GDriveClient.upsertFile(parentId, filename, data);
            return;
        }
        const dir = await targetDir(subdir);
        const fh = await dir.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(data);
        await w.close();
    }

    async function writeJson(id, obj, subdir) {
        await writeFile(`${id}.json`, JSON.stringify(obj, null, 2), subdir);
    }

    const ATTACH_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'zip', 'tar', 'gz'];

    /* ------------------------- Bandeja de entrada ------------------------ */
    // Caixa de Entrada: pasta onde o usuário deposita arquivos ainda não
    // catalogados. Processados: subpasta (dentro dela) para onde o
    // original é movido depois de catalogado.
    const INBOX_FOLDER = 'Caixa de Entrada';
    const PROCESSED_FOLDER = 'Processados';

    async function inboxDir(create) {
        const dir = await ensureDirReady();
        return dir.getDirectoryHandle(INBOX_FOLDER, { create: !!create });
    }
    async function ensureInbox() {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return;
            try { await resolveFolder(INBOX_FOLDER, true); } catch (_) {}
            try { await resolveFolder(`${INBOX_FOLDER}/${PROCESSED_FOLDER}`, true); } catch (_) {}
            return;
        }
        const inbox = await inboxDir(true);
        await inbox.getDirectoryHandle(PROCESSED_FOLDER, { create: true });
    }
    // Lista os arquivos (PDF/imagem) pendentes na Inbox (ignora subpastas)
    async function listInbox() {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return [];
            const parentId = await resolveFolder(INBOX_FOLDER, false);
            if (!parentId) return [];
            let children; try { children = await window.GDriveClient.listChildren(parentId); } catch (_) { return []; }
            const out = [];
            for (const child of children) {
                if (child.isDir) continue;
                const m = child.name.match(/\.([^.]+)$/);
                const ext = m ? m[1].toLowerCase() : '';
                if (!ATTACH_EXTS.includes(ext)) continue;
                out.push({ name: child.name, ext, size: child.size });
            }
            out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            return out;
        }
        let inbox; try { inbox = await inboxDir(true); } catch (_) { return []; }
        const out = [];
        for await (const [name, h] of inbox.entries()) {
            if (h.kind !== 'file') continue;
            const m = name.match(/\.([^.]+)$/);
            const ext = m ? m[1].toLowerCase() : '';
            if (!ATTACH_EXTS.includes(ext)) continue;
            let size = null;
            try { size = (await h.getFile()).size; } catch (_) {}
            out.push({ name, ext, size });
        }
        out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        return out;
    }
    async function readInboxFile(name) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return null;
            const parentId = await resolveFolder(INBOX_FOLDER, false);
            if (!parentId) return null;
            const fileId = await window.GDriveClient.findFile(parentId, name);
            return fileId ? window.GDriveClient.getFileContent(fileId) : null;
        }
        const inbox = await inboxDir(true);
        const fh = await inbox.getFileHandle(name);
        return fh.getFile();
    }
    // Move o original da Inbox para Processados; sufixa em caso de colisão.
    async function moveInboxToProcessed(name) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return name;
            const inboxId = await resolveFolder(INBOX_FOLDER, true);
            const procId = await resolveFolder(`${INBOX_FOLDER}/${PROCESSED_FOLDER}`, true);
            const dot = name.lastIndexOf('.');
            const base = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : '';
            const procChildren = await window.GDriveClient.listChildren(procId);
            const existingNames = new Set(procChildren.filter((c) => !c.isDir).map((c) => c.name));
            let target = name, n = 2;
            while (existingNames.has(target)) { target = `${base}-${n}${ext}`; n++; }
            const fileId = await window.GDriveClient.findFile(inboxId, name);
            if (!fileId) return target;
            await window.GDriveClient.moveFile(fileId, procId, inboxId);
            if (target !== name) await window.GDriveClient.renameFile(fileId, target);
            return target;
        }
        const inbox = await inboxDir(true);
        const proc = await inbox.getDirectoryHandle(PROCESSED_FOLDER, { create: true });
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        const exists = async (nm) => { try { await proc.getFileHandle(nm); return true; } catch (_) { return false; } };
        let target = name, n = 2;
        while (await exists(target)) { target = `${base}-${n}${ext}`; n++; }
        const srcFh = await inbox.getFileHandle(name);
        const file = await srcFh.getFile();
        const dstFh = await proc.getFileHandle(target, { create: true });
        const w = await dstFh.createWritable();
        await w.write(file);
        await w.close();
        await inbox.removeEntry(name);
        return target;
    }

    // Grava um anexo (evidência) com base name explícito: <basename>.<ext>.
    // Remove versões anteriores do MESMO basename com outra extensão.
    async function writeAttachment(basename, fileOrBlob, subdir, ext) {
        ext = (ext || 'pdf').toLowerCase();
        for (const e of ATTACH_EXTS) if (e !== ext) {
            if (mode === 'gdrive') { try { const parentId = await resolveFolder(subdir, true); await window.GDriveClient.removeFileIfExists(parentId, `${basename}.${e}`); } catch (_) {} }
            else { try { const d = await targetDir(subdir); await d.removeEntry(`${basename}.${e}`); } catch (_) {} }
        }
        await writeFile(`${basename}.${ext}`, fileOrBlob, subdir);
    }

    // Remove um anexo específico (todas as extensões daquele basename).
    async function deleteEntry(basename, subdir) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return;
            for (const ext of ATTACH_EXTS) { try { await window.GDriveClient.removeFileIfExists(parentId, `${basename}.${ext}`); } catch (_) {} }
            return;
        }
        if (!dirHandle) return;
        let dir;
        try { dir = await walkDir(dirHandle, subdir, false); } catch (_) { return; }
        for (const ext of ATTACH_EXTS) {
            try { await dir.removeEntry(`${basename}.${ext}`); } catch (_) {}
        }
    }

    // Remove todos os arquivos de um item: <id>.json, <id>.<ext> e <id>-*.<ext>.
    async function deleteItemFiles(id, subdir) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return;
            let children; try { children = await window.GDriveClient.listChildren(parentId); } catch (_) { return; }
            for (const child of children) {
                if (child.isDir) continue;
                let rm = child.name === `${id}.json`;
                if (!rm) {
                    const m = child.name.match(/^(.*)\.([^.]+)$/);
                    if (m) { const base = m[1], ext = m[2].toLowerCase(); rm = (base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext); }
                }
                if (rm) { try { await window.GDriveClient.deleteFile(child.id); } catch (_) {} }
            }
            return;
        }
        if (!dirHandle) return;
        let dir;
        try { dir = await walkDir(dirHandle, subdir, false); } catch (_) { return; }
        const rm = [];
        for await (const [name, h] of dir.entries()) {
            if (h.kind !== 'file') continue;
            if (name === `${id}.json`) { rm.push(name); continue; }
            const m = name.match(/^(.*)\.([^.]+)$/);
            if (!m) continue;
            const base = m[1], ext = m[2].toLowerCase();
            if ((base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext)) rm.push(name);
        }
        for (const n of rm) { try { await dir.removeEntry(n); } catch (_) {} }
    }

    // Move os arquivos de um item (<id>.json, <id>.<ext>, <id>-*.<ext>) de um
    // subdiretório para outro — usado quando a CATEGORIA do item muda.
    async function moveItemFiles(id, fromSubdir, toSubdir) {
        if (mode === 'gdrive') {
            if (!gdriveCfg || fromSubdir === toSubdir) return;
            const fromId = await resolveFolder(fromSubdir, false);
            if (!fromId) return;
            let children; try { children = await window.GDriveClient.listChildren(fromId); } catch (_) { return; }
            const matches = children.filter((child) => {
                if (child.isDir) return false;
                if (child.name === `${id}.json`) return true;
                const m = child.name.match(/^(.*)\.([^.]+)$/);
                if (!m) return false;
                const base = m[1], ext = m[2].toLowerCase();
                return (base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext);
            });
            if (!matches.length) return;
            const toId = await resolveFolder(toSubdir, true);
            for (const child of matches) {
                try { await window.GDriveClient.moveFile(child.id, toId, fromId); } catch (_) { /* se falhar um, segue os demais */ }
            }
            return;
        }
        if (!dirHandle || fromSubdir === toSubdir) return;
        let from;
        try { from = await walkDir(dirHandle, fromSubdir, false); } catch (_) { return; }
        const to = await targetDir(toSubdir);
        const names = [];
        for await (const [name, h] of from.entries()) {
            if (h.kind !== 'file') continue;
            if (name === `${id}.json`) { names.push(name); continue; }
            const m = name.match(/^(.*)\.([^.]+)$/);
            if (!m) continue;
            const base = m[1], ext = m[2].toLowerCase();
            if ((base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext)) names.push(name);
        }
        for (const name of names) {
            try {
                const fh = await from.getFileHandle(name);
                const file = await fh.getFile();
                const nh = await to.getFileHandle(name, { create: true });
                const w = await nh.createWritable();
                await w.write(file);
                await w.close();
                await from.removeEntry(name);
            } catch (_) { /* se falhar um, segue os demais */ }
        }
    }

    // Remove um subdiretório obsoleto da raiz, só se estiver vazio (ex.: pasta
    // de categoria removida/renomeada numa migração). Não apaga se houver
    // qualquer arquivo restante, por segurança.
    async function removeSubdirIfEmpty(name) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return false;
            const id = await resolveFolder(name, false);
            if (!id) return false;
            let children; try { children = await window.GDriveClient.listChildren(id); } catch (_) { return false; }
            if (children.length > 0) return false;
            try { await window.GDriveClient.deleteFile(id); delete gdriveCfg.folderCache[name]; persistGDriveConfig(); return true; } catch (_) { return false; }
        }
        if (!dirHandle) return false;
        let sub;
        try { sub = await dirHandle.getDirectoryHandle(name); } catch (_) { return false; }
        for await (const _ of sub.values()) { return false; }
        try { await dirHandle.removeEntry(name, { recursive: true }); return true; } catch (_) { return false; }
    }

    // Move recursivamente TODO o conteúdo (arquivos e subpastas) de um
    // diretório para outro, mantendo a estrutura interna.
    async function moveAllContents(fromHandle, toHandle) {
        for await (const [name, h] of fromHandle.entries()) {
            if (h.kind === 'file') {
                try {
                    const file = await h.getFile();
                    const nh = await toHandle.getFileHandle(name, { create: true });
                    const w = await nh.createWritable();
                    await w.write(file);
                    await w.close();
                    await fromHandle.removeEntry(name);
                } catch (_) { /* se falhar um, segue os demais */ }
            } else if (h.kind === 'directory') {
                try {
                    const subTo = await toHandle.getDirectoryHandle(name, { create: true });
                    await moveAllContents(h, subTo);
                    await fromHandle.removeEntry(name);
                } catch (_) {}
            }
        }
    }
    // Renomeia/move uma pasta de sistema da raiz para outro nome ou caminho
    // (ex.: "00 Inbox" -> "Caixa de Entrada", ou "Exportar Lattes" ->
    // "Exportação/Lattes XML"), movendo todo o conteúdo — a File System
    // Access API não tem rename nativo. Não faz nada se a pasta antiga não existir.
    async function renameRootFolder(oldName, newPath) {
        if (mode === 'gdrive') {
            if (!gdriveCfg || oldName === newPath) return false;
            const oldId = await resolveFolder(oldName, false);
            if (!oldId) return false;
            const newSegs = String(newPath).split('/').filter(Boolean);
            const newLeaf = newSegs.pop();
            const newParentPath = newSegs.join('/');
            const newParentId = newParentPath ? await resolveFolder(newParentPath, true) : gdriveCfg.rootFolderId;
            try { await window.GDriveClient.moveAndRename(oldId, newParentId, gdriveCfg.rootFolderId, newLeaf); }
            catch (_) { return false; }
            delete gdriveCfg.folderCache[oldName];
            gdriveCfg.folderCache[newPath] = oldId;
            persistGDriveConfig();
            return true;
        }
        if (!dirHandle || oldName === newPath) return false;
        let oldHandle;
        try { oldHandle = await dirHandle.getDirectoryHandle(oldName); } catch (_) { return false; }
        const newHandle = await walkDir(dirHandle, newPath, true);
        await moveAllContents(oldHandle, newHandle);
        try { await dirHandle.removeEntry(oldName, { recursive: true }); } catch (_) {}
        return true;
    }
    // Igual a renameRootFolder, mas a pasta antiga/nova fica DENTRO de um
    // caminho pai (ex.: "00 Processado" -> "Processados" dentro de "Caixa
    // de Entrada"), não na raiz do diretório.
    async function renameNestedFolder(parentPath, oldName, newName) {
        if (mode === 'gdrive') {
            if (!gdriveCfg || oldName === newName) return false;
            const oldFull = parentPath ? `${parentPath}/${oldName}` : oldName;
            const newFull = parentPath ? `${parentPath}/${newName}` : newName;
            const oldId = await resolveFolder(oldFull, false);
            if (!oldId) return false;
            try { await window.GDriveClient.renameFile(oldId, newName); } catch (_) { return false; }
            delete gdriveCfg.folderCache[oldFull];
            gdriveCfg.folderCache[newFull] = oldId;
            persistGDriveConfig();
            return true;
        }
        if (!dirHandle || oldName === newName) return false;
        let parent;
        try { parent = await walkDir(dirHandle, parentPath, false); } catch (_) { return false; }
        let oldHandle;
        try { oldHandle = await parent.getDirectoryHandle(oldName); } catch (_) { return false; }
        const newHandle = await parent.getDirectoryHandle(newName, { create: true });
        await moveAllContents(oldHandle, newHandle);
        try { await parent.removeEntry(oldName, { recursive: true }); } catch (_) {}
        return true;
    }

    async function readAttachmentUrl(basename, subdir, ext) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return null;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return null;
            const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
            for (const e of tryExts) {
                try {
                    const fileId = await window.GDriveClient.findFile(parentId, `${basename}.${e}`);
                    if (!fileId) continue;
                    const blob = await window.GDriveClient.getFileContent(fileId);
                    if (blob) return URL.createObjectURL(blob);
                } catch (_) { /* tenta próxima */ }
            }
            return null;
        }
        const dir = await ensureDirReady();
        let target;
        try { target = await walkDir(dir, subdir, false); } catch (_) { return null; }
        const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
        for (const e of tryExts) {
            try {
                const fh = await target.getFileHandle(`${basename}.${e}`);
                const file = await fh.getFile();
                return URL.createObjectURL(file);
            } catch (_) { /* tenta próxima */ }
        }
        return null;
    }

    // Devolve o File (ou Blob, em modo Google Drive) de um anexo (para
    // embutir em base64 na página pública).
    async function readAttachmentFile(basename, subdir, ext) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return null;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return null;
            const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
            for (const e of tryExts) {
                try {
                    const fileId = await window.GDriveClient.findFile(parentId, `${basename}.${e}`);
                    if (!fileId) continue;
                    const blob = await window.GDriveClient.getFileContent(fileId);
                    if (blob) return blob;
                } catch (_) { /* tenta próxima */ }
            }
            return null;
        }
        const dir = await ensureDirReady();
        let target;
        try { target = await walkDir(dir, subdir, false); } catch (_) { return null; }
        const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
        for (const e of tryExts) {
            try { const fh = await target.getFileHandle(`${basename}.${e}`); return await fh.getFile(); }
            catch (_) { /* tenta próxima */ }
        }
        return null;
    }

    // Reconstrói o catálogo a partir dos *.json (raiz e subdiretórios de categoria)
    async function scanDirectory() {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return [];
            const items = [];
            async function scanOne(folderId) {
                let children; try { children = await window.GDriveClient.listChildren(folderId); } catch (_) { return; }
                for (const child of children) {
                    if (child.isDir) {
                        if (child.name === INBOX_FOLDER) continue; // não indexa a bandeja de entrada
                        await scanOne(child.id);
                    } else if (child.name.toLowerCase().endsWith('.json') && child.name !== 'catalogo.json' && child.name.indexOf('latteszen-') !== 0) {
                        try {
                            const blob = await window.GDriveClient.getFileContent(child.id);
                            if (!blob) continue;
                            const obj = JSON.parse(await blob.text());
                            if (obj && obj.id) items.push(obj);
                        } catch (_) { /* ignora inválidos */ }
                    }
                }
            }
            await scanOne(gdriveCfg.rootFolderId);
            return items;
        }
        const dir = await ensureDirReady();
        const items = [];
        async function scanOne(handle) {
            for await (const [name, h] of handle.entries()) {
                if (h.kind === 'file' && name.toLowerCase().endsWith('.json') && name !== 'catalogo.json' && name.indexOf('latteszen-') !== 0) {
                    try {
                        const file = await h.getFile();
                        const obj = JSON.parse(await file.text());
                        if (obj && obj.id) items.push(obj);
                    } catch (_) { /* ignora inválidos */ }
                } else if (h.kind === 'directory') {
                    if (name === INBOX_FOLDER) continue; // não indexa a bandeja de entrada
                    try { await scanOne(h); } catch (_) {}
                }
            }
        }
        await scanOne(dir);
        return items;
    }

    /* ----------------------- Catálogo (localStorage) --------------------- */
    function loadCatalog() {
        try { return JSON.parse(localStorage.getItem(K.catalog)) || []; }
        catch (_) { return []; }
    }
    function saveCatalog(items) {
        localStorage.setItem(K.catalog, JSON.stringify(items));
    }

    /* ------------------------- Lixeira (localStorage) --------------------- */
    function loadTrash() {
        try { return JSON.parse(localStorage.getItem(K.trash)) || []; }
        catch (_) { return []; }
    }
    function saveTrash(items) {
        localStorage.setItem(K.trash, JSON.stringify(items));
    }

    /* ----------------------- Configurações gerais ------------------------ */
    function loadSettings() {
        try { return JSON.parse(localStorage.getItem(K.settings)) || {}; }
        catch (_) { return {}; }
    }
    function saveSettings(s) {
        localStorage.setItem(K.settings, JSON.stringify(s));
    }

    return {
        supportsFS,
        // diretório
        chooseDirectory, restoreDirectory, ensureDirReady, hasDirectory,
        directoryName, forgetDirectory, verifyPermission, checkHealth,
        // Google Drive
        storageMode, connectGoogleDrive, migrateLocalToGoogleDrive, gdriveFolderUrl,
        pickDriveEvidenceFile, deleteDriveFileById,
        // arquivos
        writeJson, writeFile, writeAttachment, deleteEntry, deleteItemFiles, moveItemFiles, removeSubdirIfEmpty, renameRootFolder, renameNestedFolder, readAttachmentUrl, readAttachmentFile, scanDirectory, ensureSubdirs,
        // bandeja de entrada (inbox)
        ensureInbox, listInbox, readInboxFile, moveInboxToProcessed,
        // catálogo + lixeira + settings
        loadCatalog, saveCatalog, loadTrash, saveTrash, loadSettings, saveSettings,
    };
})();
