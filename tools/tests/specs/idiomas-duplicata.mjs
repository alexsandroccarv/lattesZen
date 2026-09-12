/* ==========================================================================
   Regressão: "1. Dados gerais" › Idiomas — não permite cadastrar o mesmo
   idioma duas vezes, e mostra os idiomas já cadastrados (com link de
   edição) entre a seleção do tipo e o formulário de cadastro. Cobre também
   a observação sobre onde cadastrar evidência de cursos/certificados de
   proficiência, exibida no formulário de Catalogar (qualquer tipo).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirIdiomas(page) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'IDIOMAS');
    await page.waitForTimeout(150);
}

test('Idiomas: o seletor não oferece um idioma já cadastrado em outro item', async ({ page, baseUrl }) => {
    const items = [makeItem('IDIOMAS', 'DADOS_GERAIS', { titulo: 'Inglês' })];
    await seedCatalog(page, baseUrl, items);
    await abrirIdiomas(page);

    const opcoes = await page.$eval('#dynFields select[name="titulo"]', (sel) => Array.from(sel.options).map((o) => o.value));
    assert(!opcoes.includes('Inglês'), 'O seletor de idioma não deveria oferecer "Inglês" (já cadastrado)');
    assert(opcoes.includes('Espanhol'), 'O seletor de idioma deveria continuar oferecendo idiomas ainda não cadastrados');
});

test('Idiomas: editar um item mantém o próprio idioma disponível no seletor (não se auto-exclui)', async ({ page, baseUrl }) => {
    const items = [makeItem('IDIOMAS', 'DADOS_GERAIS', { titulo: 'Inglês' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.AppCore.buildForm(window.AppCore.state.items[0]));
    await page.waitForTimeout(200);

    const opcoes = await page.$eval('#dynFields select[name="titulo"]', (sel) => Array.from(sel.options).map((o) => o.value));
    assert(opcoes.includes('Inglês'), 'Editando o próprio item, o idioma atual dele deveria continuar no seletor');
    const selecionado = await page.locator('#dynFields select[name="titulo"]').inputValue();
    assertEqual(selecionado, 'Inglês', 'O idioma do item em edição deveria vir pré-selecionado');
});

test('Idiomas: tentar salvar um idioma já cadastrado em outro item é bloqueado, sem opção de "mesmo assim"', async ({ page, baseUrl }) => {
    const items = [makeItem('IDIOMAS', 'DADOS_GERAIS', { titulo: 'Inglês' })];
    await seedCatalog(page, baseUrl, items);
    await abrirIdiomas(page);
    // Contorna o filtro do próprio seletor (adiciona a opção de volta) para
    // simular alguém tentando salvar mesmo assim — ex.: um <select> com
    // estado desatualizado por qualquer motivo. O bloqueio ao salvar
    // (onSubmitForm) é o backstop, independente do filtro do seletor.
    await page.evaluate(() => {
        const sel = document.querySelector('#dynFields select[name="titulo"]');
        const opt = document.createElement('option');
        opt.value = 'Inglês'; opt.textContent = 'Inglês';
        sel.appendChild(opt);
    });
    await page.selectOption('#dynFields select[name="titulo"]', 'Inglês');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(200);

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /já está cadastrado/i.test(t)), 'Deveria avisar que o idioma já está cadastrado, sem salvar');
    const total = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').filter((i) => i.typeKey === 'IDIOMAS').length);
    assertEqual(total, 1, 'Não deveria ter criado um segundo item de Idiomas com "Inglês"');
});

test('Idiomas: lista "Idiomas já cadastrados" aparece entre a seleção do tipo e o formulário, com link de edição', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDIOMAS', 'DADOS_GERAIS', { titulo: 'Inglês' }),
        makeItem('IDIOMAS', 'DADOS_GERAIS', { titulo: 'Espanhol' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirIdiomas(page);

    const bloco = page.locator('#idiomasCadastradosBlock');
    assert(!(await bloco.evaluate((el) => el.classList.contains('hidden'))), 'A lista de idiomas já cadastrados deveria aparecer para o tipo Idiomas');
    const texto = await bloco.innerText();
    assert(texto.includes('Inglês') && texto.includes('Espanhol'), 'A lista deveria mostrar os 2 idiomas já cadastrados');

    // Ordem no DOM: depois da seção de seleção do tipo (#tipoWrap), antes do
    // formulário de cadastro do idioma (#dynFields).
    const ordem = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('#tipoWrap, #idiomasCadastradosBlock, #dynFields'));
        return all.map((el) => el.id);
    });
    assertEqual(ordem, ['tipoWrap', 'idiomasCadastradosBlock', 'dynFields'], 'A lista deveria ficar entre a seleção do tipo e o formulário de cadastro');

    const idiomaInglês = items[0];
    await page.click(`[data-editar-idioma="${idiomaInglês.id}"]`);
    await page.waitForTimeout(200);
    const tituloForm = await page.$eval('#formTitulo', (el) => el.textContent);
    assert(/editar/i.test(tituloForm), 'Clicar em "Editar" deveria abrir o formulário em modo de edição');
    const selecionado = await page.locator('#dynFields select[name="titulo"]').inputValue();
    assertEqual(selecionado, 'Inglês', 'Deveria abrir o item de "Inglês" clicado na lista');
});

test('Idiomas: sem nenhum idioma cadastrado ainda, a lista não aparece', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirIdiomas(page);
    const escondida = await page.locator('#idiomasCadastradosBlock').evaluate((el) => el.classList.contains('hidden'));
    assert(escondida, 'Sem idiomas cadastrados, a lista não deveria aparecer');
});

test('Catalogar: observação sobre cursos (Formação complementar) e certificados de proficiência (Certificações) aparece SÓ em Idiomas, entre Publicar e Anotações gerais', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirIdiomas(page);

    const obs = page.locator('#idiomasObsEvidencia');
    assert(!(await obs.evaluate((el) => el.classList.contains('hidden'))), 'Em Idiomas, a observação deveria estar visível');

    const ordem = await page.evaluate(() => {
        const panel = document.querySelector('#camposPanel');
        const html = panel.innerHTML;
        return { idxViz: html.indexOf('id="visibilidadeBlock"'), idxObs: html.indexOf('id="idiomasObsEvidencia"'), idxNotas: html.indexOf('id="notasGerais"') };
    });
    assert(ordem.idxViz > -1 && ordem.idxObs > -1 && ordem.idxNotas > -1, 'Deveria haver o bloco de Publicar, a observação e o campo de Anotações gerais');
    assert(ordem.idxViz < ordem.idxObs && ordem.idxObs < ordem.idxNotas, 'A observação deveria ficar entre "Publicar" e "Anotações gerais"');

    const texto = await page.$eval('#camposPanel', (el) => el.textContent);
    assert(/02 Formação.*Formação complementar/.test(texto.replace(/\s+/g, ' ')), 'Deveria orientar a usar "02 Formação → Formação complementar" para cursos');
    assert(/16 Certificações/.test(texto), 'Deveria orientar a usar "16 Certificações" para certificados de proficiência');
});

test('Catalogar: observação sobre cursos/certificações NÃO aparece em outros tipos (ex.: Prêmios)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'PREMIO');
    await page.waitForTimeout(150);

    const obs = page.locator('#idiomasObsEvidencia');
    assert(await obs.evaluate((el) => el.classList.contains('hidden')), 'Fora de Idiomas, a observação não deveria aparecer');
});
