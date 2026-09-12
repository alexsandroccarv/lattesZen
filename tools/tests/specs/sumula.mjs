/* ==========================================================================
   Regressão: aba Súmula Curricular FAPESP (issue #8) — mesmo espírito do
   RSC (tab-rsc.js): módulo desabilitado mostra aviso; habilitado, mostra os
   links (Lattes/Web of Science/Scholar), o texto livre e o botão de modelo
   automático, que organiza sugestões do catálogo nas 6 seções do roteiro
   oficial da FAPESP (https://fapesp.br/sumula).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function habilitarSumula(page) {
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.sumulaEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
}

test('Módulo Súmula FAPESP desabilitado mostra aviso em vez da aba', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => window.AppCore.switchTab('sumula'));
    await page.waitForTimeout(200);
    const texto = await page.$eval('#tab-sumula', (el) => el.textContent);
    assert(texto.includes('Módulo Súmula Curricular FAPESP desabilitado'), 'Sem o módulo habilitado, deveria mostrar o aviso');
});

test('Aba Súmula FAPESP mostra Nome/ORCID (vindos da Identificação), campos de link e o textarea', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal', orcid: '0000-0000-0000-0000' })];
    await seedCatalog(page, baseUrl, items);
    await habilitarSumula(page);
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(300);

    const texto = await page.$eval('#tab-sumula', (el) => el.textContent);
    assert(texto.includes('Fulana de Tal'), 'O nome vindo da Identificação deveria aparecer');
    assert(texto.includes('0000-0000-0000-0000'), 'O ORCID vindo da Identificação deveria aparecer');
    assertEqual(await page.locator('#sumula-linkLattes').count(), 1, 'Deveria existir o campo de link do Currículo Lattes');
    assertEqual(await page.locator('#sumulaTexto').count(), 1, 'Deveria existir o textarea do texto da Súmula');
    assertEqual(await page.locator('#btnSumulaModeloPadrao').count(), 1, 'Deveria existir o botão "Preencher com modelo automático"');
    assertEqual(await page.locator('#btnSumulaExportar').count(), 1, 'Deveria existir o botão de exportar');
});

test('"Preencher com modelo automático" organiza o texto nas 6 seções do roteiro FAPESP, com dados do catálogo', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal', orcid: '0000-0000-0000-0000' }),
        makeItem('FORMACAO_ACADEMICA', 'FORMACAO', { nivel: 'Doutorado', instituicao: 'USP', curso: 'Ciência da Computação', anoInicio: '01/2018', anoFim: '12/2022', statusCurso: 'Concluído' }),
        makeItem('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'UNIFESP', cargo: 'Professor Adjunto', anoInicio: '01/2023', situacao: 'Atual (não finalizado)' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Um artigo relevante', ano: String(new Date().getFullYear()), periodico: 'Revista X' }),
        makeItem('PROJETO_PESQUISA', 'PROJETOS', { titulo: 'Projeto de pesquisa relevante', anoInicio: '01/2023', situacao: 'Em andamento' }),
        makeItem('ORIENTACAO_CONCLUIDA', 'ORIENTACOES', { tipo: 'Mestrado', orientando: 'Aluno A', titulo: 'Dissertação A' }),
        makeItem('ORIENTACAO_ANDAMENTO', 'ORIENTACOES', { tipo: 'Doutorado', orientando: 'Aluno B', titulo: 'Tese B' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarSumula(page);
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(300);

    await page.click('#btnSumulaModeloPadrao');
    await page.waitForTimeout(200);
    const texto = await page.locator('#sumulaTexto').inputValue();

    assert(texto.includes('1) Formação'), 'Deveria conter a seção "1) Formação"');
    assert(texto.includes('2) Histórico Profissional/Acadêmico'), 'Deveria conter a seção "2) Histórico Profissional/Acadêmico"');
    assert(texto.includes('3) Contribuições à Ciência'), 'Deveria conter a seção "3) Contribuições à Ciência"');
    assert(texto.includes('4) Financiamentos à Pesquisa'), 'Deveria conter a seção "4) Financiamentos à Pesquisa"');
    assert(texto.includes('5) Indicadores Quantitativos'), 'Deveria conter a seção "5) Indicadores Quantitativos"');
    assert(texto.includes('6) Outras Informações Relevantes'), 'Deveria conter a seção "6) Outras Informações Relevantes"');

    assert(texto.includes('USP'), 'A formação acadêmica cadastrada deveria aparecer na seção 1');
    assert(texto.includes('UNIFESP') && texto.includes('Professor Adjunto'), 'O vínculo profissional cadastrado deveria aparecer na seção 2');
    assert(texto.includes('Um artigo relevante'), 'A produção bibliográfica recente deveria aparecer na seção 3, com um placeholder de justificativa');
    assert(texto.includes('Justificativa:'), 'Cada contribuição deveria vir com um placeholder de justificativa para o usuário preencher');
    assert(texto.includes('Projeto de pesquisa relevante'), 'O projeto de pesquisa cadastrado deveria aparecer na seção 4');
    assert(/Dissertações de Mestrado orientadas e já defendidas: 1/.test(texto), 'O indicador de mestrado concluído deveria contar a orientação concluída cadastrada');
    assert(/Teses de Doutorado em andamento: 1/.test(texto), 'O indicador de doutorado em andamento deveria contar a orientação em andamento cadastrada');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /súmula preenchida com o modelo automático/i.test(t)), 'Deveria confirmar o preenchimento do modelo automático');
});

test('Sem itens cadastrados, cada seção baseada no catálogo mostra "NADA A DECLARAR" (como pede o roteiro oficial)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarSumula(page);
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(300);

    await page.click('#btnSumulaModeloPadrao');
    await page.waitForTimeout(200);
    const texto = await page.locator('#sumulaTexto').inputValue();
    const ocorrencias = texto.split('NADA A DECLARAR').length - 1;
    assert(ocorrencias >= 4, `Seções 1, 2, 3 e 4 sem itens deveriam usar "NADA A DECLARAR" — encontrado ${ocorrencias} ocorrência(s)`);
});

test('Exportar sem diretório configurado avisa e não exporta nada', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarSumula(page);
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(300);

    await page.click('#btnSumulaExportar');
    await page.waitForTimeout(200);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /configure um diretório/i.test(t)), 'Sem diretório configurado, deveria avisar e não tentar exportar');
});
