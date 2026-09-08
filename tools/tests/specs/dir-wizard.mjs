/* ==========================================================================
   Regressão: assistente guiado de "Diretório de armazenamento"
   --------------------------------------------------------------------------
   Sem nenhum diretório configurado ainda, a seção "Diretório de arquivos"
   (renomeada "Diretório de armazenamento") deixa de mostrar uma parede fixa
   de botões e passa a perguntar, em 2 passos, o que o usuário quer fazer:
   "Primeira configuração" ou "Já tenho um diretório" > "Pasta no
   computador" ou "Google Drive" — só então mostra a ação certa (com
   "Sincronizar"/"Migrar" só fazendo sentido no caminho "já tenho"). Com um
   diretório já ativo, a seção volta a mostrar o painel de estado direto
   (como sempre foi), sem o assistente.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function abrirConfig(page, baseUrl) {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('Sem diretório configurado, a seção "Diretório de armazenamento" mostra o assistente (não a parede de botões antiga)', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);

    const texto = await page.$eval('#dirSection', (el) => el.textContent);
    assert(texto.includes('Diretório de armazenamento'), 'A seção deveria se chamar "Diretório de armazenamento"');
    assert(texto.includes('Primeira configuração') && texto.includes('Já tenho um diretório'), 'Deveria perguntar primeira configuração ou já tenho um diretório');

    assertEqual(await page.locator('#btnChooseDir').count(), 0, 'Sem escolher um caminho no assistente ainda, "Escolher pasta" não deveria aparecer');
    assertEqual(await page.locator('#btnGDriveConnect').count(), 0, 'Sem escolher um caminho no assistente ainda, "Conectar ao Google Drive" não deveria aparecer');

    // Prefixo do identificador é o 1º passo do assistente, antes da pergunta
    // "Primeira configuração ou já tenho um diretório".
    assertEqual(await page.locator('#idPrefix').count(), 1, 'O campo de prefixo deveria fazer parte do assistente');
    const ordem = await page.evaluate(() => {
        const sec = document.querySelector('#dirSection');
        const html = sec.innerHTML;
        return html.indexOf('Prefixo do identificador') < html.indexOf('Primeira configuração');
    });
    assert(ordem, 'O "Prefixo do identificador dos arquivos" deveria aparecer antes da pergunta "Primeira configuração ou já tenho um diretório"');
});

test('Assistente: "Primeira configuração" > "Pasta no computador" mostra só "Escolher pasta" (sem "Sincronizar")', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="novo"]');
    await page.waitForTimeout(100);
    await page.click('[data-wizard-tipo="local"]');
    await page.waitForTimeout(100);

    assertEqual(await page.locator('#btnChooseDir').count(), 1, '"Escolher pasta" deveria aparecer');
    assertEqual(await page.locator('#btnSync').count(), 0, 'Numa primeira configuração, não deveria oferecer "Sincronizar" (não há nada pra sincronizar ainda)');
});

test('Assistente: "Já tenho um diretório" > "Pasta no computador" mostra "Escolher pasta" e "Sincronizar" juntos', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(100);
    await page.click('[data-wizard-tipo="local"]');
    await page.waitForTimeout(100);

    assertEqual(await page.locator('#btnChooseDir').count(), 1, '"Escolher pasta" deveria aparecer');
    assertEqual(await page.locator('#btnSync').count(), 1, 'Já tendo um diretório existente, "Sincronizar do diretório" deveria aparecer junto');
});

test('Assistente: "Primeira configuração" > "Google Drive" mostra "Conectar", sem "Migrar meus arquivos e conectar"', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="novo"]');
    await page.waitForTimeout(100);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(100);

    assertEqual(await page.locator('#gdrivePasta').count(), 1, 'O campo de nome da pasta do Drive deveria aparecer');
    assertEqual(await page.locator('#btnGDriveConnect').count(), 1, '"Conectar ao Google Drive" deveria aparecer');
    assertEqual(await page.locator('#btnGDriveMigrate').count(), 0, 'Numa primeira configuração, não deveria oferecer "Migrar meus arquivos e conectar" (não há pasta local pra migrar)');
});

test('Assistente: "Já tenho um diretório" > "Google Drive" mostra "Conectar" e "Migrar meus arquivos e conectar" juntos', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(100);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(100);

    assertEqual(await page.locator('#btnGDriveConnect').count(), 1, '"Conectar ao Google Drive" deveria aparecer');
    const btnMigrar = page.locator('#btnGDriveMigrate');
    assertEqual(await btnMigrar.count(), 1, 'Já tendo um diretório existente, "Migrar meus arquivos e conectar" deveria aparecer junto');
    assert((await btnMigrar.textContent()).includes('Migrar meus arquivos e conectar'), 'O texto do botão, no assistente, deveria ser "Migrar meus arquivos e conectar" (não o texto usado no painel de estado já configurado)');
});

test('"Esquecer pasta" continua sempre visível, mesmo sem diretório configurado ainda', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    assertEqual(await page.locator('#btnForget').count(), 1, '"Esquecer pasta" deveria continuar visível independente do passo do assistente');
});

test('Com um diretório já configurado, a seção mostra o painel de estado direto, sem o assistente', async ({ page, baseUrl }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'Storage', {
            configurable: true,
            set(real) {
                real.hasDirectory = () => true;
                real.directoryName = async () => 'PastaFake';
                real.checkHealth = async () => ({ ok: true, hasDir: true });
                Object.defineProperty(window, 'Storage', { value: real, writable: true, configurable: true });
            },
            get() { return undefined; },
        });
    });
    await abrirConfig(page, baseUrl);

    assertEqual(await page.locator('[data-wizard-modo]').count(), 0, 'Com diretório já configurado, o assistente não deveria aparecer');
    assertEqual(await page.locator('#dirNameLbl').count(), 1, 'Deveria mostrar direto o painel "Pasta atual"');
    const dirLbl = await page.$eval('#dirNameLbl', (el) => el.textContent);
    assert(dirLbl.includes('PastaFake'), 'Deveria mostrar o nome da pasta já configurada');
    assertEqual(await page.locator('#idPrefix').count(), 0, 'Com diretório já configurado, o passo de "Prefixo do identificador" não precisa mais aparecer');
});

test('"Esquecer pasta" volta a mostrar o assistente do início (passo 1: prefixo; passo 2: primeira configuração/já tenho)', async ({ page, baseUrl }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'Storage', {
            configurable: true,
            set(real) {
                let esquecida = false;
                real.hasDirectory = () => !esquecida;
                real.directoryName = async () => 'PastaFake';
                real.checkHealth = async () => ({ ok: true, hasDir: true });
                real.forgetDirectory = async () => { esquecida = true; };
                Object.defineProperty(window, 'Storage', { value: real, writable: true, configurable: true });
            },
            get() { return undefined; },
        });
    });
    await abrirConfig(page, baseUrl);
    assertEqual(await page.locator('[data-wizard-modo]').count(), 0, 'Pré-condição: com diretório configurado, o assistente não deveria aparecer ainda');

    await page.click('#btnForget');
    await page.waitForTimeout(150);

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /pasta esquecida/i.test(t) && /escolha um novo diret[oó]rio|drive/i.test(t)), 'O aviso deveria confirmar que a pasta foi esquecida e indicar o que fazer a seguir');

    assertEqual(await page.locator('[data-wizard-modo]').count(), 2, 'Depois de esquecer a pasta, o assistente deveria reaparecer do zero (passo 2)');
    assertEqual(await page.locator('#idPrefix').count(), 1, 'O passo 1 (prefixo) do assistente também deveria voltar a aparecer');
});

// Regressão (issue #14 — suporte a celular): sem File System Access API
// (todo navegador em celular, e Safari/Firefox no computador), a mensagem
// antiga dizia genericamente "use Chrome ou Edge" — enganoso em celular,
// onde TROCAR de navegador não resolve (a API não existe em nenhum). A
// mensagem certa aponta pro Google Drive, que funciona nesses navegadores
// (é só fetch + OAuth via popup, não depende de File System Access API).
async function simularSemFsAccessApi(page) {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'Storage', {
            configurable: true,
            set(real) {
                real.supportsFS = false;
                Object.defineProperty(window, 'Storage', { value: real, writable: true, configurable: true });
            },
            get() { return undefined; },
        });
    });
}

test('Sem suporte a File System Access API (celular): "Escolher pasta" fica desabilitado, mas "Google Drive" continua disponível', async ({ page, baseUrl }) => {
    await simularSemFsAccessApi(page);
    await abrirConfig(page, baseUrl);

    const textoTopo = await page.$eval('#dirSection', (el) => el.textContent);
    assert(/google drive/i.test(textoTopo), 'O aviso deveria indicar o Google Drive como alternativa, não só dizer que o navegador não é suportado');
    assert(!/use chrome ou edge/i.test(textoTopo), 'Não deveria mais sugerir "trocar de navegador" — em celular isso não resolve (nenhum navegador mobile suporta)');

    await page.click('[data-wizard-modo="novo"]');
    await page.waitForTimeout(100);
    await page.click('[data-wizard-tipo="local"]');
    await page.waitForTimeout(100);
    assert(await page.isDisabled('#btnChooseDir'), '"Escolher pasta" deveria estar desabilitado sem suporte à File System Access API');

    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(100);
    assert(!(await page.isDisabled('#btnGDriveConnect')), '"Conectar ao Google Drive" NÃO deveria estar desabilitado — não depende da File System Access API');
});
