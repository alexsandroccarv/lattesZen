/* ==========================================================================
   Regressão: nova aba "Linha do tempo" — painel estilo "gráfico de
   contribuições" (GitHub) com uma linha por categoria e uma coluna por ano;
   a intensidade da cor do quadradinho reflete a quantidade de itens daquela
   categoria naquele ano. O "ano" de cada item reaproveita AppCore.itemYear()
   (o mesmo já usado em Conformidade/Publicar), então itens com período
   (ex.: Formação) contam num único ano, não em todos os anos do intervalo.

   Ajustes de UI: rótulos das linhas sem o número da categoria; a categoria
   "Dados gerais" (identificação/perfil, não é "produção") não aparece;
   anos em ordem decrescente (mais recente primeiro); quadradinhos ~30%
   menores (16px → 11px).

   Nuvem de palavras (acima da grade): frequência de palavras extraídas de
   título, palavras-chave ("palavrasChave", separado por ";") e área de
   conhecimento dos itens — mesmas categorias "não-produção" excluídas,
   stopwords (de, da, em...) filtradas, palavra mais frequente com fonte
   maior.

   Configurações → Nuvem de palavras: duas listas configuráveis pelo
   usuário — palavras excluídas (nunca aparecem) e termos compostos (mais
   de uma palavra, ex.: "tech talks", contados como um único termo em vez
   de "tech" e "talks" separados).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('Catálogo vazio mostra aviso em vez da grade', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);

    const texto = await page.$eval('#tab-linhatempo', (el) => el.textContent);
    assert(texto.includes('Nenhum item com ano identificável'), 'Sem itens com ano, deveria mostrar o aviso, não a grade');
});

test('Linha do tempo conta os itens por categoria e ano (quadradinho com o total exato)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo A', ano: '2020' }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo B', ano: '2020' }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo C', ano: '2021' }),
        // Item com período (início/fim): itemYear() usa o ano de fim, um único ano — não espalha pelo intervalo.
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso X', anoInicio: '2018', anoFim: '2019' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('#gradeLinhaTempo td [data-ano]'));
        const find = (ano) => cells.filter((c) => c.dataset.ano === String(ano)).map((c) => +c.dataset.qtd);
        return {
            anos2020: find(2020),
            anos2021: find(2021),
            anos2018: find(2018),
            anos2019: find(2019),
            texto: document.querySelector('#tab-linhatempo').textContent,
        };
    });

    assert(info.anos2020.includes(2), 'Deveria haver um quadradinho com quantidade 2 no ano 2020 (Artigo A + B)');
    assert(info.anos2021.includes(1), 'Deveria haver um quadradinho com quantidade 1 no ano 2021 (Artigo C)');
    assert(info.anos2019.includes(1), 'Curso com período 2018-2019 deveria contar no ano de FIM (2019)');
    assertEqual(info.anos2018.some((q) => q === 1), false, 'Curso com período 2018-2019 NÃO deveria contar (de novo) no ano de início — um único ano por item');
    assert(info.texto.includes('Formação'), 'A categoria Formação deveria aparecer como linha da grade');
    assert(info.texto.includes('Produções') || info.texto.includes('produções'), 'A categoria Produções deveria aparecer como linha da grade');
});

test('Rótulos das linhas sem número da categoria, anos em ordem decrescente e quadradinhos ~30% menores', async ({ page, baseUrl }) => {
    const items = [
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo A', ano: '2019' }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo B', ano: '2022' }),
        // Foto de perfil e Prêmios (ambos categoria Dados gerais) têm campo
        // "ano", mas a categoria não deve aparecer na grade.
        makeItem('FOTO_PERFIL', 'DADOS_GERAIS', { titulo: 'Foto oficial', ano: '2021' }),
        makeItem('PREMIO', 'DADOS_GERAIS', { titulo: 'Prêmio X', ano: '2021', entidade: 'Entidade Y' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const rotulos = Array.from(document.querySelectorAll('#gradeLinhaTempo tbody tr th')).map((th) => th.textContent.trim());
        const anosColunas = Array.from(document.querySelectorAll('#gradeLinhaTempo thead th')).slice(1).map((th) => +th.textContent.trim());
        const primeiroQuadradinho = document.querySelector('#gradeLinhaTempo td [data-ano]');
        const legenda = document.querySelector('#gradeLinhaTempo .flex.items-center.gap-1.text-xs div');
        return { rotulos, anosColunas, quadradinhoClasse: primeiroQuadradinho.className, legendaClasse: legenda ? legenda.className : null };
    });

    assert(info.rotulos.includes('Produções'), `Rótulo da categoria deveria ser "Produções", sem número — obtido entre: ${info.rotulos.join(', ')}`);
    assert(!info.rotulos.some((r) => /^\d/.test(r)), `Nenhum rótulo de categoria deveria começar com número — obtidos: ${info.rotulos.join(', ')}`);
    assert(!info.rotulos.some((r) => /Foto/i.test(r)), `A categoria "Fotos de Perfil" não deveria aparecer na grade — obtidos: ${info.rotulos.join(', ')}`);
    assert(!info.rotulos.some((r) => /Dados gerais/i.test(r)), `A categoria "Dados gerais" não deveria aparecer na grade — obtidos: ${info.rotulos.join(', ')}`);

    const anosOrdenados = info.anosColunas.slice().sort((a, b) => b - a);
    assertEqual(info.anosColunas, anosOrdenados, 'As colunas de ano deveriam estar em ordem decrescente (mais recente primeiro)');

    assert(/w-\[11px\]/.test(info.quadradinhoClasse) && /h-\[11px\]/.test(info.quadradinhoClasse), `Quadradinho da grade deveria ser 11px (~30% menor que 16px) — classe obtida: "${info.quadradinhoClasse}"`);

    const legendaClasses = (info.legendaClasse || '').split(/\s+/);
    assert(legendaClasses.includes('w-2') && legendaClasses.includes('h-2'), `Quadradinho da legenda deveria acompanhar a redução (w-2/h-2) — classe obtida: "${info.legendaClasse}"`);
});

test('Nuvem de palavras: frequência de título/palavras-chave/área, sem categorias excluídas nem stopwords, acima da grade', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Aprendizagem de máquina aplicada', palavrasChave: 'aprendizagem; educação; tecnologia',
            areaConhecimento: 'Ciência da Computação', ano: '2020',
        }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Aprendizagem colaborativa em sala de aula', palavrasChave: 'aprendizagem; colaboração',
            areaConhecimento: 'Educação', ano: '2021',
        }),
        // Categoria excluída (Dados gerais): não deveria contribuir palavras.
        makeItem('PREMIO', 'DADOS_GERAIS', { titulo: 'Medalha de excelência acadêmica', ano: '2021', entidade: 'Entidade Z' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('#tab-linhatempo [data-palavra]'));
        const porPalavra = {};
        spans.forEach((s) => { porPalavra[s.dataset.palavra] = { freq: +s.dataset.freq, fontSize: parseFloat(s.style.fontSize) }; });
        const h2s = Array.from(document.querySelectorAll('#tab-linhatempo h2')).map((h) => h.textContent.trim());
        return { porPalavra, palavras: Object.keys(porPalavra), h2s };
    });

    assertEqual(info.porPalavra['aprendizagem'] && info.porPalavra['aprendizagem'].freq, 4, `"aprendizagem" deveria aparecer 4 vezes (2 títulos + 2 palavras-chave) — obtido: ${JSON.stringify(info.porPalavra['aprendizagem'])}`);
    assert(info.porPalavra['aprendizagem'].fontSize > info.porPalavra['tecnologia'].fontSize, 'Palavra mais frequente ("aprendizagem") deveria ter fonte maior que uma menos frequente ("tecnologia")');

    assert(!info.palavras.some((p) => /medalha|excelência|acadêmica/.test(p)), `Palavras do item de categoria excluída (Dados gerais) não deveriam aparecer — obtidas: ${info.palavras.join(', ')}`);
    assert(!info.palavras.includes('de') && !info.palavras.includes('da') && !info.palavras.includes('em'), `Stopwords não deveriam aparecer como palavra — obtidas: ${info.palavras.join(', ')}`);

    const idxNuvem = info.h2s.findIndex((h) => /Nuvem de palavras/.test(h));
    const idxLinha = info.h2s.findIndex((h) => /Linha do tempo/.test(h));
    assert(idxNuvem !== -1 && idxLinha !== -1 && idxNuvem < idxLinha, `A seção "Nuvem de palavras" deveria vir antes de "Linha do tempo" — títulos na ordem: ${info.h2s.join(' | ')}`);
});

test('Nuvem de palavras: palavras posicionadas em formato de nuvem (espiral), não em linhas sequenciais', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Robótica sensores atuadores controle automação industrial embarcado',
            palavrasChave: 'robotica; sensores; atuadores; controle; automacao; industrial; embarcado; eletronica',
            ano: '2020',
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const area = document.querySelector('#nuvemPalavrasArea');
        const spans = Array.from(document.querySelectorAll('#tab-linhatempo [data-palavra]'));
        return {
            areaPosition: area ? area.style.position : null,
            areaHeight: area ? parseFloat(area.style.height) : null,
            posicoes: spans.map((s) => ({ position: s.style.position, left: parseFloat(s.style.left), top: parseFloat(s.style.top) })),
        };
    });

    assert(info.posicoes.length >= 6, `Teste precisa de várias palavras para ser conclusivo — obtidas: ${info.posicoes.length}`);
    assertEqual(info.areaPosition, 'relative', 'O contêiner da nuvem deveria ter position:relative (base para o posicionamento livre das palavras)');
    assert(info.areaHeight > 0, 'O contêiner da nuvem deveria ter uma altura calculada (não fixa/zero)');
    assert(info.posicoes.every((p) => p.position === 'absolute'), 'Cada palavra deveria ter position:absolute (posicionamento livre, não fluxo normal em linhas)');
    assert(info.posicoes.every((p) => !isNaN(p.left) && !isNaN(p.top)), 'Cada palavra deveria ter left/top numéricos definidos');

    const esquerdas = info.posicoes.map((p) => p.left);
    const emOrdemCrescente = esquerdas.every((v, i) => i === 0 || v >= esquerdas[i - 1]);
    assert(!emOrdemCrescente, `As posições horizontais não deveriam crescer em sequência estrita (isso indicaria linhas, não uma nuvem) — obtidas: ${esquerdas.join(', ')}`);
});

test('Configurações: lista de exclusão e lista de termos compostos da nuvem de palavras', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Tech Talks sobre resiliencia institucional',
            palavrasChave: 'tech talks; resiliencia; institucional',
            ano: '2021',
        }),
    ];
    await seedCatalog(page, baseUrl, items);

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.fill('#nuvemExclusaoInput', 'institucional');
    await page.fill('#nuvemCompostasInput', 'tech talks');
    await page.click('#btnSalvarNuvemListas');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}'));
    assertEqual(salvo.nuvemExclusao, ['institucional'], 'A lista de exclusão deveria ter sido salva em lz_settings');
    assertEqual(salvo.nuvemCompostas, ['tech talks'], 'A lista de termos compostos deveria ter sido salva em lz_settings');

    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);
    const palavras = await page.evaluate(() => Array.from(document.querySelectorAll('#tab-linhatempo [data-palavra]')).map((s) => s.dataset.palavra));

    assert(palavras.includes('tech talks'), `"tech talks" deveria aparecer como um único termo composto — obtidas: ${palavras.join(', ')}`);
    assert(!palavras.includes('tech') && !palavras.includes('talks'), `"tech" e "talks" NÃO deveriam aparecer separados quando configurados como termo composto — obtidas: ${palavras.join(', ')}`);
    assert(!palavras.includes('institucional'), `"institucional" deveria estar excluída da nuvem — obtidas: ${palavras.join(', ')}`);
    assert(palavras.includes('resiliencia'), `"resiliencia" (não excluída) deveria continuar aparecendo — obtidas: ${palavras.join(', ')}`);
});

test('Configurações: listas da nuvem também funcionam separadas por vírgula ou quebra de linha', async ({ page, baseUrl }) => {
    // Reproduz o relato real de um usuário ("usei a lista mas não reconfigurou
    // a nuvem de palavras"): ele separou os termos por vírgula/linha em vez
    // de ";" — formato que antes virava um único "termo" gigante que nunca
    // batia com nenhuma palavra real da nuvem.
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Tech Talks sobre resiliencia institucional',
            palavrasChave: 'tech talks; resiliencia; institucional',
            ano: '2021',
        }),
    ];
    await seedCatalog(page, baseUrl, items);

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.fill('#nuvemExclusaoInput', 'institucional, resiliencia');
    await page.fill('#nuvemCompostasInput', 'tech talks\nmachine learning');
    await page.click('#btnSalvarNuvemListas');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}'));
    assertEqual(salvo.nuvemExclusao, ['institucional', 'resiliencia'], 'Vírgula deveria separar a lista de exclusão em dois termos distintos');
    assertEqual(salvo.nuvemCompostas, ['tech talks', 'machine learning'], 'Quebra de linha deveria separar a lista de termos compostos em dois termos distintos');

    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);
    const palavras = await page.evaluate(() => Array.from(document.querySelectorAll('#tab-linhatempo [data-palavra]')).map((s) => s.dataset.palavra));

    assert(palavras.includes('tech talks'), `"tech talks" deveria aparecer como um único termo composto — obtidas: ${palavras.join(', ')}`);
    assert(!palavras.includes('institucional') && !palavras.includes('resiliencia'), `"institucional" e "resiliencia" deveriam estar excluídas — obtidas: ${palavras.join(', ')}`);
});
