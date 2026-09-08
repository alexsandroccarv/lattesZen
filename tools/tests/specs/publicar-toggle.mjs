/* ==========================================================================
   Regressão: checkbox "Habilitar aba Publicar na Web" em Configurações —
   mesmo mecanismo do módulo RSC (checkbox mostra/oculta a aba), com uma
   diferença de propósito: a aba Publicar já existia e ficava sempre visível
   antes deste toggle, então o padrão (sem nada salvo ainda) é HABILITADA —
   ao contrário do RSC, que sempre foi opt-in (padrão desabilitado). Sem
   isso, todo mundo que já usa o app hoje perderia a aba de uma hora pra
   outra só por causa da atualização.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Sem nada salvo ainda, a aba "Publicar na Web" continua visível por padrão (preserva o comportamento atual)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const visivel = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(visivel, 'A aba Publicar deveria estar visível por padrão, sem precisar habilitar nada');
});

test('Configurações tem o checkbox "Habilitar aba Publicar na Web", marcado por padrão', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    assertEqual(await page.locator('#pubWebEnable').count(), 1, 'O checkbox deveria existir em Configurações');
    const marcado = await page.isChecked('#pubWebEnable');
    assert(marcado, 'O checkbox deveria vir marcado por padrão (aba já habilitada)');
});

test('Desmarcar o checkbox oculta a aba "Publicar na Web" na hora; marcar de novo a traz de volta', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    await page.click('#pubWebEnable'); // desmarca
    await page.waitForTimeout(150);
    const escondida = await page.evaluate(() => document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(escondida, 'Desmarcar o checkbox deveria esconder a aba Publicar imediatamente');
    const toasts1 = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts1.some((t) => /desabilitada/i.test(t)), 'Deveria confirmar que a aba foi desabilitada');
    const salvoDesabilitado = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').pubWebEnabled);
    assertEqual(salvoDesabilitado, false, 'pubWebEnabled: false deveria estar salvo em Configurações');

    await page.click('#pubWebEnable'); // marca de novo
    await page.waitForTimeout(150);
    const visivelDeNovo = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(visivelDeNovo, 'Marcar o checkbox de novo deveria trazer a aba de volta imediatamente');
});

test('Desabilitar e recarregar a página: a aba continua oculta (persiste entre sessões)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#pubWebEnable');
    await page.waitForTimeout(150);

    await page.reload();
    await page.waitForTimeout(500);
    const escondida = await page.evaluate(() => document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(escondida, 'Depois de recarregar, a aba Publicar deveria continuar oculta (preferência persistida)');
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    const marcado = await page.isChecked('#pubWebEnable');
    assert(!marcado, 'O checkbox também deveria continuar desmarcado depois de recarregar');
});
