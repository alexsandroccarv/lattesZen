/* ==========================================================================
   Regressão: seletor de Tema (Configurações), trazido do templateZen
   --------------------------------------------------------------------------
   - "Padrão" (default) não aplica nenhuma classe/atributo de tema.
   - Escolher um tema aplica a classe .lz-theme + data-lz-theme no <html> e
     persiste no localStorage (lz_tema_preset).
   - O tema persiste entre reloads e entre páginas diferentes (a lógica de
     aplicação cedo roda em qualquer página, não só index.html).
   - Voltar para "Padrão" remove a classe/atributo.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirConfig(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('Seletor de tema existe em Configurações, com "Padrão" pré-selecionado', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const sel = await page.$('#themeSelect');
    assert(sel, 'O seletor de tema deveria existir em Configurações');
    const valor = await page.$eval('#themeSelect', (el) => el.value);
    assertEqual(valor, 'padrao', 'Sem nada escolhido, o tema deveria estar em "Padrão"');
    const htmlClasses = await page.$eval('html', (el) => el.className);
    assert(!htmlClasses.includes('lz-theme'), 'Sem tema escolhido, a classe lz-theme não deveria estar presente');
});

test('Lista de temas corresponde exatamente à do templateZen (+ "Padrão")', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const valores = await page.$$eval('#themeSelect option', (opts) => opts.map((o) => o.value));
    assertEqual(valores, [
        'padrao', 'catppuccin-latte', 'catppuccin-mocha', 'dracula',
        'github-light', 'github-dark', 'govbr', 'rose-pine-dawn',
        'solarized-light', 'solarized-dark',
    ], `Lista de temas incorreta — obtida: ${JSON.stringify(valores)}`);
});

test('Escolher um tema aplica data-lz-theme + classe lz-theme e persiste', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.selectOption('#themeSelect', 'dracula');
    await page.waitForTimeout(150);

    const temaAttr = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(temaAttr, 'dracula', 'data-lz-theme deveria ser "dracula" após a escolha');
    const temClasse = await page.$eval('html', (el) => el.classList.contains('lz-theme'));
    assert(temClasse, 'A classe lz-theme deveria estar presente após escolher um tema');

    const salvo = await page.evaluate(() => localStorage.getItem('lz_tema_preset'));
    assertEqual(salvo, 'dracula', 'O tema escolhido deveria ser salvo no localStorage');

    await page.reload();
    await page.waitForTimeout(400);
    const temaAposReload = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(temaAposReload, 'dracula', 'O tema deveria persistir após recarregar a página');
});

test('Tema persiste em outras páginas (ex.: ajuda.html), não só no index.html', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => localStorage.setItem('lz_tema_preset', 'rose-pine-dawn'));
    await page.goto(baseUrl + '/ajuda.html');
    await page.waitForTimeout(300);
    const temaAttr = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(temaAttr, 'rose-pine-dawn', 'O tema escolhido deveria se aplicar em qualquer página, não só index.html');
});

test('Voltar para "Padrão" remove a classe/atributo de tema', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.selectOption('#themeSelect', 'catppuccin-mocha');
    await page.waitForTimeout(150);
    await page.selectOption('#themeSelect', 'padrao');
    await page.waitForTimeout(150);

    const temAtributo = await page.$eval('html', (el) => el.hasAttribute('data-lz-theme'));
    assert(!temAtributo, 'data-lz-theme não deveria mais existir ao voltar para Padrão');
    const temClasse = await page.$eval('html', (el) => el.classList.contains('lz-theme'));
    assert(!temClasse, 'A classe lz-theme não deveria mais existir ao voltar para Padrão');
    const salvo = await page.evaluate(() => localStorage.getItem('lz_tema_preset'));
    assertEqual(salvo, 'padrao', 'O valor salvo deveria refletir "padrao"');
});

test('Todos os temas definem de fato as variáveis --lz-* (regressão: comentário CSS mal fechado zerava tudo)', async ({ page, baseUrl }) => {
    // Bug real (relatado pelo usuário): um comentário CSS contendo o texto
    // "govbr-*/unifesp-*" tem, sem querer, a sequência "*/" no meio — fecha
    // o comentário mais cedo do que deveria, e todo o texto até o próximo
    // "*/" (sem abertura correspondente) vira "CSS" inválido. Isso zerava
    // as variáveis --lz-* de TODOS os temas: fundo/texto ficavam
    // transparentes/herdados (cabeçalho "some", títulos ilegíveis), mesmo
    // com data-lz-theme e .lz-theme corretamente aplicados pelo JS — só
    // pegável checando se as variáveis realmente resolvem, não só a classe.
    await abrirConfig(page, baseUrl);
    const valores = await page.$$eval('#themeSelect option', (opts) => opts.map((o) => o.value).filter((v) => v !== 'padrao'));
    for (const tema of valores) {
        await page.selectOption('#themeSelect', tema);
        await page.waitForTimeout(80);
        const vars = await page.evaluate(() => {
            const cs = getComputedStyle(document.documentElement);
            return {
                bg: cs.getPropertyValue('--lz-bg').trim(),
                header: cs.getPropertyValue('--lz-header').trim(),
                text: cs.getPropertyValue('--lz-text').trim(),
                accent: cs.getPropertyValue('--lz-accent').trim(),
            };
        });
        for (const [k, v] of Object.entries(vars)) {
            assert(v.length > 0, `Tema "${tema}": --lz-${k} deveria ter um valor definido, veio vazio`);
        }
    }
});

test('Sem tema escolhido, a grade da Linha do tempo continua com a escala própria (.viz-heat-*)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(200);
    // Sem itens no catálogo o gráfico mostra o aviso, não a grade — o que
    // importa aqui é que a lista de classes usada pelo heatmap não referencia
    // mais govbr-*/unifesp-* (ficaria "achatada" por um tema no futuro).
    const usaClassesAntigas = await page.evaluate(() => {
        const mod = window.TabLinhaTempo;
        return mod && mod.NIVEL_CLASSES ? mod.NIVEL_CLASSES.some((c) => /govbr|unifesp/.test(c)) : null;
    });
    assertEqual(usaClassesAntigas, false, 'NIVEL_CLASSES não deveria mais usar classes govbr-*/unifesp-*');
});
