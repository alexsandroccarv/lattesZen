/* ==========================================================================
   Regressão: exportação da Súmula Curricular FAPESP em .docx (issue #8) —
   mesmo mecanismo do RSC (ZIP + OOXML, sem bibliotecas externas — ver
   src/js/docx-export.js), mas em UM ÚNICO arquivo (sem formulário nem
   anexos separados: a Súmula é um documento único de até 4 páginas),
   salvo numa subpasta datada dentro de "Exportação/Súmula Curricular
   FAPESP" do diretório configurado.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function habilitarSumula(page, cfg) {
    await page.evaluate((c) => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.sumulaEnabled = true;
        s.sumula = c || {};
        localStorage.setItem('lz_settings', JSON.stringify(s));
    }, cfg || {});
    await page.reload();
    await page.waitForTimeout(500);
}

test('Com diretório configurado, a Súmula é salva como .docx válido, numa pasta datada dentro de "Exportação/Súmula Curricular FAPESP"', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal Teste', orcid: '0000-0000-0000-0000' }),
        makeItem('FORMACAO_ACADEMICA', 'FORMACAO', { nivel: 'Doutorado', instituicao: 'USP', curso: 'Ciência da Computação', anoInicio: '01/2018', anoFim: '12/2022', statusCurso: 'Concluído' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarSumula(page, { linkLattes: 'http://lattes.cnpq.br/1234567890' });
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.__saves = [];
        window.Storage.writeFile = async (filename, data, subdir) => { window.__saves.push({ filename, subdir, bytes: Array.from(data) }); };
    });
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(300);

    await page.click('#btnSumulaExportar');
    await page.waitForTimeout(300);

    const saves = await page.evaluate(() => window.__saves);
    const hoje = new Date();
    const ddmmyyyy = String(hoje.getDate()).padStart(2, '0') + String(hoje.getMonth() + 1).padStart(2, '0') + hoje.getFullYear();
    const pastaEsperada = `Exportação/Súmula Curricular FAPESP/${ddmmyyyy}`;

    assertEqual(saves.length, 1, 'A Súmula deveria gerar um único arquivo (sem formulário nem anexos separados)');
    const saved = saves[0];
    assertEqual(saved.subdir, pastaEsperada, 'O arquivo deveria ir para a pasta datada dentro de "Exportação/Súmula Curricular FAPESP"');
    assert(saved.filename.endsWith('.docx'), `Nome do arquivo deveria terminar em .docx — obtido "${saved.filename}"`);
    assertEqual(saved.filename, `Sumula_Curricular_Fulana de Tal Teste_${ddmmyyyy}.docx`, 'Nome do arquivo deveria seguir o padrão Sumula_Curricular_NomeCompleto_ddmmyyyy.docx');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /súmula curricular exportada/i.test(t)), 'Deveria confirmar que a Súmula foi exportada');

    // Valida de verdade que os bytes formam um .docx (ZIP + OOXML) abrível.
    const dir = mkdtempSync(join(tmpdir(), 'lz-docx-'));
    const path = join(dir, 'sumula.docx');
    writeFileSync(path, Buffer.from(saved.bytes));

    const doc = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
bad = z.testzip()
names = z.namelist()
assert bad is None, f"zip corrompido em {bad}"
for req in ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']:
    assert req in names, f"faltando {req}"
print(z.read('word/document.xml').decode('utf-8'))
`, path]).toString('utf-8');

    assert(!/&lt;w:(r|t|rPr)&gt;/.test(doc), 'document.xml não deveria conter marcação OOXML escapada como texto literal');
    assert(doc.includes('Súmula Curricular') && doc.includes('FAPESP'), 'document.xml deveria conter o título da Súmula');
    assert(doc.includes('Fulana de Tal Teste'), 'document.xml deveria conter o nome (vindo da Identificação)');
    assert(doc.includes('0000-0000-0000-0000'), 'document.xml deveria conter o ORCID (vindo da Identificação)');
    assert(doc.includes('1) Formação'), 'document.xml deveria conter a seção "1) Formação" como título');
    assert(doc.includes('USP'), 'document.xml deveria conter a formação acadêmica cadastrada');
    assert(doc.includes('5) Indicadores Quantitativos'), 'document.xml deveria conter a seção "5) Indicadores Quantitativos"');
});

test('Sem texto editado manualmente, exportar usa o modelo automático (mesmo padrão do memorial do RSC)', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Ciclano Teste' })];
    await seedCatalog(page, baseUrl, items);
    await habilitarSumula(page);
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.__saves = [];
        window.Storage.writeFile = async (filename, data, subdir) => { window.__saves.push({ filename, subdir, bytes: Array.from(data) }); };
    });
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(300);

    // Não clica em "Preencher com modelo automático" nem edita o textarea —
    // exporta direto, com o campo vazio.
    await page.click('#btnSumulaExportar');
    await page.waitForTimeout(300);

    const saves = await page.evaluate(() => window.__saves);
    assertEqual(saves.length, 1, 'Deveria exportar mesmo com o campo de texto vazio');

    const dir = mkdtempSync(join(tmpdir(), 'lz-docx-'));
    const path = join(dir, 'sumula.docx');
    writeFileSync(path, Buffer.from(saves[0].bytes));
    const doc = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
print(z.read('word/document.xml').decode('utf-8'))
`, path]).toString('utf-8');
    assert(doc.includes('1) Formação'), 'Com o campo vazio, o modelo automático deveria ser usado na exportação');
    assert(doc.includes('NADA A DECLARAR'), 'Sem itens cadastrados, o modelo automático deveria usar "NADA A DECLARAR"');
});

test('Editar o texto manualmente e exportar usa exatamente o texto editado, não o modelo automático', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Ciclano Teste' })];
    await seedCatalog(page, baseUrl, items);
    await habilitarSumula(page);
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.__saves = [];
        window.Storage.writeFile = async (filename, data, subdir) => { window.__saves.push({ filename, subdir, bytes: Array.from(data) }); };
    });
    await page.click('[data-tab="sumula"]');
    await page.waitForTimeout(300);

    await page.fill('#sumulaTexto', '1) Formação\nTexto editado manualmente pelo usuário.');
    await page.locator('#sumulaTexto').evaluate((el) => el.blur());
    await page.waitForTimeout(200);
    await page.click('#btnSumulaExportar');
    await page.waitForTimeout(300);

    const saves = await page.evaluate(() => window.__saves);
    const dir = mkdtempSync(join(tmpdir(), 'lz-docx-'));
    const path = join(dir, 'sumula.docx');
    writeFileSync(path, Buffer.from(saves[0].bytes));
    const doc = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
print(z.read('word/document.xml').decode('utf-8'))
`, path]).toString('utf-8');
    assert(doc.includes('Texto editado manualmente pelo usuário'), 'O texto editado manualmente deveria ser exportado');
    assert(!doc.includes('NADA A DECLARAR'), 'O modelo automático não deveria ser usado quando há texto editado');

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').sumulaTexto);
    assert(salvo.includes('Texto editado manualmente pelo usuário'), 'O texto editado deveria ter sido autosalvo em settings.sumulaTexto');
});
