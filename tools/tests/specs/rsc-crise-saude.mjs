/* ==========================================================================
   Regressão: categoria "Atuação em Crise de Saúde Pública" (issue #39) — o
   critério 6.19 do RSC ("Atuação institucional no enfrentamento de surto,
   epidemia ou pandemia", por mês, 1 ponto) não tinha nenhum tipo de item
   onde entrar. Cobre: a categoria só aparece com o módulo RSC habilitado, na
   posição numérica correta (21, logo após "20. Grupos de Pesquisa"), e um
   item desse tipo é contabilizado no RSC com o critério 6.19, calculando os
   pontos a partir do período informado (por mês).
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function habilitarRsc(page) {
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
}

test('Categoria "Atuação em Crise de Saúde Pública" só aparece no seletor com o módulo RSC habilitado, na posição numérica correta', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const semRsc = await page.$$eval('#selCategoria option', (opts) => opts.map((o) => o.value));
    assert(!semRsc.includes('RSC_CRISE_SAUDE'), 'Sem o módulo RSC habilitado, a categoria não deveria aparecer no seletor');

    await habilitarRsc(page);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const opcoes = await page.$$eval('#selCategoria option', (opts) => opts.map((o) => ({ value: o.value, texto: o.textContent })));
    const idx = opcoes.findIndex((o) => o.value === 'RSC_CRISE_SAUDE');
    assert(idx >= 0, 'Com o módulo RSC habilitado, a categoria deveria aparecer no seletor');
    assertEqual(opcoes[idx].texto, '21. Atuação em Crise de Saúde Pública', 'Rótulo da categoria');

    const numeros = opcoes.map((o) => o.texto.match(/^(\d+)\./)).filter(Boolean).map((m) => parseInt(m[1], 10));
    const ordenado = [...numeros].sort((a, b) => a - b);
    assertEqual(numeros, ordenado, `As categorias deveriam continuar em ordem numérica — obtido [${numeros.join(', ')}]`);
});

test('Item de "Atuação em crise de saúde pública" é contabilizado no RSC com o critério 6.19 (por mês)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarRsc(page);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);

    await page.selectOption('#selCategoria', 'RSC_CRISE_SAUDE');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'RSC_CRISE_SAUDE_ATUACAO');
    await page.waitForTimeout(150);

    await page.selectOption('[name="tipoSituacao"]', 'Pandemia');
    await page.fill('[name="ato"]', 'Decreto Municipal 123/2021');
    await page.fill('[name="anoInicio"]', '01/03/2021');
    await page.fill('[name="anoFim"]', '01/07/2021');
    await page.fill('[name="descricao"]', 'Atuação na linha de frente durante a pandemia.');

    await page.check('#rscConta');
    await page.waitForTimeout(150);
    await page.click('#rscCritFiltro');
    await page.fill('#rscCritFiltro', 'surto, epidemia ou pandemia');
    await page.waitForTimeout(150);
    await page.click('#rscCritLista [data-crit="6.19"]');
    await page.waitForTimeout(150);
    const criterioSelecionado = await page.$eval('#rscCrit', (el) => el.value);
    assertEqual(criterioSelecionado, '6.19', 'O critério 6.19 deveria ter sido selecionado');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);

    const salvo = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.categoryKey === 'RSC_CRISE_SAUDE');
        return it ? { typeKey: it.typeKey, fields: it.fields, rsc: it.rsc } : null;
    });
    assert(salvo, 'O item deveria ter sido salvo no catálogo');
    assertEqual(salvo.typeKey, 'RSC_CRISE_SAUDE_ATUACAO', 'Tipo salvo');
    assertEqual(salvo.fields.tipoSituacao, 'Pandemia', 'Tipo de situação salvo');
    assertEqual(salvo.rsc.criterio, '6.19', 'Critério RSC salvo');

    // 01/03/2021 → 01/07/2021 = 4 meses; critério 6.19 vale 1 ponto/mês → 4 pontos.
    const pontos = await page.evaluate((rsc) => window.LzRSC.pontosItem(rsc).pontos, salvo.rsc);
    assertEqual(pontos, 4, 'Um período de 4 meses no critério 6.19 (1 pt/mês) deveria valer 4 pontos');

    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);
    const texto = await page.$eval('#tab-rsc', (el) => el.textContent);
    assert(texto.includes('Pandemia'), 'O item contabilizado (rotulado por tipo de situação/ato) deveria aparecer no simulador RSC');
});
