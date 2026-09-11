/* ==========================================================================
   Regressão: aba Início (onboarding)
   --------------------------------------------------------------------------
   Segunda aba extraída de app.js (tab-inicio.js) — não existia cobertura
   antes. Cobre os 3 botões de "Primeiros passos": navegar para Catalogar e
   ir para as duas seções de Configurações (pasta e importar XML).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirInicio(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
}
function abaAtiva(page) {
    return page.evaluate(() => document.querySelector('.tab-btn[aria-selected="true"]').dataset.tab);
}

test('Início é a aba mostrada ao abrir o app', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    assertEqual(await abaAtiva(page), 'inicio', 'A aba Início deveria estar selecionada ao carregar o app');
    const titulo = await page.$eval('#tab-inicio h2', (el) => el.textContent);
    assertEqual(titulo, 'lattesZen', 'O título de apresentação deveria estar na tela');
});

test('"Ir para Catalogar" troca para a aba Catalogar', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    await page.click('#btnInicioCatalogar');
    await page.waitForTimeout(200);
    assertEqual(await abaAtiva(page), 'catalogar', 'Deveria ter trocado para a aba Catalogar');
});

test('"Ir para Configurações" (pasta) troca para Configurações e rola até a seção de diretório', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    await page.click('#btnInicioDir');
    await page.waitForTimeout(300);
    assertEqual(await abaAtiva(page), 'config', 'Deveria ter trocado para a aba Configurações');
    const existeSecao = await page.$('#dirSection');
    assert(existeSecao, 'A seção de diretório deveria existir na tela de Configurações');
});

test('"Importar XML do Lattes" troca para Configurações e rola até a seção de importação', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    await page.click('#btnInicioImportar');
    await page.waitForTimeout(300);
    assertEqual(await abaAtiva(page), 'config', 'Deveria ter trocado para a aba Configurações');
    const existeSecao = await page.$('#importXmlSection');
    assert(existeSecao, 'A seção de importação de XML deveria existir na tela de Configurações');
});

test('Seção "Como citar" mostra a referência completa e o botão de copiar funciona', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    const citacao = await page.$eval('#tab-inicio blockquote', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    assert(citacao.includes('CARVALHO, Alexsandro Cardoso'), 'Citação deveria conter o autor');
    assert(citacao.includes('LattesZen: descomplicando o currículo Acadêmico'), 'Citação deveria conter o título');
    assert(citacao.includes('Versão 0.7.02'), 'Citação deveria conter a versão citada');
    assert(citacao.includes('Santos: Github, 2016'), 'Citação deveria conter local/editora/ano');
    const hrefDoi = await page.$eval('#tab-inicio blockquote a', (el) => el.getAttribute('href'));
    assertEqual(hrefDoi, 'https://zenodo.org/records/22346453', 'Link do DOI deveria apontar para o Zenodo');

    await page.context().grantPermissions(['clipboard-write', 'clipboard-read'], { origin: baseUrl });
    await page.click('#btnCopiarCitacao');
    await page.waitForTimeout(100);
    const textoBotao = await page.$eval('#btnCopiarCitacao', (el) => el.textContent.trim());
    assert(textoBotao.includes('Copiado'), 'Botão deveria mostrar confirmação de cópia');
});
