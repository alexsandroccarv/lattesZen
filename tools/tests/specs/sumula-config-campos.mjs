/* ==========================================================================
   Regressão: módulo Súmula Curricular FAPESP (issue #8) — mesmo padrão do
   RSC (tab-config.js só tem o "Habilitar módulo"; os links específicos da
   Súmula moram na própria aba, que só aparece quando o módulo é habilitado).
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Configurações → Súmula FAPESP só tem o "Habilitar módulo" — os links moram na aba Súmula FAPESP', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    assertEqual(await page.locator('#sumulaEnable').count(), 1, 'O checkbox "Habilitar módulo Súmula Curricular FAPESP" deveria existir em Configurações');
    assertEqual(await page.locator('#sumula-linkLattes').count(), 0, 'O campo de link do Lattes não deveria estar em Configurações');

    await page.click('#sumulaEnable');
    await page.waitForTimeout(200);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /módulo súmula curricular fapesp habilitado/i.test(t)), 'Marcar o checkbox deveria habilitar e salvar na hora (sem precisar de botão "Salvar")');

    const habilitado = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').sumulaEnabled);
    assert(habilitado === true, 'sumulaEnabled deveria estar salvo em Configurações');
});

test('Aba "Súmula FAPESP" só aparece na navegação quando o módulo está habilitado', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const escondida = await page.evaluate(() => document.querySelector('.tab-btn[data-tab="sumula"]').classList.contains('hidden'));
    assert(escondida, 'A aba "Súmula FAPESP" deveria começar escondida (módulo desabilitado por padrão)');

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#sumulaEnable');
    await page.waitForTimeout(200);
    const visivel = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="sumula"]').classList.contains('hidden'));
    assert(visivel, 'Habilitar o módulo deveria mostrar a aba "Súmula FAPESP" na navegação');
});

test('Súmula FAPESP: os links (Lattes/Web of Science/Google Scholar) salvam em settings.sumula', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#sumulaEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(200);

    await page.fill('#sumula-linkLattes', 'http://lattes.cnpq.br/1234567890');
    await page.fill('#sumula-linkWebOfScience', 'https://www.webofscience.com/wos/author/rid/A-1234-2020');
    await page.fill('#sumula-linkGoogleScholar', 'https://scholar.google.com/citations?user=abc123');
    await page.click('#btnSaveSumulaCfg');
    await page.waitForTimeout(200);

    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').sumula || {});
    assertEqual(cfg.linkLattes, 'http://lattes.cnpq.br/1234567890', 'Link do Lattes deveria ser salvo');
    assertEqual(cfg.linkWebOfScience, 'https://www.webofscience.com/wos/author/rid/A-1234-2020', 'Link do Web of Science deveria ser salvo');
    assertEqual(cfg.linkGoogleScholar, 'https://scholar.google.com/citations?user=abc123', 'Link do Google Scholar deveria ser salvo');
});

test('"Limpar catálogo" também zera a configuração e o texto da Súmula FAPESP', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.sumulaEnabled = true;
        s.sumula = { linkLattes: 'http://lattes.cnpq.br/1234567890' };
        s.sumulaTexto = 'Texto de teste';
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    // O harness já aceita diálogos nativos (confirm()) automaticamente — ver
    // page.on('dialog', ...) em harness.mjs; registrar outro handler aqui
    // corre com aquele e derruba o processo ("dialog already handled").
    await page.click('#btnClear');
    await page.waitForTimeout(200);

    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}'));
    assertEqual(s.sumula, {}, 'A configuração da Súmula FAPESP deveria ser zerada por "Limpar catálogo"');
    assertEqual(s.sumulaTexto, '', 'O texto da Súmula FAPESP deveria ser zerado por "Limpar catálogo"');
});
