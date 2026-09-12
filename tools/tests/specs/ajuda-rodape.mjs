/* ==========================================================================
   Regressão: rodapé consolidado das páginas estáticas/app, trazido do
   templateZen (issue de paridade de rodapé) — mesma ordem/links/ícones do
   templateZen, adaptados às páginas reais do lattesZen:

   - Termo de uso / Privacidade / Ajuda / Sobre (nova página): ícone apenas,
     com title/aria-label para acessibilidade (sem texto visível).
   - Alto contraste e escala de fonte (A-/A+): inalterados.
   - Alternador de tema claro/escuro SAIU do rodapé (o templateZen não tem
     esse controle — usa temas predefinidos em Configurações, e o lattesZen
     não tinha isso; o tema agora só reage à preferência do sistema
     operacional/valor já salvo, sem controle manual na UI).
   - Selo de DOI (Zenodo) SAIU do rodapé (não existe no templateZen) — o DOI
     continua citado na nova página Sobre.
   - Versão: era texto solto + data (`lastModDate`); agora é um LINK
     (ícone de tag + nº da versão) para notas-de-versao.html, igual ao
     templateZen — `lastModDate` não existe mais.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const PAGINAS = ['index.html', 'ajuda.html', 'doe-um-cafe.html', 'notas-de-versao.html', 'privacidade.html', 'termodeuso.html', 'sobre.html'];

async function footerInfo(page) {
    return page.evaluate(() => {
        const footer = document.querySelector('footer');
        const linkInfo = (sel) => {
            const a = footer.querySelector(sel);
            return a ? { href: a.getAttribute('href'), title: a.getAttribute('title'), ariaLabel: a.getAttribute('aria-label'), text: a.textContent.trim() } : null;
        };
        return {
            hasTheme: !!footer.querySelector('#themeToggle'),
            hasDOI: !!footer.querySelector('img[src*="zenodo"]') || !!footer.querySelector('a[href*="zenodo"]'),
            hasLastMod: !!footer.querySelector('#lastModDate'),
            termos: linkInfo('a[href="termodeuso.html"]'),
            privacidade: linkInfo('a[href="privacidade.html"]'),
            ajuda: linkInfo('a[href="./ajuda.html"], a[href="ajuda.html"]'),
            sobre: linkInfo('a[href="sobre.html"]'),
            versao: linkInfo('a[href="notas-de-versao.html"]'),
        };
    });
}

for (const pagina of PAGINAS) {
    test(`Rodapé de ${pagina}: sem alternador de tema, sem selo DOI, sem "lastModDate"`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);
        const info = await footerInfo(page);
        assert(!info.hasTheme, `${pagina}: rodapé não deveria mais ter #themeToggle`);
        assert(!info.hasDOI, `${pagina}: rodapé não deveria mais ter o selo de DOI (Zenodo)`);
        assert(!info.hasLastMod, `${pagina}: rodapé não deveria mais ter #lastModDate`);
    });

    test(`Rodapé de ${pagina}: Termo de uso/Privacidade/Ajuda/Sobre são ícones com title (sem texto visível)`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);
        const info = await footerInfo(page);
        for (const [nome, item, tituloEsperado] of [
            ['Termo de uso', info.termos, 'Termo de uso'],
            ['Privacidade', info.privacidade, 'Política de privacidade'],
            ['Ajuda', info.ajuda, 'Ajuda'],
            ['Sobre', info.sobre, 'Sobre'],
        ]) {
            assert(item, `${pagina}: link "${nome}" deveria existir no rodapé`);
            assertEqual(item.text, '', `${pagina}: link "${nome}" não deveria ter texto visível (só ícone)`);
            assertEqual(item.title, tituloEsperado, `${pagina}: link "${nome}" deveria ter title="${tituloEsperado}"`);
            assertEqual(item.ariaLabel, tituloEsperado, `${pagina}: link "${nome}" deveria ter aria-label="${tituloEsperado}"`);
        }
    });

    test(`Rodapé de ${pagina}: versão é um link para notas-de-versao.html`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);
        const info = await footerInfo(page);
        assert(info.versao, `${pagina}: deveria haver um link de versão apontando para notas-de-versao.html`);
        assertEqual(info.versao.title, 'Notas de versão', `${pagina}: link de versão deveria ter title="Notas de versão"`);
    });
}

test('Rodapé (index.html): ordem dos itens segue Termo/Privacidade/Ajuda/Sobre/AltoContraste/Fonte, depois Autor/Café/Licença/Versão', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('footer a[href]')).map((a) => a.getAttribute('href')));
    assertEqual(hrefs, [
        'termodeuso.html', 'privacidade.html', './ajuda.html', 'sobre.html',
        'https://github.com/alexsandroccarv', 'doe-um-cafe.html',
        'https://www.gnu.org/licenses/agpl-3.0.html', 'notas-de-versao.html',
    ], `Ordem dos links do rodapé não confere — obtido: ${hrefs.join(', ')}`);
});

test('Página sobre.html existe, com cabeçalho/rodapé padrão e menciona o DOI (Zenodo)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/sobre.html');
    await page.waitForTimeout(300);
    const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent || '');
    assert(/Sobre/.test(h1), `Título principal de sobre.html deveria mencionar "Sobre" — obtido "${h1}"`);
    const temDOI = await page.evaluate(() => !!document.querySelector('main a[href*="zenodo"]'));
    assert(temDOI, 'sobre.html deveria linkar o DOI do Zenodo (informação retirada do rodapé)');
    const temFooter = await page.evaluate(() => !!document.querySelector('footer #highContrastToggle'));
    assert(temFooter, 'sobre.html deveria ter o mesmo rodapé padrão do site');
});

test('Página ajuda.html (Início Rápido) linka para os dois guias específicos', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/ajuda.html');
    await page.waitForTimeout(300);

    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('main a')).map((a) => a.getAttribute('href')));
    assert(hrefs.includes('ajuda-lattes.html'), 'ajuda.html deveria linkar para ajuda-lattes.html');
    assert(hrefs.includes('ajuda-rsc.html'), 'ajuda.html deveria linkar para ajuda-rsc.html');

    const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent || '');
    assert(/Início Rápido/.test(h1), `Título principal deveria mencionar "Início Rápido" — obtido "${h1}"`);
});

test('Alto contraste e escala de fonte continuam funcionando no rodapé (index.html)', async ({ page, baseUrl }) => {
    // Sem decisão de cookies salva, o aviso (#lzCookieBanner) cobre o rodapé
    // e intercepta o clique — irrelevante pro que este teste cobre, então
    // pré-decide "recusado" antes da 1ª carga (mesmo padrão de analytics.mjs).
    await page.addInitScript(() => { try { localStorage.setItem('lz_cookie_consent', 'rejected'); } catch (e) {} });
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const visible = (el) => {
            let t = '';
            el.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) t += n.textContent; });
            return t.trim();
        };
        const hc = document.querySelector('#highContrastToggle');
        return {
            hcVisibleText: hc ? visible(hc) : null,
            hcHasIcon: !!(hc && hc.querySelector('i.fa-circle-half-stroke')),
        };
    });
    assert(info.hcVisibleText === '', `Botão de alto contraste não deveria ter texto visível fora do ícone — obtido "${info.hcVisibleText}"`);
    assert(info.hcHasIcon, 'Botão de alto contraste deveria manter o ícone');

    await page.click('#highContrastToggle');
    await page.waitForTimeout(150);
    const ativo = await page.evaluate(() => document.documentElement.classList.contains('high-contrast'));
    assert(ativo, 'Clicar no botão de alto contraste deveria ativar a classe high-contrast');

    await page.click('#fontInc');
    await page.waitForTimeout(150);
    const fontScale = await page.evaluate(() => localStorage.getItem('fontScale'));
    assertEqual(fontScale, '110', 'Clicar em "A+" deveria aumentar a escala de fonte pra 110%');
});
