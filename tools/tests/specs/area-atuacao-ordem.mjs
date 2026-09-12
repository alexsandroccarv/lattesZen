/* ==========================================================================
   lattesZen — Áreas de atuação: reordenar (▲▼) a lista.
   Ajuste da auditoria contra docs/mapeamento-campos-lattes.md (3.7.1 —
   "controle de ordem por setas"), que a tela real do Lattes tem.
   --------------------------------------------------------------------------
   A lista de reordenação morava em Configurações (#perfilSection); Área de
   atuação foi mesclada no fluxo normal de Catalogar (categoria "03.
   Atuação"), e a lista/setas foram junto — aparecem entre a seleção do tipo
   e o formulário de cadastro (#areaAtuacaoCadastradasBlock), no mesmo local
   onde já aparecem os idiomas já cadastrados ao escolher o tipo Idiomas.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirAreaAtuacao(page) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'AREA_ATUACAO');
    await page.waitForTimeout(150);
}

test('Áreas de atuação: setas ▲▼ reordenam a lista e persistem a nova ordem', async ({ page, baseUrl }) => {
    const items = [
        makeItem('AREA_ATUACAO', 'ATUACAO', { grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: '', especialidade: '' }),
        makeItem('AREA_ATUACAO', 'ATUACAO', { grandeArea: 'Ciências Sociais Aplicadas', area: 'Direito', subarea: '', especialidade: '' }),
        makeItem('AREA_ATUACAO', 'ATUACAO', { grandeArea: 'Ciências Exatas e da Terra', area: 'Física', subarea: '', especialidade: '' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirAreaAtuacao(page);

    const bloco = page.locator('#areaAtuacaoCadastradasBlock');
    assert(!(await bloco.evaluate((el) => el.classList.contains('hidden'))), 'A lista de áreas já cadastradas deveria aparecer para o tipo Área de atuação');

    const ordemInicial = await bloco.locator('li span.flex-1').allTextContents();
    assertEqual(ordemInicial.map((t) => t.trim()), ['Ciências da Saúde > Medicina', 'Ciências Sociais Aplicadas > Direito', 'Ciências Exatas e da Terra > Física'],
        `Ordem inicial incorreta — obtida: ${JSON.stringify(ordemInicial)}`);

    // Primeira linha não tem "Subir" habilitado.
    const primeiraSubir = bloco.locator('li').first().locator('[data-area-up]');
    assert(await primeiraSubir.isDisabled(), 'O botão "Subir" da primeira área deveria estar desabilitado');

    // Sobe "Direito" (2ª linha) para o topo.
    await bloco.locator('li', { hasText: 'Direito' }).locator('[data-area-up]').click();
    await page.waitForTimeout(200);

    const ordemDepois = await bloco.locator('li span.flex-1').allTextContents();
    assertEqual(ordemDepois.map((t) => t.trim()), ['Ciências Sociais Aplicadas > Direito', 'Ciências da Saúde > Medicina', 'Ciências Exatas e da Terra > Física'],
        `Ordem após subir "Direito" incorreta — obtida: ${JSON.stringify(ordemDepois)}`);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const areasSalvas = salvo.filter((i) => i.typeKey === 'AREA_ATUACAO').map((i) => i.fields.area);
    assertEqual(areasSalvas, ['Direito', 'Medicina', 'Física'], `A nova ordem deveria ter sido persistida no catálogo — obtida: ${JSON.stringify(areasSalvas)}`);
});

test('Áreas de atuação: link "Editar" na lista abre o item no formulário de Catalogar', async ({ page, baseUrl }) => {
    const items = [makeItem('AREA_ATUACAO', 'ATUACAO', { grandeArea: 'Ciências Exatas e da Terra', area: 'Física', subarea: '', especialidade: '' })];
    await seedCatalog(page, baseUrl, items);
    await abrirAreaAtuacao(page);

    await page.click(`[data-editar-area="${items[0].id}"]`);
    await page.waitForTimeout(200);
    const tituloForm = await page.$eval('#formTitulo', (el) => el.textContent);
    assert(/editar/i.test(tituloForm), 'Clicar em "Editar" deveria abrir o formulário em modo de edição');
});

test('Áreas de atuação: sem nenhuma cadastrada ainda, a lista não aparece', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirAreaAtuacao(page);
    const escondida = await page.locator('#areaAtuacaoCadastradasBlock').evaluate((el) => el.classList.contains('hidden'));
    assert(escondida, 'Sem áreas cadastradas, a lista não deveria aparecer');
});
