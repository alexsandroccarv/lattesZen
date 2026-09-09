/* ==========================================================================
   Regressão: gráfico "Produção por tipo" na aba Linha do tempo (issue #10)
   --------------------------------------------------------------------------
   Barras empilhadas por ano, uma cor por TIPO de item de produção (categoria
   "05 Produções" — Bibliográfica/Técnica/Outra artística-cultural), com os
   tipos menos frequentes agrupados em "Outros" além dos 7 principais.
   "Tipo de produção" é decidido pelo TYPEKEY do item (via LattesTypes), não
   pelo categoryKey gravado nele — um Artigo em periódico continua contando
   aqui mesmo se arquivado em outra categoria (ex.: Educação e Popularização
   de C&T, que reaproveita os mesmos tipos).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirLinhaTempo(page, baseUrl, items) {
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);
}

function tituloDeSegmentos(page) {
    return page.$$eval('#graficoProducaoTipo svg title', (els) => els.map((e) => e.textContent));
}

test('Sem item de produção com ano identificável, mostra aviso em vez do gráfico', async ({ page, baseUrl }) => {
    // FORMACAO_COMPLEMENTAR não é um tipo de produção — não deveria contar aqui.
    await abrirLinhaTempo(page, baseUrl, [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso X', instituicao: 'Y', ano: '2020' }),
    ]);
    const texto = await page.$eval('#graficoProducaoTipo', (el) => el.textContent);
    assert(texto.includes('Nenhum item de produção'), 'Sem itens de produção, deveria mostrar o aviso, não o gráfico');
    assertEqual(await page.locator('#graficoProducaoTipo svg').count(), 0, 'Não deveria renderizar o SVG sem dados');
});

test('Conta por tipo × ano corretamente, inclusive tipo arquivado em outra categoria', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Art A', ano: '2020', periodico: 'R' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Art B', ano: '2020', periodico: 'R' }),
        // Mesmo tipo, mas arquivado em "Educação e Popularização de C&T" —
        // ainda é produção bibliográfica, deveria contar junto dos de cima.
        makeItem('ARTIGO_PERIODICO', 'EDUCACAO_CT', { titulo: 'Art C', ano: '2020', periodico: 'R' }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Livro D', ano: '2021' }),
        // Não é produção (Formação) — não deveria aparecer neste gráfico.
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso X', instituicao: 'Y', ano: '2020' }),
    ];
    await abrirLinhaTempo(page, baseUrl, items);

    assertEqual(await page.locator('#graficoProducaoTipo svg').count(), 1, 'Deveria renderizar o gráfico com itens de produção presentes');
    const titulos = await tituloDeSegmentos(page);
    assert(titulos.some((t) => /Artigos? .* — 2020: 3 itens/.test(t)), `Deveria ter um segmento de Artigo em periódico com 3 itens em 2020 (2 diretos + 1 de outra categoria) — títulos: ${JSON.stringify(titulos)}`);
    assert(titulos.some((t) => /2021: 1 item$/.test(t)), `Deveria ter um segmento com 1 item em 2021 (Livro/capítulo) — títulos: ${JSON.stringify(titulos)}`);
    assert(!titulos.some((t) => /Curso X|Formação/.test(t)), 'Item de Formação não deveria aparecer neste gráfico');

    const legenda = await page.$eval('#graficoProducaoTipo', (el) => el.textContent);
    assert(!/Formação/.test(legenda), 'Legenda não deveria mencionar tipos que não são de produção');
});

test('Mais de 7 tipos: só os 7 mais frequentes ganham série própria, o resto vira "Outros"', async ({ page, baseUrl }) => {
    // Contagens deliberadamente distintas (9, 8, 7, 6, 5, 4, 3 = top 7; 2, 1 = Outros = 3)
    const tipos = [
        ['ARTIGO_PERIODICO', 9], ['LIVROS', 8], ['TRABALHO_EVENTO', 7], ['APRESENTACAO', 6],
        ['CAPITULOS_LIVRO', 5], ['TEXTO_JORNAL', 4], ['TRADUCAO', 3],
        ['PREFACIO', 2], ['OUTRA_BIBLIOGRAFICA', 1],
    ];
    const items = [];
    tipos.forEach(([tk, n]) => {
        for (let i = 0; i < n; i++) items.push(makeItem(tk, 'PRODUCOES', { titulo: `${tk} ${i}`, ano: '2022', periodico: 'R' }));
    });
    await abrirLinhaTempo(page, baseUrl, items);

    const info = await page.evaluate(() => {
        const legenda = Array.from(document.querySelectorAll('#graficoProducaoTipo .flex.flex-wrap.gap-x-4 > span'))
            .map((el) => el.textContent.trim());
        return legenda;
    });
    assertEqual(info.length, 8, `Deveria haver 7 séries nomeadas + "Outros" = 8 itens de legenda — obtido: ${JSON.stringify(info)}`);
    assert(info.some((t) => /Outros \(3\)/.test(t)), `"Outros" deveria somar os 2 tipos menos frequentes (2+1=3) — legenda: ${JSON.stringify(info)}`);
    assert(info.some((t) => /\(9\)/.test(t)), 'O tipo mais frequente (9 itens) deveria aparecer com série própria na legenda');
});

test('"Ver como tabela" existe, recolhida por padrão, com os mesmos totais do gráfico', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Art A', ano: '2020', periodico: 'R' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Art B', ano: '2021', periodico: 'R' }),
    ];
    await abrirLinhaTempo(page, baseUrl, items);

    const aberta = await page.$eval('#graficoProducaoTipo details', (el) => el.open);
    assertEqual(aberta, false, '"Ver como tabela" deveria começar recolhida');

    const tabela = await page.evaluate(() => {
        const det = document.querySelector('#graficoProducaoTipo details');
        det.open = true;
        const linhas = Array.from(det.querySelectorAll('tbody tr')).map((tr) =>
            Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()));
        const cabecalho = Array.from(det.querySelectorAll('thead th')).map((th) => th.textContent.trim());
        return { linhas, cabecalho };
    });
    assertEqual(tabela.cabecalho, ['Tipo', '2020', '2021', 'Total'], 'Cabeçalho da tabela deveria ter Tipo, os anos em ordem crescente e Total');
    assertEqual(tabela.linhas.length, 1, 'Deveria haver 1 linha (só 1 tipo com itens)');
    assertEqual(tabela.linhas[0].slice(1), ['1', '1', '2'], 'A linha do tipo deveria mostrar 1 item em cada ano e total 2');
});

test('Seção "Produção por tipo" aparece depois de "Linha do tempo", com título e ícone próprios', async ({ page, baseUrl }) => {
    await abrirLinhaTempo(page, baseUrl, [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Art A', ano: '2020', periodico: 'R' }),
    ]);
    const h2s = await page.$$eval('#tab-linhatempo h2', (els) => els.map((el) => el.textContent.trim()));
    const idxLinha = h2s.findIndex((h) => /Linha do tempo/.test(h));
    const idxProducao = h2s.findIndex((h) => /Produção por tipo/.test(h));
    assert(idxLinha !== -1 && idxProducao !== -1 && idxLinha < idxProducao, `"Produção por tipo" deveria vir depois de "Linha do tempo" — títulos: ${h2s.join(' | ')}`);
});
