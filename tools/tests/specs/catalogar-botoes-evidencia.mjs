/* ==========================================================================
   Regressão: tamanho dos botões de evidência em Catalogar
   --------------------------------------------------------------------------
   Os 4 botões de anexar evidência (Bandeja de entrada, Buscar arquivos, Link
   e Google Drive) foram aumentados em 50% (de 48px/w-12 h-12 para 72px).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirCatalogar(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
}

test('Botões de evidência em Catalogar estão 50% maiores (72px)', async ({ page, baseUrl }) => {
    await abrirCatalogar(page, baseUrl);
    for (const id of ['btnEvInbox', 'btnEvFiles', 'btnEvUrl', 'btnEvDrive']) {
        const cls = await page.$eval('#' + id, (el) => el.className);
        assert(cls.includes('w-[72px]') && cls.includes('h-[72px]'), `#${id} deveria ter as classes w-[72px] h-[72px] — obtido: ${cls}`);
    }
});
