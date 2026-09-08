/* ==========================================================================
   Regressão: bloco de Visibilidade no formulário de item
   --------------------------------------------------------------------------
   Deve ser só 2 checkboxes compactos ("Lattes", "Web") sob um rótulo
   "Publicar", sem título nem parágrafos explicativos — e categorias 12+
   ("Além do Lattes") devem mostrar só o checkbox "Web" (não são campos do
   Lattes). O 3º eixo que existia ("Item visível (público) no Lattes") foi
   retirado da UI — nunca teve efeito fora daqui (não ia pro XML, não
   aparecia em nenhum outro lugar) — o campo continua sendo salvo como
   sempre "Público" internamente, sem controle na tela.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function selectTipo(page, catText, tipoText) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel, t) => Array.from(sel.options).find((o) => o.textContent.includes(t)).value, catText);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel, t) => Array.from(sel.options).find((o) => o.textContent.includes(t)).value, tipoText);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('Bloco de Visibilidade: "Publicar" + 2 checkboxes compactos (Lattes/Web), sem título/descrições', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Formação', 'Formação complementar');
    const info = await page.evaluate(() => {
        const box = document.querySelector('#visibilidadeBlock');
        return {
            qtdCheckbox: box.querySelectorAll('input[type=checkbox]').length,
            temDescricoes: /Desmarque|Só anotação/.test(box.textContent),
            temRotuloPublicar: /Publicar/.test(box.textContent),
            labels: Array.from(box.querySelectorAll('label')).map((l) => l.textContent.trim()),
        };
    });
    assertEqual(info.qtdCheckbox, 2, 'Deveria ter exatamente 2 checkboxes (Lattes e Web)');
    assertEqual(info.temDescricoes, false, 'Não deveria ter parágrafos explicativos antigos');
    assert(info.temRotuloPublicar, 'Deveria ter o rótulo "Publicar" antes dos checkboxes');
    assertEqual(info.labels, ['Lattes', 'Web'], 'Textos dos checkboxes');
});

test('Categoria 12+ ("Além do Lattes") só mostra o checkbox "Web"', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Desenvolvimento Pessoal', 'Cursos livres');
    const info = await page.evaluate(() => {
        const box = document.querySelector('#visibilidadeBlock');
        return {
            qtdCheckbox: box.querySelectorAll('input[type=checkbox]').length,
            temExportar: !!box.querySelector('#visExportarLattes'),
            temPublicar: !!box.querySelector('#visPublicarWeb'),
        };
    });
    assertEqual(info, { qtdCheckbox: 1, temExportar: false, temPublicar: true }, 'Categoria 12+ deveria mostrar só o checkbox "Web"');
});

test('"visivelNoLattes" é sempre salvo como "Público" (sem controle na UI)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Formação', 'Formação complementar');
    assertEqual(await page.locator('#visVisivelLattes').count(), 0, 'O checkbox antigo "Item visível" não deveria mais existir');

    await page.fill('[name="titulo"]', 'Curso Teste Visibilidade');
    await page.fill('[name="instituicao"]', 'Instituto X');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);
    const salvo = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.fields && i.fields.titulo === 'Curso Teste Visibilidade');
        return it ? it.visibilidade : null;
    });
    assertEqual(salvo && salvo.visivelNoLattes, 'Público', 'visivelNoLattes deveria continuar sendo salvo como "Público"');
});
