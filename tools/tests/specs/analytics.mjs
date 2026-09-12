/* ==========================================================================
   Regressão: Google Analytics (GA4) só roda com consentimento (issue #30),
   e esse consentimento agora BLOQUEIA o uso do app até ser aceito (issue
   de acessibilidade/conformidade posterior) — js/analytics.js e
   js/cookie-consent.js: sem ID real configurado, nada acontece (nenhum
   aviso, nenhum bloqueio); com ID configurado, um overlay bloqueia a
   página e o Analytics só carrega depois de "Aceitar" (não existe mais
   botão "Recusar" — sem aceitar, o bloqueio persiste, inclusive entre
   recargas); uma decisão "accepted" já salva pula direto pro resultado
   certo, sem bloquear de novo.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

test('Sem ID configurado, o Google Analytics não carrega nada e nenhum aviso de cookies aparece', async ({ page, baseUrl }) => {
    // Força o valor de exemplo (placeholder), simulando uma instância onde
    // ninguém configurou um ID de mensuração real — o padrão do repositório
    // (analyticsId em config.js) já vem com um ID real para a instância oficial.
    await page.addInitScript(() => { window.__LZ_TEST_ANALYTICS_ID = 'G-XXXXXXXXXX'; });
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const estado = await page.evaluate(() => ({
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
        gtag: typeof window.gtag,
        dataLayer: window.dataLayer,
        banner: !!document.querySelector('#lzCookieBanner'),
        overlay: !!document.querySelector('#lzCookieOverlay'),
    }));
    assert(!estado.script, 'Sem ID configurado (padrão de exemplo), nenhum script do gtag.js deveria ser injetado');
    assertEqual(estado.gtag, 'undefined', 'window.gtag não deveria existir sem um ID configurado');
    assert(!estado.dataLayer, 'window.dataLayer não deveria existir sem um ID configurado');
    assert(!estado.banner, 'Sem ID configurado, o aviso de cookies não deveria aparecer');
    assert(!estado.overlay, 'Sem ID configurado, o app não deveria ficar bloqueado por nenhum overlay');
});

test('Com ID configurado e sem decisão prévia, um overlay bloqueia o app e o Analytics só carrega após "Aceitar"', async ({ page, baseUrl }) => {
    const ID_TESTE = 'G-TEST12345';
    await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript((id) => { window.__LZ_TEST_ANALYTICS_ID = id; }, ID_TESTE);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const antes = await page.evaluate(() => ({
        banner: !!document.querySelector('#lzCookieBanner'),
        overlay: !!document.querySelector('#lzCookieOverlay'),
        temRecusar: !!document.querySelector('#lzCookieRecusar'),
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
    }));
    assert(antes.banner, 'Com ID configurado e sem decisão salva, o aviso de cookies deveria aparecer');
    assert(antes.overlay, 'Sem decisão, um overlay bloqueando a página deveria existir');
    assert(!antes.temRecusar, 'Não deveria mais existir botão de "Recusar" — só "Aceitar"');
    assert(!antes.script, 'Antes de aceitar, o Analytics não deveria carregar');

    // O overlay precisa de fato interceptar cliques no que está por trás
    // dele (não só existir visualmente) — clicar nas coordenadas de um
    // elemento coberto deve acertar o overlay, não o elemento.
    const bloqueado = await page.evaluate(() => {
        const el = document.elementFromPoint(5, 5);
        return el && el.id === 'lzCookieOverlay';
    });
    assert(bloqueado, 'O overlay deveria interceptar cliques no restante da página enquanto não aceito');

    await page.click('#lzCookieAceitar');
    await page.waitForTimeout(200);

    const depois = await page.evaluate(() => {
        const s = document.querySelector('script[src*="googletagmanager.com"]');
        return {
            src: s ? s.src : null, gtag: typeof window.gtag, dataLayer: Array.isArray(window.dataLayer),
            banner: !!document.querySelector('#lzCookieBanner'),
            overlay: !!document.querySelector('#lzCookieOverlay'),
            consentimento: localStorage.getItem('lz_cookie_consent'),
        };
    });
    assert(depois.src && depois.src.includes(encodeURIComponent(ID_TESTE)), `O script do gtag.js deveria referenciar o ID configurado — obtido "${depois.src}"`);
    assertEqual(depois.gtag, 'function', 'window.gtag deveria ter sido definido após aceitar');
    assert(depois.dataLayer, 'window.dataLayer deveria ter sido inicializado como array');
    assert(!depois.banner, 'O aviso de cookies deveria sumir após "Aceitar"');
    assert(!depois.overlay, 'O overlay de bloqueio deveria sumir após "Aceitar"');
    assertEqual(depois.consentimento, 'accepted', 'A decisão "accepted" deveria ficar salva em localStorage');
});

test('Sem aceitar (não há mais "Recusar"), o bloqueio persiste mesmo depois de recarregar a página', async ({ page, baseUrl }) => {
    const ID_TESTE = 'G-TEST12345';
    await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript((id) => { window.__LZ_TEST_ANALYTICS_ID = id; }, ID_TESTE);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    await page.reload();
    await page.waitForTimeout(400);
    const reload = await page.evaluate(() => ({
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
        banner: !!document.querySelector('#lzCookieBanner'),
        overlay: !!document.querySelector('#lzCookieOverlay'),
        consentimento: localStorage.getItem('lz_cookie_consent'),
    }));
    assert(!reload.script, 'Sem aceitar, o Analytics continua desligado numa nova carga');
    assert(reload.banner, 'Sem aceitar, o aviso de cookies deveria continuar aparecendo');
    assert(reload.overlay, 'Sem aceitar, o bloqueio deveria persistir entre recargas da página');
    assert(reload.consentimento !== 'accepted', 'Nenhuma decisão de aceite deveria ter sido salva');
});

test('Com consentimento já aceito anteriormente, o Analytics carrega direto, sem novo aviso', async ({ page, baseUrl }) => {
    const ID_TESTE = 'G-TEST12345';
    await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript((id) => {
        window.__LZ_TEST_ANALYTICS_ID = id;
        localStorage.setItem('lz_cookie_consent', 'accepted');
    }, ID_TESTE);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const estado = await page.evaluate(() => {
        const s = document.querySelector('script[src*="googletagmanager.com"]');
        return {
            src: s ? s.src : null,
            banner: !!document.querySelector('#lzCookieBanner'),
            overlay: !!document.querySelector('#lzCookieOverlay'),
        };
    });
    assert(estado.src && estado.src.includes(encodeURIComponent(ID_TESTE)), 'Com consentimento já aceito, o Analytics deveria carregar automaticamente');
    assert(!estado.banner, 'Com consentimento já decidido, o aviso de cookies não deveria aparecer');
    assert(!estado.overlay, 'Com consentimento já aceito, não deveria haver bloqueio');
});
