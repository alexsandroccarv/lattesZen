/* ==========================================================================
   Regressão: "1. Dados gerais" › Redes acadêmicas
   --------------------------------------------------------------------------
   - "Plataforma" é um select de opções fixas (Currículo Lattes, Web of
     Science, Google Scholar (MyCitation), Zotero, Outra), em vez de texto
     livre.
   - Sem "Identificador / ID": o identificador já faz parte do Link (URL).
   - Escolher "Outra" abre um campo para escrever o nome da rede — usado na
     exibição do item (em vez do rótulo genérico "Outra").
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirRedesAcademicas(page) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'CONEXAO_ACADEMICA');
    await page.waitForTimeout(150);
}

test('Redes acadêmicas: "Plataforma" é um select com as 5 opções fixas pedidas, sem campo de Identificador/ID', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirRedesAcademicas(page);

    const campo = page.locator('#dynFields select[name="titulo"]');
    assertEqual(await campo.count(), 1, 'O campo "Plataforma" deveria ser um <select>');
    const opcoes = await campo.evaluate((sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assertEqual(opcoes, ['Currículo Lattes', 'Web of Science', 'Google Scholar (MyCitation)', 'Zotero', 'Outra'], 'As opções deveriam ser exatamente as 5 fixas, nesta ordem');
    assertEqual(await page.locator('#dynFields [name="usuario"]').count(), 0, 'Não deveria mais existir um campo de Identificador/ID (já faz parte da URL)');

    await page.selectOption('#dynFields select[name="titulo"]', 'Google Scholar (MyCitation)');
    await page.fill('#dynFields input[name="url"]', 'https://scholar.google.com/citations?user=abc123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(200);

    const item = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'CONEXAO_ACADEMICA'));
    assert(item, 'O item de Redes acadêmicas deveria ter sido salvo');
    assertEqual(item.fields.titulo, 'Google Scholar (MyCitation)', 'A plataforma escolhida deveria ser salva corretamente');
    assert(!('usuario' in item.fields), 'O item salvo não deveria ter o campo "usuario"');
});

test('Redes acadêmicas: "Nome da rede" só aparece quando a Plataforma é "Outra"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirRedesAcademicas(page);

    const campoNome = page.locator('[data-field="outraNome"]');
    assert(await campoNome.evaluate((el) => el.classList.contains('hidden')), 'Sem "Outra" escolhida, o campo "Nome da rede" deveria ficar escondido');

    await page.selectOption('#dynFields select[name="titulo"]', 'Outra');
    await page.waitForTimeout(150);
    assert(!(await campoNome.evaluate((el) => el.classList.contains('hidden'))), 'Com "Outra" escolhida, o campo "Nome da rede" deveria aparecer');

    await page.selectOption('#dynFields select[name="titulo"]', 'Zotero');
    await page.waitForTimeout(150);
    assert(await campoNome.evaluate((el) => el.classList.contains('hidden')), 'Voltando pra uma opção fixa, o campo "Nome da rede" deveria esconder de novo');
});

test('Redes acadêmicas: escolher "Outra" e nomear a rede salva e exibe o nome digitado, não "Outra"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirRedesAcademicas(page);

    await page.selectOption('#dynFields select[name="titulo"]', 'Outra');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="outraNome"]', 'Academia.edu');
    await page.fill('#dynFields input[name="url"]', 'https://independent.academia.edu/exemplo');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(200);

    const item = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'CONEXAO_ACADEMICA'));
    assert(item, 'O item deveria ter sido salvo');
    assertEqual(item.fields.titulo, 'Outra', 'A plataforma salva continua "Outra" (o select precisa re-selecionar "Outra" ao editar)');
    assertEqual(item.fields.outraNome, 'Academia.edu', 'O nome digitado deveria ser salvo em "outraNome"');
});

test('Redes acadêmicas: item com "Outra" exibe o nome digitado na lista, não o rótulo genérico "Outra"', async ({ page, baseUrl }) => {
    const items = [makeItem('CONEXAO_ACADEMICA', 'DADOS_GERAIS', { titulo: 'Outra', outraNome: 'Academia.edu', url: 'https://independent.academia.edu/exemplo' })];
    await seedCatalog(page, baseUrl, items);
    const texto = await page.evaluate(() => window.LattesTypes.itemTitle(window.AppCore.state.items[0]));
    assertEqual(texto, 'Academia.edu', 'A exibição do item deveria usar o nome digitado, não "Outra"');
});
