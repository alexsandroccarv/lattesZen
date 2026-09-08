/* ==========================================================================
   Regressão: recarregar automaticamente quando um novo Service Worker assume
   o controle (issue #42) — sw.js já troca de controlador rápido
   (skipWaiting + clients.claim), mas isso só valia para requisições
   futuras; uma aba já aberta continuava rodando o JS antigo em memória
   (ex.: categorias 20/21 sumidas) até um recarregamento manual. Mocka
   navigator.serviceWorker (EventTarget simples) para simular os dois
   cenários sem depender do ciclo de vida real de um Service Worker, e
   observa se uma recarga de página de verdade acontece (evento "load").
   ========================================================================== */
import { test, assert } from '../harness.mjs';

async function mockServiceWorker(page, { comControladorPrevio }) {
    await page.addInitScript((jaTinha) => {
        const fake = new EventTarget();
        fake.controller = jaTinha ? {} : null;
        fake.register = async () => ({});
        Object.defineProperty(navigator, 'serviceWorker', { value: fake, configurable: true });
        window.__fakeSW = fake;
    }, comControladorPrevio);
}

test('Sem controlador anterior (1ª visita), controllerchange não recarrega a página sozinho', async ({ page, baseUrl }) => {
    await mockServiceWorker(page, { comControladorPrevio: false });
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);

    const reloadPromise = page.waitForEvent('load', { timeout: 1200 }).then(() => true).catch(() => false);
    await page.evaluate(() => window.__fakeSW.dispatchEvent(new Event('controllerchange'))).catch(() => {});
    const recarregou = await reloadPromise;
    assert(!recarregou, 'Na primeira instalação (sem controller prévio), não deveria recarregar sozinho');
});

test('Com controlador anterior (atualização), controllerchange recarrega a página automaticamente', async ({ page, baseUrl }) => {
    await mockServiceWorker(page, { comControladorPrevio: true });
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);

    // 2000ms era curto demais — numa janela de lentidão momentânea do runner
    // de CI (ver issue #109), um reload de página real pode legitimamente
    // levar mais que isso, e o teste falhava por timing, não por o mecanismo
    // ter quebrado (esse valor é passado explícito pra waitForEvent, então
    // ignora o setDefaultTimeout(60000) do harness).
    const reloadPromise = page.waitForEvent('load', { timeout: 10000 }).then(() => true).catch(() => false);
    await page.evaluate(() => window.__fakeSW.dispatchEvent(new Event('controllerchange'))).catch(() => {});
    const recarregou = await reloadPromise;
    assert(recarregou, 'Com um controller já ativo antes (nova versão assumindo), deveria recarregar automaticamente');
});
