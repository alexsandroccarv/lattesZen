/* ==========================================================================
   Regressão: bloco de Visibilidade no formulário de item
   --------------------------------------------------------------------------
   Checkboxes compactos sob um rótulo "Publicar", sem título nem parágrafos
   explicativos: "Lattes" e "Web" sempre; "usar para RSC" só com o módulo RSC
   habilitado E o tipo elegível — mesmo checkbox #rscConta que antes vinha
   com o rótulo "Contabilizar este item no RSC-PCCTAE" dentro do bloco RSC
   (agora unificado aqui, os campos da camada RSC continuam em #rscBlock,
   abaixo). Cada checkbox mostra o mesmo ícone usado na aba Conformidade
   (fa-file-export/fa-globe/fa-award). Categorias 12+ ("Além do Lattes")
   mostram só "Web" (não são campos do Lattes). O eixo "Item visível
   (público) no Lattes" foi retirado da UI — nunca teve efeito fora daqui
   (não ia pro XML, não aparecia em nenhum outro lugar) — o campo continua
   sendo salvo como sempre "Público" internamente, sem controle na tela.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function habilitarRsc(page) {
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
}

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

test('Sem o módulo RSC habilitado, não aparece o checkbox "usar para RSC"', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Formação', 'Formação complementar');
    assertEqual(await page.locator('#visibilidadeBlock #rscConta').count(), 0, 'Sem RSC habilitado, "usar para RSC" não deveria existir');
});

test('Com o módulo RSC habilitado, "Publicar" ganha o 3º checkbox "usar para RSC" (com o ícone fa-award)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await habilitarRsc(page);
    await selectTipo(page, 'Formação', 'Formação complementar');
    const info = await page.evaluate(() => {
        const box = document.querySelector('#visibilidadeBlock');
        const labels = Array.from(box.querySelectorAll('label')).map((l) => l.textContent.trim());
        const rscLabel = Array.from(box.querySelectorAll('label')).find((l) => l.textContent.includes('usar para RSC'));
        return {
            qtdCheckbox: box.querySelectorAll('input[type=checkbox]').length,
            labels,
            rscConta: !!box.querySelector('#rscConta'),
            iconeLattes: !!box.querySelector('label i.fa-file-export'),
            iconeWeb: !!box.querySelector('label i.fa-globe'),
            iconeRsc: rscLabel ? !!rscLabel.querySelector('i.fa-award') : false,
        };
    });
    assertEqual(info.qtdCheckbox, 3, 'Com RSC habilitado (tipo elegível), deveria ter 3 checkboxes');
    assertEqual(info.labels, ['Lattes', 'Web', 'usar para RSC'], 'Textos dos 3 checkboxes, nesta ordem');
    assert(info.rscConta, 'O checkbox deveria ter o id "rscConta" (mesmo usado por collectRsc)');
    assert(info.iconeLattes, 'Checkbox "Lattes" deveria ter o ícone fa-file-export (mesmo da Conformidade)');
    assert(info.iconeWeb, 'Checkbox "Web" deveria ter o ícone fa-globe (mesmo da Conformidade)');
    assert(info.iconeRsc, 'Checkbox "usar para RSC" deveria ter o ícone fa-award (mesmo da Conformidade)');
});

test('Marcar "usar para RSC" mostra os campos da camada RSC logo abaixo (em #rscBlock)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await habilitarRsc(page);
    await selectTipo(page, 'Formação', 'Formação complementar');

    const escondidoAntes = await page.$eval('#rscFields', (el) => el.classList.contains('hidden'));
    assert(escondidoAntes, 'Campos do RSC deveriam começar escondidos (checkbox desmarcado)');

    await page.check('#rscConta');
    await page.waitForTimeout(150);
    const escondidoDepois = await page.$eval('#rscFields', (el) => el.classList.contains('hidden'));
    assert(!escondidoDepois, 'Marcar "usar para RSC" deveria mostrar os campos da camada RSC');
    assertEqual(await page.locator('#rscBlock label:has-text("Contabilizar")').count(), 0, 'O rótulo antigo "Contabilizar este item no RSC-PCCTAE" não deveria mais existir');
});
