/* ==========================================================================
   Regressão: publicação direta (GitHub Pages / Netlify) em Publicar na Web
   --------------------------------------------------------------------------
   Sem OAuth "de verdade" possível aqui (GitHub/Netlify exigem client_secret
   na troca do "code" por token, que não dá pra guardar com segurança num
   app estático) — o usuário cola um token de acesso pessoal, e o app publica
   direto via REST (deploy-github.js / deploy-netlify.js). GitHub e Netlify
   reais não são alcançáveis no CI, então api.github.com/api.netlify.com são
   simulados (mínimo necessário: blobs/trees/commits/refs/pages pro GitHub;
   deploy por digest SHA-1 pro Netlify) — o que É testável (e o que importa)
   é se o cliente monta as chamadas certas e trata as respostas certas.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

// Servidor GitHub mínimo, em memória: um repo com blobs/trees/commits/refs
// (Git Data API) e um estado de Pages.
function createMockGithub() {
    const repos = new Map(); // "owner/repo" -> { refs: Map(branch->sha), commits: Map, trees: Map, blobs: Map, pages: null }
    let nextId = 1;
    const sha = () => 'sha' + (nextId++);

    function repoOf(owner, repo, create) {
        const key = `${owner}/${repo}`;
        if (!repos.has(key) && create) repos.set(key, { refs: new Map(), commits: new Map(), trees: new Map(), blobs: new Map(), pages: null, exists: true });
        return repos.get(key);
    }

    async function handle(route) {
        const req = route.request();
        const method = req.method();
        const url = new URL(req.url());
        const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
        if (!m) { await route.fulfill({ status: 404, body: '' }); return; }
        const [, owner, repo, rest] = m;
        const r = repoOf(owner, repo, true);
        const body = () => { try { return JSON.parse(req.postData() || '{}'); } catch (_) { return {}; } };

        if (!rest || rest === '') {
            await route.fulfill({ status: r.exists ? 200 : 404, contentType: 'application/json', body: JSON.stringify({ name: repo }) });
            return;
        }
        let mm;
        if ((mm = rest.match(/^\/git\/ref\/heads\/(.+)$/)) && method === 'GET') {
            const branch = decodeURIComponent(mm[1]);
            const s = r.refs.get(branch);
            if (!s) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: { sha: s } }) });
            return;
        }
        if ((mm = rest.match(/^\/git\/commits\/(.+)$/)) && method === 'GET') {
            const c = r.commits.get(mm[1]);
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tree: { sha: c.tree } }) });
            return;
        }
        if (rest === '/git/blobs' && method === 'POST') {
            const b = body(); const id = sha();
            r.blobs.set(id, b);
            await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ sha: id }) });
            return;
        }
        if (rest === '/git/trees' && method === 'POST') {
            const b = body(); const id = sha();
            r.trees.set(id, b);
            await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ sha: id }) });
            return;
        }
        if (rest === '/git/commits' && method === 'POST') {
            const b = body(); const id = sha();
            r.commits.set(id, { tree: b.tree, parents: b.parents || [], message: b.message });
            await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ sha: id }) });
            return;
        }
        if ((mm = rest.match(/^\/git\/refs\/heads\/(.+)$/)) && method === 'PATCH') {
            const b = body();
            r.refs.set(decodeURIComponent(mm[1]), b.sha);
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            return;
        }
        if (rest === '/git/refs' && method === 'POST') {
            const b = body();
            const branch = String(b.ref || '').replace('refs/heads/', '');
            r.refs.set(branch, b.sha);
            await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
            return;
        }
        if (rest === '/pages' && method === 'GET') {
            if (!r.pages) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.pages) });
            return;
        }
        if (rest === '/pages' && method === 'POST') {
            const b = body();
            r.pages = { html_url: `https://${owner}.github.io/${repo}/`, source: b.source };
            await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(r.pages) });
            return;
        }
        await route.fulfill({ status: 501, body: '' });
    }

    return {
        repos,
        markRepoMissing(owner, repo) { const r = repoOf(owner, repo, true); r.exists = false; },
        async install(page) { await page.route('https://api.github.com/**', handle); },
    };
}

// Servidor Netlify mínimo, em memória: sites + deploys (digest: sha1 -> conteúdo).
function createMockNetlify() {
    const sites = new Map();
    const deploys = new Map();
    const known = new Set(); // hashes já "recebidos" (simula cache do Netlify entre deploys)
    let nextId = 1;

    async function handle(route) {
        const req = route.request();
        const method = req.method();
        const url = new URL(req.url());
        const body = () => { try { return JSON.parse(req.postData() || '{}'); } catch (_) { return {}; } };

        if (url.pathname === '/api/v1/sites' && method === 'POST') {
            const b = body();
            const id = 'site' + (nextId++);
            const site = { id, name: b.name || id, url: `http://${id}.netlify.app`, ssl_url: `https://${id}.netlify.app` };
            sites.set(id, site);
            await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(site) });
            return;
        }
        let mm;
        if ((mm = url.pathname.match(/^\/api\/v1\/sites\/([^/]+)$/)) && method === 'GET') {
            const site = sites.get(mm[1]);
            if (!site) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(site) });
            return;
        }
        if ((mm = url.pathname.match(/^\/api\/v1\/sites\/([^/]+)\/deploys$/)) && method === 'POST') {
            const b = body();
            const files = b.files || {};
            const required = Object.values(files).filter((h) => !known.has(h));
            const id = 'deploy' + (nextId++);
            deploys.set(id, { id, state: 'ready', ssl_url: `https://${mm[1]}.netlify.app`, deploy_ssl_url: `https://${id}--${mm[1]}.netlify.app`, files });
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id, required }) });
            return;
        }
        if ((mm = url.pathname.match(/^\/api\/v1\/deploys\/([^/]+)\/files\/(.+)$/)) && method === 'PUT') {
            const d = deploys.get(mm[1]);
            const path = '/' + decodeURIComponent(mm[2]);
            putLog.push(path);
            if (d && d.files[path]) known.add(d.files[path]);
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            return;
        }
        if ((mm = url.pathname.match(/^\/api\/v1\/deploys\/([^/]+)$/)) && method === 'GET') {
            const d = deploys.get(mm[1]);
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d || {}) });
            return;
        }
        await route.fulfill({ status: 501, body: '' });
    }

    const putLog = []; // caminhos efetivamente reenviados (PUT) — cresce a cada chamada, o teste zera lendo .length
    return {
        putLog,
        async install(page) { await page.route('https://api.netlify.com/**', handle); },
    };
}

test('DeployGithub.publish: repositório vazio (sem branch ainda) cria o 1º commit e o ref via POST', async ({ page, baseUrl }) => {
    const mock = createMockGithub();
    await mock.install(page);
    await page.goto(baseUrl + '/index.html');

    const result = await page.evaluate(async () => {
        return window.DeployGithub.publish({
            token: 'tok', owner: 'fulana', repo: 'fulana.github.io', branch: 'gh-pages',
            files: [{ path: 'index.html', content: '<h1>Olá</h1>' }, { path: 'css/estilo.css', content: 'body{}' }],
        });
    });
    assert(result.commitSha, 'Deveria devolver o sha do commit criado');
    assert(result.commitUrl.includes(result.commitSha), 'A URL do commit deveria conter o sha');
    assert(result.pagesUrl, 'Deveria ter configurado o GitHub Pages automaticamente (best-effort) e devolvido a URL');

    const r = mock.repos.get('fulana/fulana.github.io');
    assertEqual(r.refs.get('gh-pages'), result.commitSha, 'O branch gh-pages deveria apontar pro commit novo');
    const commit = r.commits.get(result.commitSha);
    assertEqual(commit.parents, [], 'Primeiro commit (repo vazio) não deveria ter parent');
    const tree = r.trees.get(commit.tree);
    const paths = tree.tree.map((t) => t.path).sort();
    assertEqual(paths, ['css/estilo.css', 'index.html'], 'A árvore do commit deveria conter os 2 arquivos publicados');
});

test('DeployGithub.publish: branch já existente atualiza o ref (PATCH) preservando o histórico (parent)', async ({ page, baseUrl }) => {
    const mock = createMockGithub();
    await mock.install(page);
    await page.goto(baseUrl + '/index.html');

    // Publica 2x — a 2ª vez deveria enxergar o commit da 1ª como base/parent.
    const primeiro = await page.evaluate(async () => window.DeployGithub.publish({
        token: 'tok', owner: 'fulana', repo: 'site', branch: 'gh-pages',
        files: [{ path: 'index.html', content: 'v1' }],
    }));
    const segundo = await page.evaluate(async () => window.DeployGithub.publish({
        token: 'tok', owner: 'fulana', repo: 'site', branch: 'gh-pages',
        files: [{ path: 'index.html', content: 'v2' }],
    }));

    const r = mock.repos.get('fulana/site');
    assertEqual(r.refs.get('gh-pages'), segundo.commitSha, 'O branch deveria apontar pro 2º commit depois da 2ª publicação');
    const commit2 = r.commits.get(segundo.commitSha);
    assertEqual(commit2.parents, [primeiro.commitSha], 'O 2º commit deveria ter o 1º como parent (histórico preservado)');
});

test('DeployGithub.publish: repositório inexistente (ou sem acesso) falha com mensagem clara', async ({ page, baseUrl }) => {
    const mock = createMockGithub();
    mock.markRepoMissing('fulana', 'nao-existe');
    await mock.install(page);
    await page.goto(baseUrl + '/index.html');

    const erro = await page.evaluate(async () => {
        try { await window.DeployGithub.checkRepo('tok', 'fulana', 'nao-existe'); return null; }
        catch (e) { return e.message; }
    });
    assert(erro && /não encontrado/.test(erro), `Deveria informar que o repositório não foi encontrado — obtido: ${erro}`);
});

test('DeployGithub.publish: sem token ou sem repositório, falha antes de chamar a rede', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    const semToken = await page.evaluate(async () => {
        try { await window.DeployGithub.publish({ token: '', owner: 'a', repo: 'b', files: [{ path: 'index.html', content: 'x' }] }); return null; }
        catch (e) { return e.message; }
    });
    assert(semToken && /token/i.test(semToken), 'Deveria pedir o token');
    const semRepo = await page.evaluate(async () => {
        try { await window.DeployGithub.publish({ token: 't', owner: '', repo: '', files: [{ path: 'index.html', content: 'x' }] }); return null; }
        catch (e) { return e.message; }
    });
    assert(semRepo && /reposit/i.test(semRepo), 'Deveria pedir o repositório');
});

test('DeployNetlify.publish: envia (PUT) só os arquivos ainda não conhecidos pelo Netlify (dedup por hash SHA-1)', async ({ page, baseUrl }) => {
    const mock = createMockNetlify();
    await mock.install(page);
    await page.goto(baseUrl + '/index.html');

    const site = await page.evaluate(async () => window.DeployNetlify.createSite('tok', 'meu-curriculo'));
    assert(site.id, 'Deveria criar o site e devolver o id');

    const r1 = await page.evaluate(async (siteId) => window.DeployNetlify.publish({
        token: 'tok', siteId, files: [{ path: '/index.html', content: 'v1' }, { path: '/css/estilo.css', content: 'body{}' }],
    }), site.id);
    assertEqual(mock.putLog.length, 2, '1º deploy: os 2 arquivos são novos, deveria enviar (PUT) os 2');
    assert(r1.siteUrl, 'Deveria devolver a URL do site');

    mock.putLog.length = 0;
    const r2 = await page.evaluate(async (siteId) => window.DeployNetlify.publish({
        token: 'tok', siteId, files: [{ path: '/index.html', content: 'v1' }, { path: '/css/estilo.css', content: 'body{}' }],
    }), site.id);
    assertEqual(mock.putLog.length, 0, '2º deploy com o MESMO conteúdo: nenhum hash é novo, não deveria reenviar nada');
    assert(r2.deployId !== r1.deployId, 'Cada publicação deveria gerar um deploy novo, mesmo sem reenviar arquivos');

    mock.putLog.length = 0;
    await page.evaluate(async (siteId) => window.DeployNetlify.publish({
        token: 'tok', siteId, files: [{ path: '/index.html', content: 'v2 — mudou' }, { path: '/css/estilo.css', content: 'body{}' }],
    }), site.id);
    assertEqual(mock.putLog.length, 1, '3º deploy com 1 arquivo alterado: só esse (hash novo) deveria ser reenviado');
});

test('Publicar na Web: token do GitHub/Netlify fica numa chave própria, fora do backup de Configurações', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' })]);
    await page.evaluate(() => {
        window.Storage.saveDeployToken('github', 'segredo-github-123');
        window.Storage.saveDeployToken('netlify', 'segredo-netlify-456');
    });
    const { settingsJson, tokenGithub, tokenNetlify } = await page.evaluate(() => ({
        settingsJson: JSON.stringify(window.Storage.loadSettings()),
        tokenGithub: window.Storage.loadDeployToken('github'),
        tokenNetlify: window.Storage.loadDeployToken('netlify'),
    }));
    assertEqual(tokenGithub, 'segredo-github-123', 'loadDeployToken deveria devolver o token salvo');
    assertEqual(tokenNetlify, 'segredo-netlify-456', 'loadDeployToken deveria devolver o token salvo');
    assert(!settingsJson.includes('segredo-github-123'), 'O token do GitHub NÃO deveria aparecer em loadSettings() (vazaria no backup exportável)');
    assert(!settingsJson.includes('segredo-netlify-456'), 'O token do Netlify NÃO deveria aparecer em loadSettings() (vazaria no backup exportável)');
});

test('Aba Publicar: preenche GitHub e Netlify, publica nos dois e mostra a URL resultante', async ({ page, baseUrl }) => {
    const mockGh = createMockGithub();
    const mockNl = createMockNetlify();
    await mockGh.install(page);
    await mockNl.install(page);
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' })]);

    const site = await page.evaluate(async () => window.DeployNetlify.createSite('tok', 'meu-curriculo'));

    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('text=Publicar direto num site');
    await page.waitForTimeout(100);

    await page.fill('#ghToken', 'tok-gh');
    await page.fill('#ghOwner', 'fulana');
    await page.fill('#ghRepo', 'fulana.github.io');
    await page.fill('#ghBranch', 'gh-pages');
    await page.click('#btnGhDeploy');
    await page.waitForFunction(() => (document.querySelector('#ghDeployStatus') || {}).textContent?.includes('Publicado'), { timeout: 10000 });
    const ghStatus = await page.$eval('#ghDeployStatus', (el) => el.textContent);
    assert(ghStatus.includes('github.io'), `Status do GitHub deveria trazer a URL do Pages — obtido: ${ghStatus}`);

    await page.fill('#netlifyToken', 'tok-nl');
    await page.fill('#netlifySiteId', site.id);
    await page.click('#btnNetlifyDeploy');
    await page.waitForFunction(() => (document.querySelector('#netlifyDeployStatus') || {}).textContent?.includes('Publicado'), { timeout: 10000 });
    const nlStatus = await page.$eval('#netlifyDeployStatus', (el) => el.textContent);
    assert(nlStatus.includes('netlify.app'), `Status do Netlify deveria trazer a URL do site — obtido: ${nlStatus}`);

    // Recarregar a aba deveria repopular os campos com o que foi salvo (sem
    // precisar colar o token de novo).
    await page.click('[data-tab="inicio"]');
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('text=Publicar direto num site');
    await page.waitForTimeout(100);
    const campos = await page.evaluate(() => ({
        owner: document.querySelector('#ghOwner').value, repo: document.querySelector('#ghRepo').value,
        siteId: document.querySelector('#netlifySiteId').value,
    }));
    assertEqual(campos.owner, 'fulana', 'O dono do repositório deveria continuar preenchido depois de trocar de aba');
    assertEqual(campos.repo, 'fulana.github.io', 'O repositório deveria continuar preenchido depois de trocar de aba');
    assertEqual(campos.siteId, site.id, 'O ID do site do Netlify deveria continuar preenchido depois de trocar de aba');
});
