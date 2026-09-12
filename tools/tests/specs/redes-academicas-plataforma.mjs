/* ==========================================================================
   Regressão: "1. Dados gerais" › Redes acadêmicas — campo "Plataforma" virou
   um select de opções fixas (Currículo Lattes, Web of Science, Google
   Scholar (MyCitation), Zotero, Outra), em vez de texto livre.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Redes acadêmicas: "Plataforma" é um select com as 5 opções fixas pedidas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'CONEXAO_ACADEMICA');
    await page.waitForTimeout(150);

    const campo = page.locator('#dynFields select[name="titulo"]');
    assertEqual(await campo.count(), 1, 'O campo "Plataforma" deveria ser um <select>');
    const opcoes = await campo.evaluate((sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assertEqual(opcoes, ['Currículo Lattes', 'Web of Science', 'Google Scholar (MyCitation)', 'Zotero', 'Outra'], 'As opções deveriam ser exatamente as 5 fixas, nesta ordem');

    await page.selectOption('#dynFields select[name="titulo"]', 'Google Scholar (MyCitation)');
    await page.fill('#dynFields input[name="url"]', 'https://scholar.google.com/citations?user=abc123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(200);

    const item = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'CONEXAO_ACADEMICA'));
    assert(item, 'O item de Redes acadêmicas deveria ter sido salvo');
    assertEqual(item.fields.titulo, 'Google Scholar (MyCitation)', 'A plataforma escolhida deveria ser salva corretamente');
});
