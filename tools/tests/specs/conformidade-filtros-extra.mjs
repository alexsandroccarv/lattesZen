/* ==========================================================================
   Regressão: 4 novos filtros de Conformidade — "Datas trocadas" (fim antes
   do início), "Ano suspeito" (fora de 1950..ano+1), "Sem instituição" e
   "Sem ISSN/ISBN". Mesmo mecanismo dos filtros existentes (ícone por item +
   chip em "Outras pendências", ambos data-view/VIEW_PREDICATE) — aqui só
   cobre os predicados novos (isPeriodoInvalido/isAnoImplausivel/
   isSemInstituicao/isSemIdentificador em tab-conformidade.js).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirConformidade(page, baseUrl, items) {
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
}
async function clickIconOn(page, titulo, faClass) {
    await page.evaluate(({ t, cls }) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        const btn = Array.from(card.querySelectorAll('button[data-view]')).find((b) => b.querySelector('i.' + cls));
        btn.click();
    }, { t: titulo, cls: faClass });
    await page.waitForTimeout(200);
}
async function itemCount(page) { return page.$eval('#itemCount', (el) => el.textContent.trim()); }
async function hasIcon(page, titulo, faClass) {
    return page.evaluate(({ t, cls }) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        return !!(card && card.querySelector('i.' + cls));
    }, { t: titulo, cls: faClass });
}

test('"Datas trocadas": fim antes do início é sinalizado; período normal e "Atual" (fim desabilitado) não são', async ({ page, baseUrl }) => {
    // itemTitle(VINCULO_PROFISSIONAL) usa o campo "cargo" como rótulo do card
    // (quando preenchido) — usado aqui só pra dar um título distinto a cada item.
    const items = [
        makeItem('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'Universidade X', cargo: 'Cargo Trocado', situacao: 'Anterior (finalizado)', anoInicio: '2024', anoFim: '2020' }), // trocadas
        makeItem('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'Universidade X', cargo: 'Cargo Normal', situacao: 'Anterior (finalizado)', anoInicio: '2020', anoFim: '2024' }), // normal
        makeItem('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'Universidade X', cargo: 'Cargo Atual', situacao: 'Atual (não finalizado)', anoInicio: '2020', anoFim: '2010' }), // "atual": anoFim desabilitado, mesmo com valor velho trocado
    ];
    await abrirConformidade(page, baseUrl, items);

    assert(await hasIcon(page, 'Cargo Trocado', 'fa-calendar-xmark'), 'Item com fim antes do início deveria mostrar o ícone de datas trocadas');
    assert(!(await hasIcon(page, 'Cargo Normal', 'fa-calendar-xmark')), 'Item com período normal não deveria mostrar o ícone');
    assert(!(await hasIcon(page, 'Cargo Atual', 'fa-calendar-xmark')), '"Atual" desabilita o campo Fim — não deveria ser sinalizado mesmo com um valor velho trocado no campo');

    await clickIconOn(page, 'Cargo Trocado', 'fa-calendar-xmark');
    assertEqual(await itemCount(page), '(1 de 3)', 'Filtrar por "Datas trocadas" deveria trazer só o item com fim < início');
});

test('"Ano suspeito": ano fora de 1950..ano-que-vem é sinalizado (protege contra erro de digitação)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Ano Errado', instituicao: 'X', anoInicio: '2924' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Ano Normal', instituicao: 'X', anoInicio: '2020' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Ano Antigo Demais', instituicao: 'X', anoInicio: '1899' }),
    ];
    await abrirConformidade(page, baseUrl, items);

    assert(await hasIcon(page, 'Curso Ano Errado', 'fa-triangle-exclamation'), 'Ano "2924" deveria ser sinalizado como suspeito');
    assert(await hasIcon(page, 'Curso Ano Antigo Demais', 'fa-triangle-exclamation'), 'Ano "1899" (antes de 1950) deveria ser sinalizado como suspeito');
    assert(!(await hasIcon(page, 'Curso Ano Normal', 'fa-triangle-exclamation')), 'Ano "2020" não deveria ser sinalizado');

    await clickIconOn(page, 'Curso Ano Errado', 'fa-triangle-exclamation');
    assertEqual(await itemCount(page), '(2 de 3)', 'Filtrar por "Ano suspeito" deveria trazer os 2 itens com ano fora do intervalo plausível');
});

test('"Sem instituição": campo em branco é sinalizado; tipos sem campo "instituicao" não mostram o ícone', async ({ page, baseUrl }) => {
    const items = [
        makeItem('LINHA_PESQUISA', 'ATUACAO', { titulo: 'Linha Sem Instituição' }), // instituicao em branco
        makeItem('LINHA_PESQUISA', 'ATUACAO', { titulo: 'Linha Com Instituição', instituicao: 'USP' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Sem Campo Instituicao', ano: '2024', periodico: 'Revista Z' }), // não tem campo "instituicao"
    ];
    await abrirConformidade(page, baseUrl, items);

    assert(await hasIcon(page, 'Linha Sem Instituição', 'fa-building-circle-xmark'), 'Linha de pesquisa sem instituição deveria ser sinalizada');
    assert(!(await hasIcon(page, 'Linha Com Instituição', 'fa-building-circle-xmark')), 'Linha de pesquisa com instituição preenchida não deveria ser sinalizada');
    assert(!(await hasIcon(page, 'Artigo Sem Campo Instituicao', 'fa-building-circle-xmark')), 'Tipo sem campo "instituicao" (ex.: Artigo em periódico) não deveria mostrar o ícone');

    await clickIconOn(page, 'Linha Sem Instituição', 'fa-building-circle-xmark');
    assertEqual(await itemCount(page), '(1 de 3)', 'Filtrar por "Sem instituição" deveria trazer só o item com o campo em branco');
});

test('"Sem ISSN/ISBN": campo em branco é sinalizado (âmbar); tipos sem esses campos não mostram o ícone', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Sem ISSN', ano: '2024', periodico: 'Revista A' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Com ISSN', ano: '2024', periodico: 'Revista B', issn: '1234-5678' }),
        makeItem('LIVROS', 'PRODUCOES', { titulo: 'Livro Sem ISBN', ano: '2024' }),
        makeItem('LINHA_PESQUISA', 'ATUACAO', { titulo: 'Linha Sem Campo ISSN/ISBN', instituicao: 'USP' }), // não tem campo issn/isbn
    ];
    await abrirConformidade(page, baseUrl, items);

    assert(await hasIcon(page, 'Artigo Sem ISSN', 'fa-barcode'), 'Artigo sem ISSN deveria ser sinalizado');
    assert(!(await hasIcon(page, 'Artigo Com ISSN', 'fa-barcode')), 'Artigo com ISSN preenchido não deveria ser sinalizado');
    assert(await hasIcon(page, 'Livro Sem ISBN', 'fa-barcode'), 'Livro sem ISBN deveria ser sinalizado');
    assert(!(await hasIcon(page, 'Linha Sem Campo ISSN/ISBN', 'fa-barcode')), 'Tipo sem campo ISSN/ISBN não deveria mostrar o ícone');

    await clickIconOn(page, 'Artigo Sem ISSN', 'fa-barcode');
    assertEqual(await itemCount(page), '(2 de 4)', 'Filtrar por "Sem ISSN/ISBN" deveria trazer os 2 itens sem identificador');
});

test('Os chips extras aparecem em "Outras pendências", com contagem correta', async ({ page, baseUrl }) => {
    const items = [
        makeItem('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'X', titulo: 'V1', situacao: 'Anterior (finalizado)', anoInicio: '2024', anoFim: '2020' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'F1', instituicao: 'X', anoInicio: '2924' }),
        makeItem('LINHA_PESQUISA', 'ATUACAO', { titulo: 'L1' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'A1', ano: '2024', periodico: 'Revista A' }), // sem issn e sem autoresLista
    ];
    await abrirConformidade(page, baseUrl, items);

    const chipCount = async (view) => page.$eval(`[data-view="${view}"] span.font-bold`, (el) => el.textContent.trim());
    assertEqual(await chipCount('periodoInvalido'), '1', 'Chip "Datas trocadas" deveria contar 1');
    assertEqual(await chipCount('anoImplausivel'), '1', 'Chip "Ano suspeito" deveria contar 1');
    assertEqual(await chipCount('semInstituicao'), '1', 'Chip "Sem instituição" deveria contar 1');
    assertEqual(await chipCount('semIdentificador'), '1', 'Chip "Sem ISSN/ISBN" deveria contar 1');
    assertEqual(await chipCount('semAutores'), '1', 'Chip "Sem autores" deveria contar 1 (A1, sem autoresLista)');
    assertEqual(await chipCount('possivelDuplicata'), '0', 'Nenhum título se repete neste conjunto — chip deveria contar 0');

    // Os chips "não" (Exportar p/ Lattes / Publicar na Web) saíram do resumo
    // — decisão deliberada do usuário, não uma pendência de dado.
    assertEqual(await page.locator('#outrasPendenciasBox [data-view="exportLattesNao"]').count(), 0, '"Exportar p/ Lattes: não" não deveria mais ter chip no resumo');
    assertEqual(await page.locator('#outrasPendenciasBox [data-view="pubWebNao"]').count(), 0, '"Publicar na Web: não" não deveria mais ter chip no resumo');
});

test('"Sem autores": autoresLista/autores em branco é sinalizado; tipos sem esses campos e "orientando" (já obrigatório) não são', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Sem Autores', ano: '2024', periodico: 'Revista A' }), // autoresLista ausente
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Com Autores', ano: '2024', periodico: 'Revista B', autoresLista: [{ nomeCompleto: 'Fulana de Tal' }] }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Livro Sem Autores', ano: '2024', autores: '' }), // campo "autores" (textarea), em branco
        makeItem('LINHA_PESQUISA', 'ATUACAO', { titulo: 'Linha Sem Campo Autores', instituicao: 'USP' }), // não tem campo autores
        makeItem('ORIENTACAO_ANDAMENTO', 'ORIENTACOES', { titulo: 'Orientação', orientando: 'Ciclano', ano: '2024' }), // "orientando" já obrigatório — fora de propósito
    ];
    await abrirConformidade(page, baseUrl, items);

    assert(await hasIcon(page, 'Artigo Sem Autores', 'fa-user-slash'), 'Artigo sem autoresLista deveria ser sinalizado');
    assert(!(await hasIcon(page, 'Artigo Com Autores', 'fa-user-slash')), 'Artigo com pelo menos um autor não deveria ser sinalizado');
    assert(await hasIcon(page, 'Livro Sem Autores', 'fa-user-slash'), 'Livro/capítulo com campo "autores" em branco deveria ser sinalizado');
    assert(!(await hasIcon(page, 'Linha Sem Campo Autores', 'fa-user-slash')), 'Tipo sem campo de autores não deveria mostrar o ícone');
    assert(!(await hasIcon(page, 'Orientação', 'fa-user-slash')), '"orientando" já é obrigatório (cai em Descrição obrigatória) — não deveria duplicar aqui');

    await clickIconOn(page, 'Artigo Sem Autores', 'fa-user-slash');
    assertEqual(await itemCount(page), '(2 de 5)', 'Filtrar por "Sem autores" deveria trazer os 2 itens sem autor preenchido');
});

test('"Possível duplicata": mesmo tipo + título + ano é sinalizado (ignora acento/caixa); título/ano/tipo diferente não são', async ({ page, baseUrl }) => {
    // Duas duplicatas de verdade (mesmo tipo, mesmo ano, título igual a menos
    // de acento/caixa) têm o MESMO título visível no card — não dá pra
    // distinguir uma da outra por texto, então este teste usa contagem
    // (chip + itemCount), não busca por título como os demais testes deste
    // arquivo.
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Avaliação de Políticas Públicas', ano: '2024', periodico: 'Revista A' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'AVALIACAO DE POLITICAS PUBLICAS', ano: '2024', periodico: 'Revista B' }), // mesmo título normalizado + mesmo ano + mesmo tipo
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Avaliação de Políticas Públicas', ano: '2020', periodico: 'Revista C' }), // mesmo título, ano diferente
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Avaliação de Políticas Públicas', ano: '2024' }), // mesmo título/ano, tipo diferente
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Outro Artigo Qualquer', ano: '2024', periodico: 'Revista D' }),
    ];
    await abrirConformidade(page, baseUrl, items);

    const chipCount = async (view) => page.$eval(`[data-view="${view}"] span.font-bold`, (el) => el.textContent.trim());
    assertEqual(await chipCount('possivelDuplicata'), '2', 'Só os 2 itens com mesmo tipo+título(normalizado)+ano deveriam contar como duplicata');

    await page.click('[data-view="possivelDuplicata"]');
    await page.waitForTimeout(200);
    assertEqual(await itemCount(page), '(2 de 5)', 'Filtrar por "Possível duplicata" deveria trazer só os 2 itens duplicados entre si');
});
