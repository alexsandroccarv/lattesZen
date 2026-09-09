/* ==========================================================================
   Regressão: reorganização do topo da aba Conformidade — 4 seções na ordem
   Conformidade (barras) → Pendências (chips) → RSC (se habilitado) → Itens.
   --------------------------------------------------------------------------
   - "Comprovados", "Não-Lattes", "Exportar p/ Lattes: não" e "Publicar na
     Web: não" pararam de ter quadro/chip — só o ícone por item continua.
   - "Sem evidência" e "Descrição obrigatória" (antigos cartões) viraram
     chips dentro de "Pendências", junto com os demais.
   - Em "Itens", só a lista (#itemList) fica num <details> que começa
     recolhido e abre sozinho ao filtrar — título/contagem/controles
     (ordenar, buscar, expandir/recolher, imprimir) continuam sempre visíveis.
   ========================================================================== */
import { test, assert, makeItem, seedCatalog } from '../harness.mjs';

test('Seções da Conformidade aparecem na ordem certa (Conformidade → Pendências → RSC → Itens)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    const titulos = await page.$$eval('#tab-conformidade > div', (els) =>
        els.map((el) => { const h = el.querySelector('h3, h2'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; }));
    assert(titulos[0].includes('Conformidade'), `1ª seção deveria ser "Conformidade" — obtido: ${titulos[0]}`);
    assert(titulos[1].includes('Pendências'), `2ª seção deveria ser "Pendências" — obtido: ${titulos[1]}`);
    assert(titulos[2].includes('RSC'), `3ª seção deveria ser o quadro do RSC — obtido: ${titulos[2]}`);
    assert(titulos[3].includes('Itens'), `4ª seção deveria ser "Itens" — obtido: ${titulos[3]}`);
});

test('"Comprovados", "Não-Lattes", "Exportar p/ Lattes: não" e "Publicar na Web: não" não têm mais quadro/chip', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso X', instituicao: 'X' }, { lattesItem: false }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    for (const key of ['comprovados', 'naoLattes', 'exportLattesNao', 'pubWebNao']) {
        const existeFora = await page.evaluate((k) => {
            // Só os 3 primeiros quadros (Conformidade/Pendências/RSC) — o
            // último filho de #tab-conformidade é o wrapper de "Itens", que
            // legitimamente contém o ícone por item dentro de #itemList.
            const boxes = Array.from(document.querySelectorAll('#tab-conformidade > div')).slice(0, -1);
            return boxes.some((box) => box.querySelector(`[data-view="${k}"]`));
        }, key);
        assert(!existeFora, `"${key}" não deveria mais ter quadro/chip fora de "Itens"`);
    }
});

test('"Sem evidência" e "Descrição obrigatória" viraram chips dentro de "Pendências"', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Sem Nada' }, { lattesItem: true, hasPdf: false }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    const temSemPdf = await page.evaluate(() => !!document.querySelector('#outrasPendenciasBox [data-view="semPdf"]'));
    const temDescObrig = await page.evaluate(() => !!document.querySelector('#outrasPendenciasBox [data-view="descObrig"]'));
    assert(temSemPdf, 'Chip "Sem evidência" deveria estar dentro de "Pendências"');
    assert(temDescObrig, 'Chip "Descrição obrigatória" deveria estar dentro de "Pendências"');
});

test('"Itens" começa recolhida e abre sozinha ao clicar num chip de filtro', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Sem CH', instituicao: 'X' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Com CH', instituicao: 'X', cargaHoraria: '40' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    const abertoAntes = await page.$eval('#itensSection', (el) => el.open);
    assert(!abertoAntes, '"Itens" deveria começar recolhida');

    await page.click('#tab-conformidade [data-view="chVermelho"]');
    await page.waitForTimeout(200);
    const abertoDepois = await page.$eval('#itensSection', (el) => el.open);
    assert(abertoDepois, '"Itens" deveria abrir sozinha ao filtrar por um chip');
});

test('"Imprimir / PDF" abre "Itens" antes de chamar a impressão (senão a lista some do impresso)', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Y', instituicao: 'X' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.print = () => {}; }); // não dispara o diálogo nativo de impressão no teste
    assert(!(await page.$eval('#itensSection', (el) => el.open)), 'Pré-condição: "Itens" deveria começar fechada');

    // O botão "Imprimir / PDF" fica FORA do <details> de "Itens" (controles
    // sempre visíveis) — clicável mesmo com a lista ainda recolhida.
    await page.click('#btnImprimir');
    await page.waitForTimeout(100);
    assert(await page.$eval('#itensSection', (el) => el.open), '"Itens" deveria abrir ao clicar em "Imprimir / PDF"');
});
