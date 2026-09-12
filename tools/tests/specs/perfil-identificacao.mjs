/* ==========================================================================
   lattesZen — Identificação (perfil): "Nome em citações bibliográficas" como
   lista, migração do valor antigo (texto livre) e demais ajustes da auditoria
   contra docs/mapeamento-campos-lattes.md.
   --------------------------------------------------------------------------
   Identificação (e os demais tipos de "Dados gerais/perfil") deixaram de ter
   uma tela própria em Configurações — mesclados no fluxo normal de
   Catalogar, como qualquer outro item (a pedido do usuário). Estes testes
   passaram a abrir o item pelo formulário do Catalogar em vez do antigo
   `#perfilSection`/`form[data-perfil-form="..."]`.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirEdicao(page, item) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.evaluate((it) => window.AppCore.buildForm(window.AppCore.state.items.find((i) => i.id === it.id)), item);
    await page.waitForTimeout(200);
}

test('Nome em citações bibliográficas: valor antigo (texto livre) migra para lista, e dá para adicionar mais variações', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', {
            titulo: 'Alexsandro Cardoso Carvalho',
            citacoes: 'CARVALHO, Alexsandro Cardoso\nCARVALHO, Alexsandro',
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirEdicao(page, items[0]);

    const linhasMigradas = await page.locator('[data-repeater-list="citacoes"] li').allTextContents();
    assertEqual(linhasMigradas.map((t) => t.trim()), ['CARVALHO, Alexsandro Cardoso', 'CARVALHO, Alexsandro'],
        `As 2 variações do texto antigo deveriam aparecer como linhas da lista — obtidas: ${JSON.stringify(linhasMigradas)}`);

    await page.fill('[data-repeater-input="citacoes:nome"]', 'Carvalho, A. C.');
    await page.click('[data-repeater-add="citacoes"]');
    await page.waitForTimeout(200);

    const linhasComNova = await page.locator('[data-repeater-list="citacoes"] li').allTextContents();
    assert(linhasComNova.some((t) => t.trim() === 'Carvalho, A. C.'), `A nova variação adicionada deveria aparecer na lista — obtidas: ${JSON.stringify(linhasComNova)}`);

    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const ident = salvo.find((i) => i.typeKey === 'IDENTIFICACAO');
    assertEqual(ident.fields.citacoes, [
        { nome: 'CARVALHO, Alexsandro Cardoso' },
        { nome: 'CARVALHO, Alexsandro' },
        { nome: 'Carvalho, A. C.' },
    ], 'citacoes deveria ser salvo como lista (array de {nome}), incluindo a variação nova');
});

test('Cor ou raça inclui a opção "Amarela"', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' })];
    await seedCatalog(page, baseUrl, items);
    await abrirEdicao(page, items[0]);

    const opcoes = await page.locator('#dynFields select[name="corRaca"] option').allTextContents();
    assert(opcoes.map((o) => o.trim()).includes('Amarela'), `"Amarela" deveria estar entre as opções de Cor ou raça — obtidas: ${JSON.stringify(opcoes)}`);
});

test('Foto de perfil não tem mais os campos "Ano de início"/"Ano de fim" (não existem na tela real do Lattes)', async ({ page, baseUrl }) => {
    const items = [makeItem('FOTO_PERFIL', 'DADOS_GERAIS', { titulo: 'Foto oficial' })];
    await seedCatalog(page, baseUrl, items);
    await abrirEdicao(page, items[0]);

    const camposAno = await page.locator('#dynFields input[name="ano"], #dynFields input[name="anoFim"]').count();
    assert(camposAno === 0, 'O formulário de Foto de perfil não deveria mais ter campos de ano/anoFim');
});

test('Identificação, Endereço, Texto inicial, Outras informações, Foto de perfil e Área de atuação aparecem no Tipo do item de "01. Dados gerais"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);

    const opcoes = await page.$eval('#selTipo', (sel) => Array.from(sel.options).map((o) => o.value));
    for (const tk of ['IDENTIFICACAO', 'ENDERECO', 'RESUMO_CV', 'OUTRAS_INFO', 'FOTO_PERFIL', 'DOC_IDENTIDADE', 'DOC_PASSAPORTE', 'DOCUMENTO_PESSOAL']) {
        assert(opcoes.includes(tk), `"${tk}" deveria aparecer no Tipo do item de "01. Dados gerais" — obtidas: ${JSON.stringify(opcoes)}`);
    }

    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    const opcoesAtuacao = await page.$eval('#selTipo', (sel) => Array.from(sel.options).map((o) => o.value));
    assert(opcoesAtuacao.includes('AREA_ATUACAO'), `"AREA_ATUACAO" deveria aparecer no Tipo do item de "03. Atuação" — obtidas: ${JSON.stringify(opcoesAtuacao)}`);
});

test('Foto de perfil usa o bloco padrão de evidências (upload de imagem), não mais um widget próprio', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'FOTO_PERFIL');
    await page.waitForTimeout(150);

    const evidenceVisivel = await page.locator('#evidenceBlock').evaluate((el) => getComputedStyle(el).display !== 'none');
    assert(evidenceVisivel, 'O bloco padrão de evidências deveria aparecer para Foto de perfil');
    const accept = await page.locator('#pdfInput').getAttribute('accept');
    assertEqual(accept, 'image/jpeg,image/png', 'O input de arquivo deveria continuar restrito a JPEG/PNG');
});
