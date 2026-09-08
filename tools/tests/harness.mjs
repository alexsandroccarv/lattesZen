/* ==========================================================================
   lattesZen — mini test harness (Playwright puro, sem framework externo)
   --------------------------------------------------------------------------
   Suíte de regressão para bugs já encontrados (e corrigidos) manualmente ao
   longo do desenvolvimento — sem isso, nenhum deles tinha proteção contra
   reaparecer numa mudança futura (o CI só verificava sintaxe JS).

   Cada teste roda numa aba isolada (contexto novo do navegador — localStorage
   próprio, sem vazar estado entre testes) contra um servidor estático local
   servindo src/. Diálogos nativos (confirm()) são aceitos automaticamente,
   igual ao app espera em uso normal. Qualquer erro de JS não tratado durante
   o teste marca o teste como falho, mesmo que as asserções passem.

   Uso:  node tools/tests/run.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('../../src/', import.meta.url));
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png',
};

function startServer() {
    return new Promise((resolve, reject) => {
        const server = createServer(async (req, res) => {
            try {
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                const full = normalize(join(SRC_ROOT, p));
                if (!full.startsWith(SRC_ROOT)) throw new Error('fora da raiz');
                const data = await readFile(full);
                res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
                res.end(data);
            } catch (_) { res.writeHead(404); res.end('not found'); }
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

const TESTS = [];
// Registra um teste. `fn` recebe { page, baseUrl } — o contexto do navegador
// (e seu localStorage) é isolado e descartado ao final de cada teste.
export function test(name, fn) { TESTS.push({ name, fn }); }

// Timeout por teste — sem isto, um teste que trave de verdade (ex.: um
// page.evaluate esperando uma Promise que nunca resolve, como uma chamada de
// rede real pra um domínio inacessível no CI; page.evaluate() NÃO tem o
// timeout padrão do Playwright que ações como click/goto têm) prende a
// suíte inteira indefinidamente, sem nenhum log de erro — foi exatamente o
// que aconteceu num run do CI (>1h travado, sem diagnóstico). 150s dá folga
// pros testes mais lentos legítimos da suíte (RSC com muitos campos chega a
// ~45s) e pra um teste com 2-3 navegações sofrendo o timeout de 60s de
// page.goto numa janela de lentidão do runner (ver setDefaultNavigationTimeout
// acima), sem soar falso positivo.
const TEST_TIMEOUT_MS = 150000;
function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Teste excedeu ${ms / 1000}s sem terminar — provável hang (ex.: page.evaluate esperando uma chamada de rede que nunca resolve).`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert falhou'); }
export function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}esperado ${e}, obtido ${a}`);
}

// Semeia state.items (via lz_catalog) antes da primeira renderização —
// padrão usado em todos os specs. `items` já vem como array de itens prontos
// (ver makeItem em cada spec).
export async function seedCatalog(page, baseUrl, items) {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((its) => localStorage.setItem('lz_catalog', JSON.stringify(its)), items);
    await page.reload();
    await page.waitForTimeout(500);
}

export function makeItem(typeKey, categoryKey, fields, extra) {
    const now = new Date().toISOString();
    return Object.assign({
        id: 'it-' + Math.random().toString(36).slice(2), createdAt: now, updatedAt: now, source: 'local',
        lattesItem: false, typeKey, categoryKey, fields, evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
    }, extra || {});
}

export async function runAll() {
    const server = await startServer();
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    // Em sandboxes com um Chromium pré-instalado num caminho fixo, usa-o; caso
    // contrário (CI, máquina local comum) deixa o Playwright resolver sozinho
    // o navegador que ele mesmo instalou (via "playwright install").
    const sandboxPath = '/opt/pw-browsers/chromium';
    const execPath = process.env.PW_CHROMIUM_PATH || (existsSync(sandboxPath) ? sandboxPath : undefined);
    const browser = await chromium.launch(execPath ? { executablePath: execPath } : {}).catch(async (e) => {
        console.error(`Falha ao abrir o Chromium${execPath ? ` em "${execPath}"` : ''} (defina PW_CHROMIUM_PATH se necessário): ${e.message}`);
        throw e;
    });

    let passed = 0, failed = 0;
    const falhas = [];
    for (const { name, fn } of TESTS) {
        const context = await browser.newContext();
        // Marca o aviso de 1ª execução como já visto: com o Tailwind CDN
        // bloqueado (sandbox), o modal fica sem CSS e não intercepta cliques,
        // mas com o CDN acessível (CI/produção) ele vira um overlay real que
        // bloqueia toda a página até o usuário clicar "OK" — sem isto, os
        // testes travam esperando cliques em elementos cobertos pelo modal.
        await context.addInitScript(() => {
            try {
                const raw = localStorage.getItem('lz_settings');
                const s = raw ? JSON.parse(raw) : {};
                s.avisoDevVisto = true;
                localStorage.setItem('lz_settings', JSON.stringify(s));
            } catch (_) {}
        });
        const page = await context.newPage();
        // O timeout padrão do Playwright (30s) pra ações/navegação já causou
        // falhas em cadeia no CI: o runner às vezes fica momentaneamente
        // lento por alguns minutos (contenção de CPU do runner hospedado,
        // fora do nosso controle) e vários "page.goto" seguidos estouram
        // 30s sem o servidor local ter de fato caído — só ficou lento.
        // 60s dá folga pra sobreviver a essas janelas sem virar falso
        // negativo; hangs de verdade continuam limitados pelo timeout por
        // teste (TEST_TIMEOUT_MS) logo abaixo.
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);
        const pageErrors = [];
        page.on('pageerror', (e) => pageErrors.push(e.message));
        page.on('dialog', (d) => d.accept());
        try {
            await withTimeout(fn({ page, baseUrl }), TEST_TIMEOUT_MS);
            if (pageErrors.length) throw new Error('Erro(s) de JS na página: ' + pageErrors.join(' | '));
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (e) {
            console.log(`  ❌ ${name}`);
            console.log(`     ${e.message}`);
            failed++;
            falhas.push(name);
        } finally {
            await context.close();
        }
    }
    await browser.close();
    await new Promise((r) => server.close(r));

    console.log('');
    console.log(`${passed}/${TESTS.length} teste(s) passaram.`);
    if (failed) console.log(`Falharam: ${falhas.join(', ')}`);
    process.exitCode = failed ? 1 : 0;
}
