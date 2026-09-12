/* ==========================================================================
   Regressão: reorganização dos grupos de Configurações
   --------------------------------------------------------------------------
   - "Listas de autocomplete" e "Tema" saíram do grupo "Avançado" (removido,
     ficaria vazio) e passaram a morar dentro de "Recursos opcionais".
   - "Lixeira" deixou de ser um grupo próprio e passou para dentro de "Zona
     de risco", lado a lado com "Limpar catálogo" (mesma linha da grade).
   - A seção inteira "Sobre e suporte" foi excluída da página.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function abrirConfig(page, baseUrl) {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('"Avançado" e "Sobre e suporte" não existem mais como grupos de Configurações', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const grupos = await page.$$eval('[data-cfg-index]', (els) => els.map((el) => el.textContent.trim()));
    assert(!grupos.some((g) => /avançado/i.test(g)), 'O grupo "Avançado" não deveria mais existir no índice');
    assert(!grupos.some((g) => /sobre e suporte/i.test(g)), 'O grupo "Sobre e suporte" não deveria mais existir no índice');
    assert(grupos.some((g) => /recursos opcionais/i.test(g)), 'O grupo "Recursos opcionais" deveria continuar existindo');
    assert(grupos.some((g) => /zona de risco/i.test(g)), 'O grupo "Zona de risco" deveria continuar existindo');

    const texto = await page.$eval('#tab-config', (el) => el.textContent);
    assert(!texto.includes('Sobre o lattesZen'), 'A seção "Sobre o lattesZen" não deveria mais aparecer em Configurações');
});

test('"Listas de autocomplete" e "Tema" aparecem dentro do grupo "Recursos opcionais"', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const ordem = await page.evaluate(() => {
        const panel = document.querySelector('#tab-config');
        const html = panel.innerHTML;
        const idxOpcionais = html.indexOf('id="grp-opcionais"');
        const idxRisco = html.indexOf('id="grp-risco"');
        const idxAutocomplete = html.indexOf('Listas de autocomplete');
        const idxTema = html.indexOf('id="temaSection"');
        return { idxOpcionais, idxRisco, idxAutocomplete, idxTema };
    });
    assert(ordem.idxAutocomplete > ordem.idxOpcionais && ordem.idxAutocomplete < ordem.idxRisco,
        '"Listas de autocomplete" deveria estar entre o início de "Recursos opcionais" e "Zona de risco"');
    assert(ordem.idxTema > ordem.idxOpcionais && ordem.idxTema < ordem.idxRisco,
        'A seção de Tema deveria estar entre o início de "Recursos opcionais" e "Zona de risco"');
});

test('"Lixeira" e "Limpar catálogo" ficam lado a lado dentro de "Zona de risco" (sem col-span-2 na Lixeira)', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const grupoRisco = page.locator('#grp-risco');
    assertEqual(await grupoRisco.count(), 1, 'O cabeçalho de "Zona de risco" deveria existir');

    const ordem = await page.evaluate(() => {
        const panel = document.querySelector('#tab-config');
        const html = panel.innerHTML;
        const idxRisco = html.indexOf('id="grp-risco"');
        const idxLixeira = html.indexOf('Lixeira');
        const idxLimpar = html.indexOf('id="btnClear"');
        return { idxRisco, idxLixeira, idxLimpar };
    });
    assert(ordem.idxLixeira > ordem.idxRisco, 'A seção "Lixeira" deveria vir depois do cabeçalho "Zona de risco"');
    assert(ordem.idxLimpar > ordem.idxRisco, 'O botão "Limpar catálogo" deveria vir depois do cabeçalho "Zona de risco"');

    const btnClear = page.locator('#btnClear');
    assertEqual(await btnClear.count(), 1, 'O botão "Limpar catálogo" deveria continuar existindo');
    const semColSpan = await page.evaluate(() => {
        const h2 = Array.from(document.querySelectorAll('#tab-config h2')).find((el) => el.textContent.includes('Lixeira'));
        const section = h2 ? h2.closest('section') : null;
        return section ? !section.className.includes('lg:col-span-2') : null;
    });
    assert(semColSpan, 'A seção "Lixeira" não deveria mais ocupar as 2 colunas — precisa ficar ao lado de "Limpar catálogo"');
});
