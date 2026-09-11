/* ==========================================================================
   Regressão: campos com checkbox "N/A" (Não se aplica)
   --------------------------------------------------------------------------
   - Carga horária (numérico) marcada N/A não pode travar a validação de
     número ao salvar (bug: validateItemFields só pulava a checagem de
     formato quando `f.na` existia; campos numéricos comuns não tinham essa
     flag e caíam na checagem de "número ≥ 0" com o valor "Não se aplica").
   - URL marcada N/A não pode virar "https://Não se aplica" ao salvar (bug:
     o mesmo guard de N/A não cobria campos type:'url', que sempre oferecem
     N/A independente da flag `f.na` — o valor caía na validação de URL, que
     prefixa "https://" incondicionalmente).
   - Esquemas de URL além de http(s) (ftp://, magnet:) devem ser preservados
     como digitados, não forçados para https://.
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
async function savedFieldFor(page, titulo, campo) {
    return page.evaluate(({ t, c }) => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.fields && i.fields.titulo === t);
        return it ? it.fields[c] : undefined;
    }, { t: titulo, c: campo });
}

test('N/A em carga horária (numérico) não trava o salvamento', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Formação', 'Formação complementar');
    await page.fill('[name="titulo"]', 'Curso CH NA Teste');
    await page.fill('[name="instituicao"]', 'Instituto X');
    await page.check('[data-na="cargaHoraria"]');
    await page.waitForTimeout(150);
    const campo = await page.$eval('[name="cargaHoraria"]', (el) => ({ value: el.value, disabled: el.disabled }));
    assertEqual(campo, { value: '', disabled: true }, 'Campo logo após marcar N/A');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);
    const salvo = await savedFieldFor(page, 'Curso CH NA Teste', 'cargaHoraria');
    assertEqual(salvo, 'Não se aplica', 'Valor salvo de carga horária com N/A marcado');
});

test('N/A em URL não vira "https://Não se aplica" ao salvar', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Produções', 'Artigos completos publicados em periódicos');
    await page.fill('[name="titulo"]', 'Artigo URL NA Teste');
    await page.fill('[name="periodico"]', 'Revista X');
    await page.fill('[name="ano"]', '01/01/2024');
    await page.check('[data-na="url"]');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);
    const salvo = await savedFieldFor(page, 'Artigo URL NA Teste', 'url');
    assertEqual(salvo, 'Não se aplica', 'Valor salvo de URL com N/A marcado (não deve virar "https://Não se aplica")');
});

test('N/A em Instituição promotora (Editoração) não trava o salvamento', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Produções', 'Editoração');
    await page.fill('[name="titulo"]', 'Anais NA Teste');
    await page.fill('[name="ano"]', '2020');
    await page.check('[data-na="instituicao"]');
    await page.waitForTimeout(150);
    const campo = await page.$eval('[name="instituicao"]', (el) => ({ value: el.value, disabled: el.disabled }));
    assertEqual(campo, { value: '', disabled: true }, 'Campo logo após marcar N/A');

    await page.fill('[name="editora"]', 'Editora Independente');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);
    const salvo = await savedFieldFor(page, 'Anais NA Teste', 'instituicao');
    assertEqual(salvo, 'Não se aplica', 'Valor salvo de Instituição promotora com N/A marcado');
});

test('Esquemas de URL além de http(s) são preservados (ftp, magnet)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    async function salvarComUrl(titulo, url) {
        await selectTipo(page, 'Produções', 'Artigos completos publicados em periódicos');
        await page.fill('[name="titulo"]', titulo);
        await page.fill('[name="periodico"]', 'Revista Y');
        await page.fill('[name="ano"]', '01/01/2024');
        await page.fill('[name="url"]', url);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(350);
        return savedFieldFor(page, titulo, 'url');
    }

    assertEqual(await salvarComUrl('Artigo FTP', 'ftp://algo.com/arquivo.zip'), 'ftp://algo.com/arquivo.zip', 'URL ftp://');
    assertEqual(await salvarComUrl('Artigo Magnet', 'magnet:?xt=urn:btih:abc123'), 'magnet:?xt=urn:btih:abc123', 'URL magnet:');
    assertEqual(await salvarComUrl('Artigo Sem Esquema', 'algo.com/pagina'), 'https://algo.com/pagina', 'URL sem esquema (deve ganhar https://)');
});
