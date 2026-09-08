/* ==========================================================================
   Regressão: armazenamento remoto via Google Drive (issue #12)
   --------------------------------------------------------------------------
   Não há como testar contra uma conta Google real no CI — a Google Identity
   Services (accounts.google.com/gsi/client) e a Drive API (googleapis.com)
   são simuladas: a primeira via um script fake que responde ao
   requestAccessToken() como o SDK real faria (callback com token ou erro);
   a segunda via um "Drive" mínimo em memória (pastas/arquivos com
   relação pai/filho por ID, como o Drive de verdade — sem "caminho").
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const FAKE_GIS_JS = `
window.google = window.google || {};
window.google.accounts = window.google.accounts || {};
window.google.accounts.oauth2 = {
    initTokenClient(config) {
        const client = { callback: config.callback };
        client.requestAccessToken = function () {
            setTimeout(() => {
                if (window.__gisMockError) { client.callback({ error: window.__gisMockError }); }
                else { client.callback({ access_token: 'fake-token-' + Math.random().toString(36).slice(2), expires_in: window.__gisMockExpiresIn || 3600 }); }
            }, 10);
        };
        return client;
    },
    revoke(token, cb) { if (cb) cb(); },
};
`;

async function mockGis(page) {
    await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_GIS_JS }));
}

// Servidor Drive mínimo, em memória: `files` (Map id -> {id,name,parentId,isDir,content,mimeType}).
function createMockDrive() {
    let nextId = 1;
    const files = new Map();
    files.set('root', { id: 'root', name: '', parentId: null, isDir: true, content: null });
    let offline = false;
    let forbidden = false;

    function newId() { return 'f' + (nextId++); }
    function childrenOf(parentId) { return Array.from(files.values()).filter((f) => f.parentId === parentId); }

    async function handle(route) {
        if (offline) { await route.abort('failed'); return; }
        const req = route.request();
        const method = req.method();
        const url = new URL(req.url());
        if (forbidden) { await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 401, message: 'Invalid Credentials' } }) }); return; }

        if (url.pathname === '/drive/v3/about') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { emailAddress: 'usuaria@example.com' } }) });
            return;
        }
        if (url.pathname === '/drive/v3/files' && method === 'GET') {
            const q = url.searchParams.get('q') || '';
            const parentMatch = q.match(/'([^']*)' in parents/);
            const parentId = parentMatch ? parentMatch[1] : null;
            const nameMatch = q.match(/name = '((?:[^'\\]|\\.)*)'/);
            const name = nameMatch ? nameMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : null;
            const foldersOnly = /mimeType = 'application\/vnd\.google-apps\.folder'/.test(q);
            const excludeFolders = /mimeType != 'application\/vnd\.google-apps\.folder'/.test(q);
            let results = childrenOf(parentId);
            if (name !== null) results = results.filter((f) => f.name === name);
            if (foldersOnly) results = results.filter((f) => f.isDir);
            if (excludeFolders) results = results.filter((f) => !f.isDir);
            const body = { files: results.map((f) => ({ id: f.id, name: f.name, mimeType: f.isDir ? 'application/vnd.google-apps.folder' : (f.mimeType || 'application/octet-stream'), size: f.isDir ? undefined : String((f.content || '').length) })) };
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
            return;
        }
        if (url.pathname === '/drive/v3/files' && method === 'POST') {
            const meta = JSON.parse(req.postData() || '{}');
            const id = newId();
            files.set(id, { id, name: meta.name, parentId: (meta.parents || [])[0] || 'root', isDir: meta.mimeType === 'application/vnd.google-apps.folder', content: null, mimeType: meta.mimeType });
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) });
            return;
        }
        if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
            const raw = req.postData() || '';
            const ct = req.headers()['content-type'] || '';
            const boundaryMatch = ct.match(/boundary=([^;]+)/);
            const boundary = boundaryMatch ? boundaryMatch[1] : null;
            let metaStr = '{}', content = '', mimeType = 'application/octet-stream';
            if (boundary) {
                const parts = raw.split(`--${boundary}`).filter((p) => p && p.trim() && p.trim() !== '--');
                const metaPart = parts[0] || '';
                metaStr = metaPart.slice(metaPart.indexOf('\r\n\r\n') + 4).trim();
                const contentPart = parts[1] || '';
                const headerEnd = contentPart.indexOf('\r\n\r\n');
                const headerBlock = contentPart.slice(0, headerEnd);
                const mimeMatch = headerBlock.match(/Content-Type:\s*([^\r\n]+)/);
                if (mimeMatch) mimeType = mimeMatch[1].trim();
                content = contentPart.slice(headerEnd + 4).replace(/\r\n--[^\r\n]*--\s*$/, '');
            }
            const meta = JSON.parse(metaStr || '{}');
            const id = newId();
            files.set(id, { id, name: meta.name, parentId: (meta.parents || [])[0] || 'root', isDir: false, content, mimeType });
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) });
            return;
        }
        const uploadMediaMatch = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
        if (uploadMediaMatch && method === 'PATCH') {
            const id = uploadMediaMatch[1];
            const f = files.get(id);
            if (!f) { await route.fulfill({ status: 404, body: '' }); return; }
            f.content = req.postData() || '';
            f.mimeType = req.headers()['content-type'] || f.mimeType;
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) });
            return;
        }
        const fileIdMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
        if (fileIdMatch) {
            const id = fileIdMatch[1];
            const f = files.get(id);
            if (method === 'GET') {
                if (!f) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
                if (url.searchParams.get('alt') === 'media') await route.fulfill({ status: 200, body: f.content || '' });
                else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: f.id, name: f.name, parents: f.parentId ? [f.parentId] : [] }) });
                return;
            }
            if (method === 'PATCH') {
                if (!f) { await route.fulfill({ status: 404, body: '' }); return; }
                const addParents = url.searchParams.get('addParents');
                if (addParents) f.parentId = addParents;
                const body = req.postData();
                if (body) { try { const j = JSON.parse(body); if (j.name) f.name = j.name; } catch (_) {} }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: f.id }) });
                return;
            }
            if (method === 'DELETE') {
                files.delete(id);
                for (const [cid, cf] of Array.from(files)) if (cf.parentId === id) files.delete(cid);
                await route.fulfill({ status: 204, body: '' });
                return;
            }
        }
        await route.fulfill({ status: 501, body: '' });
    }

    return {
        files,
        setOffline(v) { offline = v; },
        setForbidden(v) { forbidden = v; },
        async install(page) { await page.route('https://www.googleapis.com/**', handle); },
    };
}

async function abrirConfig(page, baseUrl) {
    await page.addInitScript((cid) => { window.__LZ_TEST_GDRIVE_CLIENT_ID = cid; }, TEST_CLIENT_ID);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

// Simula uma pasta local já escolhida (com arquivos, como se o usuário já
// tivesse um acervo) — só leitura, pra testar a migração local → Drive.
// window.showDirectoryPicker não é automatizável de verdade via Playwright,
// então é substituído por uma árvore fake em memória. Storage.chooseDirectory()
// também persiste o handle no IndexedDB de verdade (idbSet) — por isso os
// métodos (entries/getFile/etc.) ficam no PROTÓTIPO compartilhado, não como
// propriedade própria de cada objeto: o algoritmo de clonagem estruturada do
// IndexedDB clona só as propriedades PRÓPRIAS enumeráveis, então ignora o
// protótipo (sem erro de clonagem) — e o handle original em memória continua
// com os métodos disponíveis normalmente, via a cadeia de protótipos.
async function mockLocalDir(page, entries) {
    await page.addInitScript((tree) => {
        const FileProto = {
            async getFile() { return new File([this._content], this.name, { type: this._mime || 'application/octet-stream' }); },
        };
        const DirProto = {
            async queryPermission() { return 'granted'; },
            async requestPermission() { return 'granted'; },
            async *entries() {
                for (const e of this._list) {
                    if (e.kind === 'file') yield [e.name, Object.assign(Object.create(FileProto), { name: e.name, kind: 'file', _content: e.content, _mime: e.mimeType })];
                    else yield [e.name, Object.assign(Object.create(DirProto), { name: e.name, kind: 'directory', _list: e.children || [] })];
                }
            },
            async *values() { for await (const [, h] of this.entries()) yield h; },
        };
        window.showDirectoryPicker = async () => Object.assign(Object.create(DirProto), { name: 'MinhaPastaLocal', kind: 'directory', _list: tree });
    }, entries);
}

async function conectar(page, pasta) {
    // Sem diretório configurado ainda, a seção mostra o assistente guiado
    // (Primeira configuração/Já tenho → Local/Remoto) em vez dos campos do
    // Drive direto — navega os passos antes de preencher/clicar.
    if (await page.locator('[data-wizard-modo="novo"]').count()) {
        await page.click('[data-wizard-modo="novo"]');
        await page.waitForTimeout(50);
        await page.click('[data-wizard-tipo="remoto"]');
        await page.waitForTimeout(50);
    }
    if (pasta) await page.fill('#gdrivePasta', pasta);
    await page.click('#btnGDriveConnect');
    // O clique dispara conectar + criar toda a estrutura de pastas + sincronizar
    // (várias idas e vindas ao servidor mockado) — espera o botão voltar a ficar
    // habilitado (sucesso: renderConfig() troca o botão; falha: reabilitado
    // explicitamente no catch) em vez de um tempo fixo, que seria flaky aqui.
    await page.waitForFunction(() => {
        const btn = document.querySelector('#btnGDriveConnect');
        return !btn || !btn.disabled;
    }, { timeout: 8000 });
    await page.waitForTimeout(100);
}

test('Conectar ao Google Drive com sucesso cria a pasta raiz e passa a usar o Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const raiz = Array.from(mock.files.values()).find((f) => f.name === 'lattesZen' && f.isDir);
    assert(raiz, 'A pasta raiz "lattesZen" deveria ter sido criada no Drive');
    const dirLbl = await page.$eval('#dirNameLbl', (el) => el.textContent);
    assert(dirLbl.includes('Google Drive'), 'O rótulo da pasta atual deveria indicar o Google Drive como back-end em uso');
    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'gdrive', 'storageMode() deveria retornar "gdrive" após conectar com sucesso');
});

test('Autorização recusada/cancelada não conecta e mostra mensagem no formulário', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await page.addInitScript(() => { window.__gisMockError = 'access_denied'; });
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const status = await page.$eval('#gdriveStatus', (el) => el.textContent);
    assert(/recusad|cancelad/i.test(status), 'A mensagem deveria indicar que a autorização foi recusada/cancelada');
    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'local', 'Uma autorização recusada não deveria mudar o modo de armazenamento para gdrive');
});

test('checkHealth() reporta reason "network" quando a API do Drive fica inacessível', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    mock.setOffline(true);
    const health = await page.evaluate(() => window.Storage.checkHealth());
    assertEqual(health.ok, false, 'checkHealth deveria reportar falha quando a API está inacessível');
    assertEqual(health.reason, 'network', 'A falha de rede deveria ser reportada como reason "network"');
});

test('checkHealth() reporta reason "permission" quando o token é recusado (401 persistente)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    mock.setForbidden(true); // Drive API sempre 401 (simula token/consentimento revogado)
    const health = await page.evaluate(() => window.Storage.checkHealth());
    assertEqual(health.ok, false, 'checkHealth deveria reportar falha quando as credenciais são recusadas (401)');
    assertEqual(health.reason, 'permission', 'HTTP 401/403 persistente deveria ser reportado como reason "permission"');
});

test('writeJson + scanDirectory fazem round-trip via Google Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-gdrive1', { id: 'it-gdrive1', titulo: 'Item gravado via Google Drive' }, 'Produções');
    });
    const arquivo = Array.from(mock.files.values()).find((f) => f.name === 'it-gdrive1.json');
    assert(arquivo, 'O JSON deveria ter sido criado no Drive dentro da pasta "Produções"');

    const items = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(items.length, 1, 'scanDirectory deveria reconstruir exatamente o item gravado');
    assertEqual(items[0].id, 'it-gdrive1', 'O item reconstruído deveria ter o mesmo id gravado');
    assertEqual(items[0].titulo, 'Item gravado via Google Drive', 'O item reconstruído deveria ter os mesmos campos gravados');
});

// Regressão: o botão "Abrir no Google Drive" (Catalogar/Configurações) usava
// gdriveFolderUrl(subdir), que retornava null sempre que a subpasta exata
// ainda não existia (nenhum arquivo enviado ali) OU quando qualquer erro de
// rede/autenticação acontecia — os dois casos viravam o mesmo aviso enganoso
// "pasta ainda não existe". Agora: sem subpasta exata, cai pra pasta
// ancestral mais próxima (sempre abre em algum lugar do Drive); erros reais
// sobem como exceção pro chamador, sem virar esse aviso.
test('gdriveFolderUrl: cai pra pasta ancestral mais próxima antes do primeiro envio, e passa a apontar pra subpasta exata depois', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const antes = await page.evaluate(() => window.Storage.gdriveFolderUrl('Produções'));
    assert(antes && antes.url, 'Deveria retornar uma URL mesmo sem a subpasta "Produções" existir ainda');
    assertEqual(antes.exact, false, 'Sem nenhum envio em "Produções", exact deveria ser false (a URL aponta pra pasta raiz)');
    assert(/\/drive\/folders\//.test(antes.url), 'A URL deveria apontar pra uma pasta do Drive');
    assert(/authuser=usuaria%40example\.com/.test(antes.url), 'A URL deveria indicar a conta conectada via authuser');

    await page.evaluate(async () => { await window.Storage.writeJson('it-drive-url', { id: 'it-drive-url' }, 'Produções'); });
    const depois = await page.evaluate(() => window.Storage.gdriveFolderUrl('Produções'));
    assertEqual(depois.exact, true, 'Depois do 1º envio em "Produções", exact deveria ser true (a subpasta já existe)');
    assert(depois.url !== antes.url, 'A URL deveria mudar — agora aponta pra subpasta "Produções", não mais pra raiz');
});

test('gdriveFolderUrl: erro de autenticação sobe como exceção, não vira "pasta não existe"', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    mock.setForbidden(true);
    const erro = await page.evaluate(async () => {
        try { await window.Storage.gdriveFolderUrl('Produções'); return null; }
        catch (e) { return e.message || 'erro sem mensagem'; }
    });
    assert(erro, 'Um token recusado (401) deveria lançar uma exceção, não retornar silenciosamente null/undefined');
});

// Regressão: botão "Selecionar arquivo do Google Drive" (Catalogar →
// Evidências), que substituiu o antigo "abrir a pasta" — agora abre o
// Google Picker e anexa o arquivo escolhido. A UI real do Picker (iframe
// hospedado pelo Google) não é testável aqui, então window.GDriveClient.pickFile
// é substituído por um stub que devolve {id,name,mimeType} direto — o que É
// testável (e é o que realmente importa) é o que Storage.pickDriveEvidenceFile
// faz com o arquivo escolhido: baixa o conteúdo e decide mover (arquivo
// estava diretamente na Caixa de Entrada — vira evidência "da bandeja",
// movida pra Processados ao salvar) ou copiar (qualquer outro caso — dentro
// de outra pasta do app, ou fora dele — o original nunca é tocado).
test('pickDriveEvidenceFile: arquivo de FORA da pasta do app fica marcado pra copiar (original intocado)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    // Arquivo fora da árvore do lattesZen (direto na raiz do Drive do usuário).
    mock.files.set('ext1', { id: 'ext1', name: 'evidencia-externa.pdf', parentId: 'root', isDir: false, content: 'conteudo-externo', mimeType: 'application/pdf' });
    await page.evaluate(() => {
        window.GDriveClient.pickFile = async () => ({ id: 'ext1', name: 'evidencia-externa.pdf', mimeType: 'application/pdf' });
    });

    const picked = await page.evaluate(async () => {
        const p = await window.Storage.pickDriveEvidenceFile();
        return { driveSourceInbox: p.driveSourceInbox, fileName: p.file.name, fileSize: p.file.size };
    });
    assertEqual(picked.driveSourceInbox, false, 'Arquivo fora da pasta do lattesZen: driveSourceInbox deveria ser false (copiar, não mover)');
    assertEqual(picked.fileName, 'evidencia-externa.pdf', 'O File reconstruído deveria manter o nome original do Drive');
    assert(picked.fileSize > 0, 'O File reconstruído deveria ter o conteúdo baixado (tamanho > 0)');
    assert(mock.files.has('ext1'), 'O arquivo original NÃO deveria ter sido tocado só por selecioná-lo/baixá-lo');
});

test('pickDriveEvidenceFile: arquivo DENTRO da pasta do app mas FORA da Caixa de Entrada também fica marcado pra copiar (original intocado)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const rootFolderId = await page.evaluate(() => window.Storage.loadSettings().gdrive.rootFolderId);
    // Subpasta dentro da árvore do lattesZen (ex.: já filed em "Produções"),
    // mas não é a Caixa de Entrada — pela regra atual, isso NÃO deve apagar
    // o original (só a Caixa de Entrada é "mover"; qualquer outro lugar
    // dentro da árvore do app é só "copiar", como um arquivo de fora).
    mock.files.set('sub1', { id: 'sub1', name: 'Produções', parentId: rootFolderId, isDir: true, content: null });
    mock.files.set('int1', { id: 'int1', name: 'evidencia-interna.pdf', parentId: 'sub1', isDir: false, content: 'conteudo-interno', mimeType: 'application/pdf' });
    await page.evaluate(() => {
        window.GDriveClient.pickFile = async () => ({ id: 'int1', name: 'evidencia-interna.pdf', mimeType: 'application/pdf' });
    });

    const picked = await page.evaluate(async () => {
        const p = await window.Storage.pickDriveEvidenceFile();
        return { driveSourceInbox: p.driveSourceInbox };
    });
    assertEqual(picked.driveSourceInbox, false, 'Arquivo dentro da pasta do app mas fora da Caixa de Entrada: driveSourceInbox deveria ser false (copiar, não mover)');
    assert(mock.files.has('int1'), 'O arquivo original (já filed noutra pasta do app) NÃO deveria ser apagado');
});

test('pickDriveEvidenceFile: arquivo DENTRO da Caixa de Entrada fica marcado como "da bandeja" (move pra Processados ao salvar)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen'); // já cria "Caixa de Entrada" na raiz

    const rootFolderId = await page.evaluate(() => window.Storage.loadSettings().gdrive.rootFolderId);
    let inboxId = null;
    for (const f of mock.files.values()) { if (f.isDir && f.name === 'Caixa de Entrada' && f.parentId === rootFolderId) inboxId = f.id; }
    assert(inboxId, 'Setup do teste: a Caixa de Entrada deveria já existir depois de conectar');
    mock.files.set('in1', { id: 'in1', name: 'pendente.pdf', parentId: inboxId, isDir: false, content: 'conteudo-pendente', mimeType: 'application/pdf' });
    await page.evaluate(() => {
        window.GDriveClient.pickFile = async () => ({ id: 'in1', name: 'pendente.pdf', mimeType: 'application/pdf' });
    });

    const picked = await page.evaluate(async () => {
        const p = await window.Storage.pickDriveEvidenceFile();
        return { driveSourceInbox: p.driveSourceInbox, fileName: p.file.name };
    });
    assertEqual(picked.driveSourceInbox, true, 'Arquivo diretamente na Caixa de Entrada: driveSourceInbox deveria ser true (mover, não só copiar)');

    // Completa o efeito de "mover" — o mesmo mecanismo usado pela bandeja
    // clássica (useInboxFile/fromInbox), acionado em onSubmitForm() por
    // causa do inboxName marcado em addDriveEvidence().
    await page.evaluate((name) => window.Storage.moveInboxToProcessed(name), picked.fileName);
    let procId = null;
    for (const f of mock.files.values()) { if (f.isDir && f.name === 'Processados' && f.parentId === inboxId) procId = f.id; }
    assert(procId, 'A subpasta "Processados" deveria existir dentro da Caixa de Entrada');
    const emProcessados = Array.from(mock.files.values()).some((f) => f.id === 'in1' && f.parentId === procId);
    assert(emProcessados, 'O arquivo original deveria ter sido movido da Caixa de Entrada pra Processados');
});

test('pickDriveEvidenceFile: cancelar o seletor retorna null, sem baixar nada', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(() => { window.GDriveClient.pickFile = async () => null; });
    const resultado = await page.evaluate(() => window.Storage.pickDriveEvidenceFile());
    assertEqual(resultado, null, 'Cancelar o Picker deveria retornar null, sem lançar erro nem tentar baixar nada');
});

test('deleteItemFiles remove os arquivos do item no Google Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-del1', { id: 'it-del1' }, 'Produções');
        await window.Storage.writeAttachment('it-del1', 'conteudo-fake', 'Produções', 'pdf');
    });
    assert(Array.from(mock.files.values()).some((f) => f.name === 'it-del1.json'), 'Pré-condição: JSON deveria existir antes de excluir');
    assert(Array.from(mock.files.values()).some((f) => f.name === 'it-del1.pdf'), 'Pré-condição: PDF deveria existir antes de excluir');

    await page.evaluate(() => window.Storage.deleteItemFiles('it-del1', 'Produções'));
    assert(!Array.from(mock.files.values()).some((f) => f.name === 'it-del1.json'), 'O JSON do item deveria ter sido removido do Drive');
    assert(!Array.from(mock.files.values()).some((f) => f.name === 'it-del1.pdf'), 'O PDF do item deveria ter sido removido do Drive');
});

test('moveInboxToProcessed usa MOVE (addParents/removeParents) e resolve colisão de nome', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const inboxId = await page.evaluate(async () => {
        await window.Storage.ensureInbox();
        return null;
    });
    const inbox = Array.from(mock.files.values()).find((f) => f.name === 'Caixa de Entrada' && f.isDir);
    const processados = Array.from(mock.files.values()).find((f) => f.name === 'Processados' && f.isDir);
    assert(inbox && processados, 'Pré-condição: Caixa de Entrada e Processados deveriam existir após ensureInbox()');

    const origId = 'orig1';
    mock.files.set(origId, { id: origId, name: 'documento.pdf', parentId: inbox.id, isDir: false, content: 'conteudo-a', mimeType: 'application/pdf' });
    mock.files.set('colisao1', { id: 'colisao1', name: 'documento.pdf', parentId: processados.id, isDir: false, content: 'ja-existente', mimeType: 'application/pdf' }); // força colisão

    const alvo = await page.evaluate(() => window.Storage.moveInboxToProcessed('documento.pdf'));
    assertEqual(alvo, 'documento-2.pdf', 'Deveria sufixar o nome ao colidir com um arquivo já processado');
    const movido = mock.files.get(origId);
    assertEqual(movido.parentId, processados.id, 'O arquivo deveria ter sido movido para dentro de Processados (addParents/removeParents)');
    assertEqual(movido.name, 'documento-2.pdf', 'O arquivo movido deveria ter sido renomeado com o sufixo');
    assertEqual(movido.content, 'conteudo-a', 'O conteúdo movido deveria ser o do arquivo original, não o que já existia em Processados');
});

test('Assistente: "Já tenho um diretório" > "Google Drive" > "Migrar meus arquivos e conectar" copia os arquivos, mantém a estrutura e ativa o Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await mockLocalDir(page, [
        { name: 'it-1.json', kind: 'file', content: '{"id":"it-1"}' },
        { name: 'Produções', kind: 'directory', children: [
            { name: 'it-2.json', kind: 'file', content: '{"id":"it-2"}' },
            { name: 'it-2.pdf', kind: 'file', content: 'PDF-CONTEUDO-FAKE', mimeType: 'application/pdf' },
        ] },
    ]);
    await abrirConfig(page, baseUrl);

    // Sem diretório configurado ainda: navega o assistente até "Já tenho um
    // diretório" > "Google Drive" — "Migrar meus arquivos e conectar" pede
    // pra escolher a pasta local (mock) antes de conectar e copiar tudo.
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(50);
    assertEqual(await page.locator('#btnGDriveMigrate').count(), 1, 'O botão "Migrar meus arquivos e conectar" deveria aparecer');

    await page.fill('#gdrivePasta', 'lattesZen');
    await page.click('#btnGDriveMigrate'); // o confirm() é aceito automaticamente pelo harness (page.on('dialog'))
    await page.waitForFunction(() => !document.querySelector('[data-wizard-modo]'), { timeout: 8000 }); // assistente some quando o diretório fica configurado
    await page.waitForTimeout(100);

    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'gdrive', 'Depois de migrar, o armazenamento em uso deveria passar a ser o Google Drive');

    const nomes = Array.from(mock.files.values()).map((f) => f.name);
    assert(nomes.includes('it-1.json'), 'O arquivo da raiz da pasta local deveria ter sido copiado para o Drive');
    assert(nomes.includes('it-2.json') && nomes.includes('it-2.pdf'), 'Os arquivos da subpasta "Produções" deveriam ter sido copiados para o Drive');

    const pastaProducoes = Array.from(mock.files.values()).find((f) => f.name === 'Produções' && f.isDir);
    assert(pastaProducoes, 'A subpasta "Produções" deveria ter sido criada no Drive, preservando a estrutura da pasta local');
    const it2json = Array.from(mock.files.values()).find((f) => f.name === 'it-2.json');
    assertEqual(it2json.parentId, pastaProducoes.id, 'it-2.json deveria estar dentro da subpasta "Produções" no Drive');
    const it2pdf = Array.from(mock.files.values()).find((f) => f.name === 'it-2.pdf');
    assertEqual(it2pdf.content.trim(), 'PDF-CONTEUDO-FAKE', 'O conteúdo do PDF copiado deveria ser preservado');

    const aviso = await page.locator('#gdriveMigrationNotice').textContent();
    assert(/todas as atualizações.*ocorrem no google drive/i.test(aviso), 'Deveria mostrar um aviso persistente explicando que as atualizações agora ocorrem no Drive');
    assert(/pasta local pode ser exclu[ií]da/i.test(aviso), 'O aviso deveria mencionar que a pasta local pode ser excluída com segurança');

    assertEqual(await page.locator('#btnGDriveConnect').count(), 0, 'Com o diretório já configurado, a seção "Armazenamento remoto" não deveria mais aparecer no painel de estado');
});
