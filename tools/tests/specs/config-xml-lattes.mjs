/* ==========================================================================
   Regressão: seção "Currículo Lattes (XML)" em Configurações
   --------------------------------------------------------------------------
   - O aviso de consistência ("Para manter a consistência...") não é mais
     exibido nesta seção (o texto ficava redundante/alarmante para quem só
     quer importar uma vez).
   - A sub-seção "Importar" (h3 + parágrafo + input de arquivo) fica oculta
     por ora (feature ainda não retomada), mas continua no DOM — nada foi
     excluído, só escondido via atributo `hidden` — para religar bastando
     trocar IMPORT_XML_VISIVEL para true em tab-config.js.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirConfig(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('Aviso de consistência não aparece mais na seção Currículo Lattes (XML)', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const secaoTexto = await page.$eval('#importXmlSection', (el) => el.textContent);
    assert(!secaoTexto.includes('Para manter a consistência'), 'O aviso de consistência não deveria mais aparecer na seção');
    assert(!secaoTexto.includes('muda o identificador dele e pode gerar'), 'O texto completo do aviso não deveria mais aparecer');
});

test('Sub-seção "Importar" fica oculta mas continua no DOM (não foi excluída)', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const bloco = await page.$('#importXmlBloco');
    assert(bloco, 'O bloco de importação deveria continuar existindo no DOM');
    const oculto = await page.$eval('#importXmlBloco', (el) => el.hidden);
    assert(oculto, 'O bloco de importação deveria estar oculto (hidden)');

    const inputExiste = await page.$('#xmlInput');
    assert(inputExiste, 'O input de arquivo XML deveria continuar existindo (lógica preservada)');

    const secao = await page.$eval('#importXmlSection', (el) => el.textContent);
    assert(secao.includes('Exportar'), 'A sub-seção "Exportar" deveria continuar visível normalmente');
});
