/* ==========================================================================
   Regressão: botão de Configurações movido para a 1ª linha do cabeçalho,
   extrema direita — mesma posição do templateZen. Deixou de ser uma aba na
   régua de navegação (nav[role=tablist] em index.html, ou o link de texto
   "Configurações" nas páginas estáticas) e virou um ícone isolado ao lado do
   selo gov.br, em TODAS as páginas HTML da aplicação.

   Em index.html continua sendo o mesmo <button data-tab="config"> de sempre
   (só mudou de lugar/aparência) — clicar nele ainda troca de aba
   normalmente. Nas páginas estáticas (sem o app montado) virou um link real
   para "index.html#config", que agora abre direto na aba Configurações (ver
   o tratamento do hash em app.js — antes não existia, sempre caía em
   "Início").
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const PAGINAS_ESTATICAS = ['ajuda.html', 'ajuda-lattes.html', 'ajuda-rsc.html', 'doe-um-cafe.html', 'notas-de-versao.html', 'privacidade.html', 'termodeuso.html', 'relacionando-lattes-rsc.html', 'sobre.html'];

test('index.html: botão de Configurações fica na 1ª linha do cabeçalho (fora da régua de abas), não na régua de navegação', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const todos = Array.from(document.querySelectorAll('[data-tab="config"]'));
        const btn = document.querySelector('#headerConfigBtn');
        const topRow = document.querySelector('header > div:first-child');
        return {
            quantidade: todos.length,
            existeNoTopo: !!(btn && topRow && topRow.contains(btn)),
            existeNaRegua: !!document.querySelector('nav[role="tablist"] [data-tab="config"]'),
            temIcone: !!(btn && btn.querySelector('i.fa-gear')),
        };
    });
    assertEqual(info.quantidade, 1, 'Deveria haver só um elemento [data-tab="config"] na página (o botão do cabeçalho)');
    assert(info.existeNoTopo, 'O botão de Configurações deveria estar na 1ª linha do cabeçalho (junto do selo gov.br)');
    assert(!info.existeNaRegua, 'O botão de Configurações não deveria mais estar na régua de abas (nav[role="tablist"])');
    assert(info.temIcone, 'O botão de Configurações deveria manter o ícone de engrenagem (fa-gear)');
});

test('index.html: clicar no botão de Configurações do cabeçalho abre a aba normalmente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    await page.click('#headerConfigBtn');
    await page.waitForTimeout(200);

    const info = await page.evaluate(() => ({
        painelVisivel: !document.querySelector('#tab-config').hidden,
        selecionado: document.querySelector('#headerConfigBtn').getAttribute('aria-selected'),
    }));
    assert(info.painelVisivel, 'Clicar no botão do cabeçalho deveria abrir o painel de Configurações');
    assertEqual(info.selecionado, 'true', 'O botão deveria ficar marcado como selecionado (aria-selected)');
});

test('index.html#config: abrir direto no hash já cai na aba Configurações (sem precisar clicar)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html#config');
    await page.waitForTimeout(400);

    const info = await page.evaluate(() => ({
        painelVisivel: !document.querySelector('#tab-config').hidden,
        selecionado: document.querySelector('[data-tab="config"]').getAttribute('aria-selected'),
    }));
    assert(info.painelVisivel, 'Abrir index.html#config deveria já cair direto na aba Configurações');
    assertEqual(info.selecionado, 'true', 'O botão de Configurações deveria estar marcado como selecionado');
});

for (const pagina of PAGINAS_ESTATICAS) {
    test(`${pagina}: botão de Configurações vira ícone na 1ª linha do cabeçalho, some da régua de navegação`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);

        const info = await page.evaluate(() => {
            const topRow = document.querySelector('header > div:first-child');
            const link = topRow ? topRow.querySelector('a[href="index.html#config"]') : null;
            const naRegua = Array.from(document.querySelectorAll('nav a')).find((a) => a.textContent.trim() === 'Configurações');
            return {
                existeNoTopo: !!link,
                title: link ? link.getAttribute('title') : null,
                ariaLabel: link ? link.getAttribute('aria-label') : null,
                temIcone: !!(link && link.querySelector('i.fa-gear')),
                textoVisivel: link ? link.textContent.trim() : null,
                aindaNaRegua: !!naRegua,
            };
        });
        assert(info.existeNoTopo, `${pagina}: deveria haver um link para "index.html#config" na 1ª linha do cabeçalho`);
        assertEqual(info.title, 'Configurações', `${pagina}: o link deveria ter title="Configurações"`);
        assertEqual(info.ariaLabel, 'Configurações', `${pagina}: o link deveria ter aria-label="Configurações"`);
        assert(info.temIcone, `${pagina}: o link deveria ter o ícone de engrenagem (fa-gear)`);
        assertEqual(info.textoVisivel, '', `${pagina}: o link não deveria ter texto visível (só ícone)`);
        assert(!info.aindaNaRegua, `${pagina}: "Configurações" não deveria mais aparecer como link de texto na régua de navegação`);
    });
}
