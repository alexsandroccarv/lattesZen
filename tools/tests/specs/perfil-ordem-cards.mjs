/* ==========================================================================
   Regressão: ordem dos cartões de "Dados gerais (perfil)" em Configurações —
   a pedido do usuário: Identificação, Endereço, Texto inicial do Currículo
   Lattes, Outras informações relevantes, Foto de perfil, Área de atuação.
   ========================================================================== */
import { test, assert, seedCatalog } from '../harness.mjs';

test('Perfil: cartões aparecem na ordem Identificação, Endereço, Texto inicial, Outras informações, Foto de perfil, Área de atuação', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);

    const ordem = await page.evaluate(() => {
        // Só o grid dos cartões (não o parágrafo introdutório de
        // #perfilSection, que também cita os mesmos nomes em prosa e
        // falsearia a busca por posição).
        const grid = document.querySelector('#perfilSection > div.grid');
        const rotulos = ['Identificação', 'Endereço', 'Texto inicial do Currículo Lattes', 'Outras informações relevantes', 'Foto de perfil', 'Áreas de atuação'];
        const html = grid.innerHTML;
        return rotulos.map((r) => html.indexOf(r));
    });
    assert(ordem.every((i) => i > -1), `Todos os 6 cartões deveriam existir na seção de perfil — índices: ${JSON.stringify(ordem)}`);
    for (let i = 1; i < ordem.length; i++) {
        assert(ordem[i - 1] < ordem[i], `A ordem dos cartões está errada — índices encontrados: ${JSON.stringify(ordem)}`);
    }
});
