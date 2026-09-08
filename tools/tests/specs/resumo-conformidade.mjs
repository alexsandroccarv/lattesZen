/* ==========================================================================
   Regressão: resumo agregado no topo da aba Conformidade
   --------------------------------------------------------------------------
   Issue #1 — cartões/chips clicáveis mostrando contagens por estado (carga
   horária, exportar Lattes, publicar na Web, e — com o módulo de RSC
   habilitado — RSC fora do período), reaproveitando o mesmo VIEW_PREDICATE/
   VIEW_META usado pelos ícones de status por item.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function clickChip(page, key) {
    await page.click(`#tab-conformidade [data-view="${key}"]`);
    await page.waitForTimeout(200);
}
async function itemCount(page) { return page.$eval('#itemCount', (el) => el.textContent.trim()); }

test('Chip "Outras pendências" (sem carga horária) filtra corretamente', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Sem CH', instituicao: 'X' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Com CH', instituicao: 'X', cargaHoraria: '40' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    const temChip = await page.evaluate(() => !!document.querySelector('#tab-conformidade [data-view="chVermelho"]'));
    assert(temChip, 'Deveria existir o chip "Sem carga horária" no resumo de Outras pendências');

    await clickChip(page, 'chVermelho');
    assertEqual(await itemCount(page), '(1 de 2)', 'Filtrar pelo chip deveria mostrar só o item sem carga horária');
    const visivel = await page.evaluate(() => document.querySelector('#itemList').textContent);
    assert(visivel.includes('Curso Sem CH') && !visivel.includes('Curso Com CH'), 'Deveria mostrar só "Curso Sem CH"');
});

test('"Publicar na Web: não" não tem mais chip em "Outras pendências", mas o ícone por item continua filtrando', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Publicado', instituicao: 'X' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Nao Publicado', instituicao: 'X' },
            { visibilidade: { exportarLattes: true, visivelNoLattes: 'Público', publicarWeb: false } }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    // "Exportar p/ Lattes: não" e "Publicar na Web: não" deixaram de ser chip
    // no resumo (eram estado deliberado do usuário, não uma pendência de
    // dado) — só o ícone no card de cada item continua existindo.
    const temChipNoResumo = await page.evaluate(() => !!document.querySelector('#outrasPendenciasBox [data-view="pubWebNao"]'));
    assert(!temChipNoResumo, '"Publicar na Web: não" não deveria mais aparecer como chip em "Outras pendências"');
    const temChipExportNoResumo = await page.evaluate(() => !!document.querySelector('#outrasPendenciasBox [data-view="exportLattesNao"]'));
    assert(!temChipExportNoResumo, '"Exportar p/ Lattes: não" também não deveria mais aparecer como chip em "Outras pendências"');

    await clickChip(page, 'pubWebNao'); // clica no ícone do próprio item (só ele tem esse data-view agora)
    assertEqual(await itemCount(page), '(1 de 2)', 'Filtrar pelo ícone "Publicar na Web: não" deveria mostrar 1 item');
    const visivel = await page.evaluate(() => document.querySelector('#itemList').textContent);
    assert(visivel.includes('Curso Nao Publicado') && !visivel.includes('Curso Publicado'), 'Deveria mostrar só o item não publicado');
});

test('Com RSC habilitado, o chip "RSC fora do período" aparece no quadro do RSC', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    // Habilita o módulo RSC diretamente via settings (mesma chave usada pelo app).
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    const temChipRsc = await page.evaluate(() => !!document.querySelector('#tab-conformidade [data-view="rscForaPeriodo"]'));
    assert(temChipRsc, 'Com o módulo RSC habilitado, o quadro do RSC deveria ter o chip "RSC fora do período"');
});
