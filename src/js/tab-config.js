/* ==========================================================================
   lattesZen — Aba Configurações (última aba extraída de app.js)
   --------------------------------------------------------------------------
   Sexta e última aba extraída de app.js (ver issue de refatoração) — inclui
   os formulários de perfil (Identificação, Foto, Endereço, Texto inicial,
   Outras informações), Área de atuação, Documentos pessoais, RSC-PCCTAE,
   Lixeira, backup/restauração do catálogo, ferramentas de codificação, e os
   importadores/exportadores de XML do Lattes, ORCID e BibTeX/RIS — que já
   viviam fisicamente dentro deste bloco no app.js original (só são
   invocados a partir de renderConfig(), então continuam aqui).

   Mesmo padrão das abas já extraídas: lê estado/utilidades/motor de forms
   de window.AppCore (buildForm, fieldHtml, os wireX, collectFields... —
   publicados por tab-catalogar.js, que carrega ANTES deste módulo, então
   é seguro desestruturar direto no topo). Na direção oposta, funções que
   ficaram em app.js (saveCatalog, switchTab, checkDirHealth, syncFromDirectory,
   restoreItem/purgeTrashItem/emptyTrash, sanitizePrefix, updateHeaderIdentity,
   applyRscVisibility etc.) são lidas via window.AppCore.xxx dentro dos
   corpos das funções — app.js carrega DEPOIS deste módulo.
   ========================================================================== */
window.TabConfig = (function () {
    const {
        state, $, $$, esc, toast,
        itemsUsingValue, evCount,
        buildForm, fieldHtml, wireValidators, wireCounters, wireDateBr, wireConditional, wireNA, wireAreaTree, wireRepeater,
        collectFields, normalizeEncoding, validateItemFields, collectSuggestions, renameFieldValue,
        AUTOCOMPLETE_KEYS, VOCAB_LABELS,
    } = window.AppCore;

    // Aviso persistente exibido logo após uma migração local → Google Drive
    // (não usa toast pra isso — some rápido demais pra uma mensagem
    // importante). Fica até o usuário clicar em "Entendi, dispensar", ou até
    // recarregar a página.
    let gdriveMigrationNotice = null;

    // Assistente guiado de "Diretório de armazenamento", mostrado só enquanto
    // NENHUM diretório está configurado ainda (Storage.hasDirectory() falso)
    // — depois de configurado, a seção volta a mostrar o painel de estado
    // atual direto (pasta ativa + botões de gerenciar), sem o assistente.
    // 'novo' | 'existente' | null, e 'local' | 'remoto' | null.
    let dirWizardModo = null;
    let dirWizardTipo = null;

    /* =====================================================================
       IMPORTAR LATTES (XML) — seção dentro de Configurações
       ===================================================================== */
    // Aviso de consistência exibido nas operações de XML (importar/exportar):
    // depois de adotar o lattesZen, as edições devem ocorrer AQUI e não mais
    // diretamente na Plataforma Lattes (senão a assinatura do item muda e pode
    // duplicar na próxima importação).
    function xmlConsistencyNoticeHtml() {
        return `
            <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3 flex gap-2">
                <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                <span>Para manter a <strong>consistência</strong>: depois de adotar o lattesZen, faça as <strong>edições aqui no lattesZen</strong> e não mais diretamente na Plataforma Lattes. O lattesZen vira a sua fonte de referência e você exporta o XML para atualizar o Lattes. Alterar um item direto na Plataforma Lattes muda o identificador dele e pode gerar <strong>duplicação</strong> ao reimportar.</span>
            </div>`;
    }
    function xmlConsistencyToast() {
        toast('Lembrete: edite no lattesZen (não direto na Plataforma Lattes) para manter a consistência dos dados.', 'aviso');
    }

    // Import + export do XML do Lattes unificados num card só (mesmo padrão
    // já usado em Publicações BibTeX/RIS) — antes eram duas seções soltas,
    // uma logo após a outra, sem necessidade. A verificação de compatibilidade
    // ISO-8859-1 também mora aqui dentro (recolhida por padrão), já que só faz
    // sentido no contexto de "vou exportar para o Lattes".
    function lattesXmlSectionHtml() {
        return `
            <section id="importXmlSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-file-import text-govbr-600 dark:text-unifesp-400"></i> Currículo Lattes (XML)
                </h2>
                ${xmlConsistencyNoticeHtml()}

                <h3 class="text-sm font-semibold mb-1">Importar</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Exporte seu currículo em XML na Plataforma Lattes (Menu <em>&rarr; Exportar &rarr; XML</em>) e selecione o arquivo abaixo.
                    Os itens serão listados para você escolher quais importar; cada um poderá receber um PDF depois.
                </p>
                <input type="file" id="xmlInput" accept=".xml,application/xml,text/xml"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <div id="xmlResult" class="mt-3"></div>

                <h3 class="text-sm font-semibold mt-5 mb-1">Exportar</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Gera um arquivo <strong>curriculo-&lt;nome&gt;-&lt;data e hora&gt;.xml</strong> no formato oficial do CNPq (schema <em>CurriculoLattes</em>, codificação ISO-8859-1). O nome traz a data/hora da geração, então exportações anteriores não são sobrescritas. Inclui apenas os itens das categorias do Lattes — <strong>RSC, Conexões e Registros pessoais não são exportados</strong>. As evidências (PDFs) não fazem parte do XML.</p>
                <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3 flex gap-2">
                    <i class="fa-solid fa-hourglass-half mt-0.5"></i>
                    <span><strong>Funcionalidade futura:</strong> a exportação para XML ainda está em desenvolvimento e está temporariamente desativada.</span>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button id="btnXmlDownload" disabled class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm opacity-50 cursor-not-allowed"><i class="fa-solid fa-download mr-1"></i> Baixar XML (.xml)</button>
                    <button id="btnXmlSave" disabled class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm opacity-50 cursor-not-allowed"><i class="fa-solid fa-folder-open mr-1"></i> Salvar na pasta (${esc(LattesTypes.lattesXmlFolder())})</button>
                </div>
                <p id="xmlStatus" class="text-xs text-gray-500 mt-2"></p>

                <details class="mt-5 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <summary class="cursor-pointer select-none text-sm font-semibold flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                        <i aria-hidden="true" class="fa-solid fa-language text-govbr-600 dark:text-unifesp-400"></i>
                        Verificar compatibilidade com o Lattes (ISO-8859-1)
                    </summary>
                    <div class="pt-3">
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            O Currículo Lattes usa a codificação <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ISO-8859-1</code>.
                            A verificação abaixo aponta caracteres fora dessa tabela (ex.: aspas “curvas”, travessão —, emoji) que,
                            na exportação, viram entidades numéricas. Você pode normalizá-los automaticamente.
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <button id="btnCheckEnc" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-spell-check mr-1"></i> Verificar codificação</button>
                            <button id="btnNormalize" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Normalizar pontuação</button>
                        </div>
                        <div id="encResult" class="text-sm mt-3"></div>
                    </div>
                </details>
            </section>`;
    }

    // Nome do arquivo XML exportado, com timestamp (evita sobrescrever
    // exportações anteriores e registra quando cada uma foi gerada).
    function xmlFileName() {
        const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
        const safe = (nome && nome.titulo ? nome.titulo : 'curriculo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').toLowerCase();
        return `curriculo-${safe}-${fileStamp()}.xml`;
    }
    // Ata os botões da exportação XML (usado dentro de renderConfig).
    function wireExportLattes() {
        const xmlStatus = (t) => { const el = $('#xmlStatus'); if (el) el.textContent = t; };
        function generateLattesXml() {
            const cfg = Storage.loadSettings() || {};
            const xml = LattesXMLExport.build(state.items, { numeroIdentificador: cfg.lattesId || '' });
            // Serializa em ISO-8859-1 (entidades numéricas para fora do Latin-1).
            return { xml, bytes: LzEncoding.encodeLatin1Xml(xml) };
        }
        const xmlExportaveis = () => state.items.filter(i => {
            const def = LattesTypes.getType(i.typeKey);
            if (def && def.noExport) return false;
            if (i.visibilidade && i.visibilidade.exportarLattes === false) return false;
            return !LattesTypes.isNaoLattesCategory(i.categoryKey);
        }).length;
        const dl = $('#btnXmlDownload');
        if (dl) dl.addEventListener('click', () => {
            xmlStatus('Gerando XML…');
            try {
                const { bytes } = generateLattesXml();
                const blob = new Blob([bytes], { type: 'application/xml' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = xmlFileName(); a.click(); URL.revokeObjectURL(a.href);
                xmlStatus(`XML gerado (${xmlExportaveis()} item(ns) exportado(s)).`);
                xmlConsistencyToast();
            } catch (e) { xmlStatus(''); toast('Falha ao gerar XML: ' + e.message, 'erro'); }
        });
        const sv = $('#btnXmlSave');
        if (sv) sv.addEventListener('click', async () => {
            if (!Storage.hasDirectory()) { toast('Configure um diretório abaixo para salvar na pasta.', 'aviso'); return; }
            xmlStatus('Gerando e salvando XML…');
            try {
                const folder = LattesTypes.lattesXmlFolder();
                const nomeArquivo = xmlFileName();
                const { bytes } = generateLattesXml();
                await Storage.writeFile(nomeArquivo, bytes, folder);
                xmlStatus(`Salvo em “${folder}/${nomeArquivo}” (${xmlExportaveis()} item(ns)).`);
                toast(`XML salvo em “${folder}/${nomeArquivo}”.`, 'ok');
                xmlConsistencyToast();
            } catch (e) { xmlStatus(''); toast('Falha ao salvar XML: ' + e.message, 'erro'); }
        });
    }

    async function onXmlSelected(e) {
        const file = e.target.files[0];
        if (!file) return;
        // Conversor de ENTRADA: decodifica respeitando o encoding do XML (Lattes = ISO-8859-1)
        const text = await LzEncoding.decodeXmlFile(file);
        const res = LattesXML.parse(text);
        state.lattesParsed = res;

        if (res.errors && res.errors.length) { toast(res.errors[0], 'erro'); }
        renderXmlResult(res);
    }

    /* ----------------------- Deduplicação de importação -----------------------
       Uma "assinatura de conteúdo" identifica o MESMO item entre importações,
       independente da categoria e resistente a edições locais. Casa três casos:
       (1) re-importar um item já importado (mesma assinatura viva);
       (2) item importado e depois EDITADO localmente — a assinatura ORIGINAL do
           Lattes fica gravada em `lattesRef` (imutável) e continua casando;
       (3) item criado MANUALMENTE no lattesZen que depois passa a existir no
           Lattes — casa pela assinatura viva e é "adotado" (recebe lattesRef).
       Assim NUNCA se cria duplicata a cada nova importação do XML.           */
    function _canonTitle(f) {
        // Cadeia de campos-título por prioridade. Inclui os campos preservados no
        // round-trip de tipos sem "titulo" próprio (ex.: Áreas de atuação usam a
        // hierarquia especialidade/subárea/área), para que também deduplicem.
        return String((f && (f.titulo || f.curso || f.orientando || f.candidato
            || f.especialidade || f.subarea || f.area || f.instituicao)) || '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }
    // Reduz qualquer data (aaaa, aaaa-mm-dd ou dd/mm/aaaa) ao ano de 4 dígitos.
    // Assim a assinatura de um item com data completa (ex.: ATIV_CONSELHO) casa
    // com o mesmo item reimportado do Lattes, que traz só o ano — sem duplicar.
    function _sigYear(v) { const m = String(v == null ? '' : v).match(/\d{4}/); return m ? m[0] : ''; }
    function itemSignature(typeKey, fields) {
        const c = _canonTitle(fields);
        return c ? `${typeKey}|${c}|${_sigYear(fields && fields.ano)}|${_sigYear(fields && fields.anoInicio)}|${_sigYear(fields && fields.anoFim)}` : '';
    }
    // Assinatura(s) derivada(s) de um item existente: a viva (campos atuais) e a
    // original gravada em lattesRef (formato cat|type|canon|ano|ini|fim → tira a categoria).
    function itemSignatures(it) {
        const out = [];
        const live = itemSignature(it.typeKey, it.fields || {});
        if (live) out.push(live);
        if (it.lattesRef) {
            const parts = String(it.lattesRef).split('|');
            if (parts.length >= 2) { const s = parts.slice(1).join('|'); if (s) out.push(s); }
        }
        return out;
    }
    // Mapa assinatura -> item existente (primeira ocorrência vence).
    function existingSignatureMap() {
        const map = new Map();
        for (const it of state.items) for (const s of itemSignatures(it)) if (!map.has(s)) map.set(s, it);
        return map;
    }

    function renderXmlResult(res) {
        const box = $('#xmlResult');
        if (!res.items.length) {
            box.innerHTML = `<p class="text-sm text-gray-500 italic">Nenhum item reconhecido no XML.</p>`;
            return;
        }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.items.some(x => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = res.items.filter(it => !isDup(it)).length;
        const jaCat = res.items.length - novos;
        const resumo = Object.entries(res.summary)
            .map(([k, n]) => `<span class="badge bg-govbr-50 text-govbr-700 dark:bg-gray-700 dark:text-gray-200">${esc(LattesTypes.label(k))}: ${n}</span>`).join(' ');

        box.innerHTML = `
            <div class="mb-3">
                ${res.titular ? `<p class="text-sm mb-1">Titular: <strong>${esc(res.titular)}</strong></p>` : ''}
                <p class="text-sm mb-1">${res.items.length} itens reconhecidos — <strong class="text-green-700 dark:text-green-400">${novos} novos</strong>, ${jaCat} já catalogado(s).</p>
                <div class="flex flex-wrap gap-1">${resumo}</div>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar novos</button>
                <button id="btnSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Todos</button>
                <button id="btnSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Nenhum</button>
                <button id="btnImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> Importar selecionados
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${res.items.map((it, idx) => {
                    const dup = isDup(it);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="xmlchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || it.fields.curso || '(sem título)')}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? '· <em>já catalogado</em>' : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnSelNovos').addEventListener('click', () => $$('.xmlchk').forEach(c => {
            c.checked = !isDup(res.items[+c.dataset.idx]);
        }));
        $('#btnSelAll').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = true));
        $('#btnSelNone').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = false));
        $('#btnImport').addEventListener('click', importSelected);
    }

    async function importSelected() {
        const chosen = $$('.xmlchk').filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        // Deduplicação por assinatura de conteúdo — impede duplicar itens já
        // existentes a cada nova importação, mesmo que tenham sido editados ou
        // criados manualmente antes de constarem no Lattes.
        const sigMap = existingSignatureMap();
        const registrar = (it) => itemSignatures(it).forEach(s => { if (!sigMap.has(s)) sigMap.set(s, it); });
        let n = 0, atualizados = 0, ignorados = 0;
        for (const idx of chosen) {
            const src = state.lattesParsed.items[idx];
            // Tipos únicos (Identificação, Endereço, Resumo, Outras info): se já
            // existir um item desse tipo, ATUALIZA em vez de criar um novo.
            if (LattesTypes.isSingleton(src.typeKey)) {
                const ex = state.items.find(i => i.typeKey === src.typeKey);
                if (ex) {
                    ex.fields = src.fields; ex.categoryKey = src.categoryKey || ex.categoryKey;
                    ex.lattesRef = src.lattesRef; ex.updatedAt = window.AppCore.nowISO();
                    await window.AppCore.persistItem(ex);
                    atualizados++; continue;
                }
            }
            const sig = itemSignature(src.typeKey, src.fields || {});
            const match = sig ? sigMap.get(sig) : null;
            if (match) {
                // Item já existe: NÃO duplica. Preserva os dados e as evidências
                // do usuário; apenas "adota" como item do Lattes (grava o
                // lattesRef original) para casar nas próximas importações.
                let changed = false;
                if (!match.lattesRef && src.lattesRef) { match.lattesRef = src.lattesRef; changed = true; }
                if (changed) { match.updatedAt = window.AppCore.nowISO(); await window.AppCore.persistItem(match); atualizados++; }
                else ignorados++;
                registrar(match);
                continue;
            }
            const item = {
                id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(),
                lattesItem: true, typeKey: src.typeKey,
                categoryKey: src.categoryKey || LattesTypes.primaryCategory(src.typeKey),
                fields: src.fields,
                source: 'lattes', lattesRef: src.lattesRef,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            await window.AppCore.persistItem(item);
            registrar(item);
            n++;
        }
        const extras = [atualizados ? `${atualizados} atualizado(s)` : '', ignorados ? `${ignorados} já existente(s) ignorado(s)` : ''].filter(Boolean).join(', ');
        toast(`${n} item(ns) importado(s)${extras ? ' — ' + extras : ''}.`, 'ok');
        xmlConsistencyToast();
        renderXmlResult(state.lattesParsed);
        window.AppCore.renderItemList();
    }

    /* =====================================================================
       IMPORTAR PUBLICAÇÕES DO ORCID — seção dentro de Configurações
       ---------------------------------------------------------------------
       Busca as obras públicas de um ORCID iD (API pública, sem autenticação)
       e reaproveita a mesma tela de revisão/seleção e a mesma deduplicação
       por assinatura de conteúdo (itemSignature/existingSignatureMap) já
       usadas na importação do XML do Lattes — só a origem dos dados muda.
       ===================================================================== */
    // Tipo de obra do ORCID → tipo do lattesZen. Cobre os tipos mais comuns;
    // qualquer tipo não mapeado cai em OUTRA_BIBLIOGRAFICA (catch-all seguro).
    const ORCID_TYPE_MAP = {
        'journal-article': 'ARTIGO_PERIODICO', 'journal-issue': 'ARTIGO_PERIODICO',
        'book': 'LIVROS', 'edited-book': 'LIVROS',
        'book-chapter': 'CAPITULOS_LIVRO',
        'conference-paper': 'TRABALHO_EVENTO', 'conference-abstract': 'TRABALHO_EVENTO', 'conference-poster': 'TRABALHO_EVENTO',
        'lecture-speech': 'APRESENTACAO',
        'magazine-article': 'TEXTO_JORNAL', 'newsletter-article': 'TEXTO_JORNAL', 'newspaper-article': 'TEXTO_JORNAL', 'online-resource': 'TEXTO_JORNAL',
        'translation': 'TRADUCAO',
        'software': 'SOFTWARE_SEM_REGISTRO',
        'patent': 'PATENTE',
        'trademark': 'MARCA',
        'artistic-performance': 'ARTES_CENICAS',
        'cartographic-material': 'CARTA_MAPA',
        'image': 'OUTRA_ARTISTICA', 'video': 'OUTRA_ARTISTICA',
        'report': 'RELATORIO_PESQUISA', 'working-paper': 'RELATORIO_PESQUISA', 'preprint': 'RELATORIO_PESQUISA',
    };
    const ORCID_FALLBACK_TYPE = 'OUTRA_BIBLIOGRAFICA';

    function orcidImportSectionHtml() {
        const perfil = (state.items.find(i => i.typeKey === 'IDENTIFICACAO') || {}).fields || {};
        return `
            <section id="importOrcidSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-brands fa-orcid text-green-600"></i> Importar publicações do ORCID
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Busca as obras públicas registradas no seu <strong>ORCID iD</strong> (API pública do ORCID — nenhuma senha é necessária) e lista para você escolher quais importar, do mesmo jeito que a importação do XML do Lattes.
                </p>
                <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3 flex gap-2">
                    <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                    <span>Os <strong>autores</strong> são buscados automaticamente, mas só saem se o próprio autor tiver um nome público registrado no ORCID daquela obra — quando faltar, complete depois de importar. O <strong>tipo</strong> de cada obra é inferido automaticamente e pode precisar de ajuste.</span>
                </div>
                <div class="flex flex-wrap items-end gap-2">
                    <div>
                        <label class="block text-xs font-semibold mb-1" for="orcidInput">ORCID iD</label>
                        <input type="text" id="orcidInput" placeholder="0000-0000-0000-0000" value="${esc(perfil.orcid || '')}"
                               class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 w-48">
                    </div>
                    <button id="btnOrcidBuscar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                        <i class="fa-solid fa-magnifying-glass mr-1"></i> Buscar publicações
                    </button>
                </div>
                <div id="orcidResult" class="mt-3"></div>
            </section>`;
    }

    // Extrai um external-id específico (ex.: 'doi', 'uri') do work-summary do ORCID.
    function orcidExternalId(summary, kind) {
        const ids = summary['external-ids'] && summary['external-ids']['external-id'];
        if (!Array.isArray(ids)) return '';
        const found = ids.find((x) => x['external-id-type'] === kind);
        return found ? String(found['external-id-value'] || '').trim() : '';
    }
    // Converte um work-summary do ORCID num item do lattesZen (typeKey/categoryKey/fields).
    // `autores`, quando informado, vem da busca em lote de fetchOrcidWorkDetails (2ª
    // chamada) — o endpoint de listagem por si só não traz os colaboradores da obra.
    function orcidWorkToItem(summary, autores) {
        const typeKey = ORCID_TYPE_MAP[summary.type] || ORCID_FALLBACK_TYPE;
        const titulo = (summary.title && summary.title.title && summary.title.title.value) || '';
        const ano = (summary['publication-date'] && summary['publication-date'].year && summary['publication-date'].year.value) || '';
        const doi = orcidExternalId(summary, 'doi');
        const url = (summary.url && summary.url.value) || orcidExternalId(summary, 'uri') || '';
        const journal = (summary['journal-title'] && summary['journal-title'].value) || '';
        const def = LattesTypes.getType(typeKey);
        const temCampo = (k) => def && def.fields.some((f) => f.key === k);
        const fields = {};
        if (temCampo('titulo')) fields.titulo = titulo;
        if (temCampo('ano')) fields.ano = ano;
        if (temCampo('doi')) fields.doi = doi;
        if (temCampo('url')) fields.url = url;
        if (typeKey === 'ARTIGO_PERIODICO' || typeKey === 'ARTIGO_ACEITO') fields.periodico = journal;
        if (autores && autores.length) {
            if (temCampo('autoresLista')) fields.autoresLista = autores.map((nome) => ({ nomeCompleto: nome, nomeCitacao: '' }));
            else if (temCampo('autores')) fields.autores = autores.join('; ');
        }
        return { typeKey, categoryKey: LattesTypes.primaryCategory(typeKey), fields, putCode: summary['put-code'] };
    }
    // Extrai os nomes dos colaboradores com papel de autor (ou sem papel
    // informado — é o padrão da maioria dos registros) do registro COMPLETO de
    // uma obra do ORCID. Colaboradores sem "credit-name" público não têm como
    // ser nomeados (só o ORCID iD deles, sem nome de exibição) e são ignorados.
    function orcidContributorNames(work) {
        const list = work && work.contributors && work.contributors.contributor;
        if (!Array.isArray(list)) return [];
        return list
            .filter((c) => {
                const role = c['contributor-attributes'] && c['contributor-attributes']['contributor-role'];
                return !role || role === 'author';
            })
            .map((c) => (c['credit-name'] && c['credit-name'].value) || '')
            .filter(Boolean);
    }
    // Busca os registros COMPLETOS (com colaboradores) de uma lista de obras, em
    // lotes de até 50 (limite do endpoint de busca em lote da API do ORCID).
    // Retorna um Map put-code → nomes de autores. Uma falha num lote não trava
    // a importação — a obra simplesmente fica sem autores pré-preenchidos.
    async function fetchOrcidWorkDetails(orcid, putCodes) {
        const map = new Map();
        for (let i = 0; i < putCodes.length; i += 50) {
            const lote = putCodes.slice(i, i + 50);
            let resp;
            try { resp = await fetch(`https://pub.orcid.org/v3.0/${orcid}/works/${lote.join(',')}`, { headers: { 'Accept': 'application/json' } }); }
            catch (_) { continue; }
            if (!resp.ok) continue;
            const data = await resp.json();
            const bulk = Array.isArray(data.bulk) ? data.bulk : [];
            for (const entry of bulk) {
                const work = entry && entry.work;
                if (!work) continue;
                const nomes = orcidContributorNames(work);
                if (nomes.length) map.set(work['put-code'], nomes);
            }
        }
        return map;
    }
    // Busca as obras públicas de um ORCID iD. Lança erro (mensagem em pt-BR) se
    // o formato for inválido ou a consulta falhar.
    async function fetchOrcidWorks(orcid) {
        const clean = String(orcid || '').trim().toUpperCase();
        if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(clean)) throw new Error('ORCID iD inválido — use o formato 0000-0000-0000-0000.');
        let resp;
        try { resp = await fetch(`https://pub.orcid.org/v3.0/${clean}/works`, { headers: { 'Accept': 'application/json' } }); }
        catch (_) { throw new Error('Não foi possível conectar ao ORCID — verifique sua conexão com a internet.'); }
        if (!resp.ok) throw new Error(`ORCID retornou um erro (HTTP ${resp.status}) — confira se o ORCID iD existe e é público.`);
        const data = await resp.json();
        const groups = Array.isArray(data.group) ? data.group : [];
        const summaries = groups.map((g) => (g['work-summary'] && g['work-summary'][0]) || null).filter(Boolean);
        let autoresPorObra = new Map();
        try { autoresPorObra = await fetchOrcidWorkDetails(clean, summaries.map((s) => s['put-code'])); }
        catch (_) { /* segue sem autores pré-preenchidos */ }
        return summaries.map((s) => orcidWorkToItem(s, autoresPorObra.get(s['put-code'])));
    }

    function renderOrcidResult(items) {
        const box = $('#orcidResult');
        if (!items.length) { box.innerHTML = `<p class="text-sm text-gray-500 italic">Nenhuma obra pública encontrada para esse ORCID iD.</p>`; return; }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.items.some((x) => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = items.filter((it) => !isDup(it)).length;
        box.innerHTML = `
            <div class="mb-3">
                <p class="text-sm mb-1">${items.length} obra(s) encontrada(s) — <strong class="text-green-700 dark:text-green-400">${novos} novas</strong>, ${items.length - novos} já catalogada(s).</p>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnOrcidSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar novos</button>
                <button id="btnOrcidSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Todos</button>
                <button id="btnOrcidSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Nenhum</button>
                <button id="btnOrcidImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> Importar selecionados
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${items.map((it, idx) => {
                    const dup = isDup(it);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="orcidchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || '(sem título)')}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? '· <em>já catalogado</em>' : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnOrcidSelNovos').addEventListener('click', () => $$('.orcidchk').forEach((c) => { c.checked = !isDup(items[+c.dataset.idx]); }));
        $('#btnOrcidSelAll').addEventListener('click', () => $$('.orcidchk').forEach((c) => c.checked = true));
        $('#btnOrcidSelNone').addEventListener('click', () => $$('.orcidchk').forEach((c) => c.checked = false));
        $('#btnOrcidImport').addEventListener('click', importOrcidSelected);
    }

    async function importOrcidSelected() {
        const chosen = $$('.orcidchk').filter((c) => c.checked).map((c) => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        const sigMap = existingSignatureMap();
        let n = 0, ignorados = 0;
        for (const idx of chosen) {
            const src = state.orcidParsed[idx];
            const sig = itemSignature(src.typeKey, src.fields || {});
            if (sig && sigMap.has(sig)) { ignorados++; continue; } // já existe (mesma assinatura) — não duplica
            const item = {
                id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(),
                lattesItem: true, typeKey: src.typeKey, categoryKey: src.categoryKey,
                fields: src.fields, source: 'orcid', lattesRef: null,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            await window.AppCore.persistItem(item);
            if (sig) sigMap.set(sig, item);
            n++;
        }
        toast(`${n} item(ns) importado(s) do ORCID${ignorados ? ` — ${ignorados} já existente(s) ignorado(s)` : ''}.`, 'ok');
        renderOrcidResult(state.orcidParsed);
        window.AppCore.renderItemList();
    }

    function wireOrcidImport() {
        const btn = $('#btnOrcidBuscar');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const input = $('#orcidInput');
            btn.disabled = true; btn.textContent = 'Buscando…';
            try {
                const items = await fetchOrcidWorks(input.value);
                state.orcidParsed = items;
                renderOrcidResult(items);
            } catch (e) {
                $('#orcidResult').innerHTML = '';
                toast(e.message, 'erro');
            } finally {
                btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass mr-1"></i> Buscar publicações';
            }
        });
    }

    /* =====================================================================
       IMPORTAR PUBLICAÇÕES DE BIBTEX/RIS — seção dentro de Configurações
       (issue #6)
       ---------------------------------------------------------------------
       Faz o parse local do arquivo (window.LzBibRis, sem rede) e reaproveita
       a mesma tela de revisão/seleção e a mesma deduplicação por assinatura
       de conteúdo já usadas no import de XML/ORCID.
       ===================================================================== */
    function bibImportSectionHtml() {
        return `
            <section id="importBibSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-file-lines text-govbr-600 dark:text-unifesp-400"></i> Publicações (BibTeX/RIS)
                </h2>
                <h3 class="text-sm font-semibold mb-1">Importar</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Traga referências exportadas de outra ferramenta (Zotero, Mendeley, EndNote, Google Scholar) — selecione um arquivo <code>.bib</code> (BibTeX) ou <code>.ris</code> (RIS).
                </p>
                <input type="file" id="bibInput" accept=".bib,.ris,text/plain,application/x-bibtex"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <div id="bibResult" class="mt-3"></div>

                <h3 class="text-sm font-semibold mt-5 mb-1">Exportar</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Gera um arquivo com as publicações já catalogadas (artigos, livros, capítulos, trabalhos em anais de evento e relatórios de pesquisa) — para usar em outra ferramenta de referências.
                </p>
                <div class="flex flex-wrap gap-2">
                    <button id="btnBibExportBib" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar .bib (BibTeX)</button>
                    <button id="btnBibExportRis" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar .ris (RIS)</button>
                </div>
                <p id="bibExportStatus" class="text-xs text-gray-500 mt-2"></p>
            </section>`;
    }

    // Tipo de entrada BibTeX (minúsculo, ex.: 'article') ou código RIS
    // (maiúsculo, ex.: 'JOUR') → tipo do lattesZen. Sem entrada aqui = fica na
    // lista de "ignorados" (issue #6 pede para NÃO adivinhar a categoria).
    const BIB_RIS_TYPE_MAP = {
        article: 'ARTIGO_PERIODICO',
        inproceedings: 'TRABALHO_EVENTO', conference: 'TRABALHO_EVENTO',
        incollection: 'CAPITULOS_LIVRO', inbook: 'CAPITULOS_LIVRO',
        book: 'LIVROS',
        techreport: 'RELATORIO_PESQUISA', unpublished: 'RELATORIO_PESQUISA',
        JOUR: 'ARTIGO_PERIODICO',
        CONF: 'TRABALHO_EVENTO', CPAPER: 'TRABALHO_EVENTO',
        CHAP: 'CAPITULOS_LIVRO',
        BOOK: 'LIVROS',
        RPRT: 'RELATORIO_PESQUISA',
    };
    // Converte uma entrada normalizada (window.LzBibRis) num item do lattesZen,
    // preenchendo só os campos que o tipo mapeado realmente tem. Retorna null
    // quando o tipo original não tem mapeamento — a entrada vai para a lista
    // de ignorados em vez de cair num "catch-all" adivinhado.
    function bibEntryToItem(entrada) {
        const typeKey = BIB_RIS_TYPE_MAP[entrada.tipoOriginal];
        if (!typeKey) return null;
        const def = LattesTypes.getType(typeKey);
        const temCampo = (k) => def && def.fields.some((f) => f.key === k);
        const fields = {};
        if (entrada.titulo && temCampo('titulo')) fields.titulo = entrada.titulo;
        if (entrada.ano && temCampo('ano')) fields.ano = entrada.ano;
        if (entrada.doi && temCampo('doi')) fields.doi = entrada.doi;
        if (entrada.url && temCampo('url')) fields.url = entrada.url;
        if (entrada.periodico && temCampo('periodico')) fields.periodico = entrada.periodico;
        if (entrada.issn && temCampo('issn')) fields.issn = entrada.issn;
        if (entrada.isbn && temCampo('isbn')) fields.isbn = entrada.isbn;
        if (entrada.editora && temCampo('editora')) fields.editora = entrada.editora;
        if (entrada.volume) {
            if (temCampo('volume')) fields.volume = entrada.volume;
            else if (temCampo('numeroVolumes')) fields.numeroVolumes = entrada.volume;
        }
        if (entrada.fasciculo && temCampo('fasciculo')) fields.fasciculo = entrada.fasciculo;
        if (entrada.paginaInicial && temCampo('paginaInicial')) fields.paginaInicial = entrada.paginaInicial;
        if (entrada.paginaFinal && temCampo('paginaFinal')) fields.paginaFinal = entrada.paginaFinal;
        if (entrada.autores && entrada.autores.length) {
            if (temCampo('autoresLista')) fields.autoresLista = entrada.autores.map((nome) => ({ nomeCompleto: nome, nomeCitacao: '' }));
            else if (temCampo('autores')) fields.autores = entrada.autores.join('; ');
        }
        return { typeKey, categoryKey: LattesTypes.primaryCategory(typeKey), fields };
    }
    async function onBibFileSelected(e) {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const { formato, entradas } = window.LzBibRis.parse(text);
        if (formato === 'desconhecido') {
            $('#bibResult').innerHTML = `<p class="text-sm text-red-600 dark:text-red-400">Não foi possível reconhecer o formato do arquivo — confira se é um .bib (BibTeX) ou .ris (RIS) válido.</p>`;
            return;
        }
        const items = [], ignorados = [];
        entradas.forEach((entrada) => {
            const item = bibEntryToItem(entrada);
            if (item) items.push(item); else ignorados.push(entrada);
        });
        state.bibParsed = { items, ignorados, formato };
        renderBibResult(state.bibParsed);
    }
    function renderBibResult(parsed) {
        const { items, ignorados, formato } = parsed;
        const box = $('#bibResult');
        const avisoIgnorados = ignorados.length ? `
            <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3">
                <strong>${ignorados.length} entrada(s) sem tipo correspondente</strong> não entraram na lista abaixo (ex.: teses, dissertações, entradas "misc") — cadastre-as manualmente se quiser incluí-las:
                <ul class="list-disc list-inside mt-1">
                    ${ignorados.slice(0, 20).map((en) => `<li>${esc(en.titulo || '(sem título)')} <span class="text-xs opacity-75">(${esc(en.tipoOriginal)})</span></li>`).join('')}
                    ${ignorados.length > 20 ? `<li>… e mais ${ignorados.length - 20}.</li>` : ''}
                </ul>
            </div>` : '';
        if (!items.length) {
            box.innerHTML = avisoIgnorados || `<p class="text-sm text-gray-500 italic">Nenhuma entrada reconhecida nesse arquivo.</p>`;
            return;
        }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.items.some((x) => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = items.filter((it) => !isDup(it)).length;

        box.innerHTML = `
            ${avisoIgnorados}
            <div class="mb-3">
                <p class="text-sm mb-1">${items.length} obra(s) reconhecida(s) (${formato.toUpperCase()}) — <strong class="text-green-700 dark:text-green-400">${novos} novas</strong>, ${items.length - novos} já catalogada(s).</p>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnBibSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar novos</button>
                <button id="btnBibSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Todos</button>
                <button id="btnBibSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Nenhum</button>
                <button id="btnBibImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> Importar selecionados
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${items.map((it, idx) => {
                    const dup = isDup(it);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="bibchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || '(sem título)')}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? '· <em>já catalogado</em>' : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnBibSelNovos').addEventListener('click', () => $$('.bibchk').forEach((c) => { c.checked = !isDup(items[+c.dataset.idx]); }));
        $('#btnBibSelAll').addEventListener('click', () => $$('.bibchk').forEach((c) => c.checked = true));
        $('#btnBibSelNone').addEventListener('click', () => $$('.bibchk').forEach((c) => c.checked = false));
        $('#btnBibImport').addEventListener('click', importBibSelected);
    }
    async function importBibSelected() {
        const chosen = $$('.bibchk').filter((c) => c.checked).map((c) => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        const { items, formato } = state.bibParsed;
        const sigMap = existingSignatureMap();
        let n = 0, ignorados = 0;
        for (const idx of chosen) {
            const src = items[idx];
            const sig = itemSignature(src.typeKey, src.fields || {});
            if (sig && sigMap.has(sig)) { ignorados++; continue; } // já existe (mesma assinatura) — não duplica
            const item = {
                id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(),
                lattesItem: true, typeKey: src.typeKey, categoryKey: src.categoryKey,
                fields: src.fields, source: formato === 'ris' ? 'ris' : 'bibtex', lattesRef: null,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            await window.AppCore.persistItem(item);
            if (sig) sigMap.set(sig, item);
            n++;
        }
        toast(`${n} item(ns) importado(s)${ignorados ? ` — ${ignorados} já existente(s) ignorado(s)` : ''}.`, 'ok');
        renderBibResult(state.bibParsed);
        window.AppCore.renderItemList();
    }

    // Sentido inverso de BIB_RIS_TYPE_MAP — só os tipos que também são
    // reconhecidos na importação entram na exportação (round-trip simétrico).
    const TYPE_TO_BIB_RIS = {
        ARTIGO_PERIODICO: { bibtex: 'article', ris: 'JOUR' },
        TRABALHO_EVENTO: { bibtex: 'inproceedings', ris: 'CONF' },
        CAPITULOS_LIVRO: { bibtex: 'incollection', ris: 'CHAP' },
        LIVROS: { bibtex: 'book', ris: 'BOOK' },
        RELATORIO_PESQUISA: { bibtex: 'techreport', ris: 'RPRT' },
    };
    // Converte um item do lattesZen no registro normalizado que
    // window.LzBibRis.toBibTeX()/toRIS() sabem serializar. Retorna null para
    // tipos fora do mapeamento (não entram na exportação).
    function itemToBibRecord(item) {
        const map = TYPE_TO_BIB_RIS[item.typeKey];
        if (!map) return null;
        const f = item.fields || {};
        let autores = [];
        if (Array.isArray(f.autoresLista)) autores = f.autoresLista.map((a) => a.nomeCompleto).filter(Boolean);
        else if (f.autores) autores = String(f.autores).split(';').map((s) => s.trim()).filter(Boolean);
        return {
            tipoBibtex: map.bibtex, tipoRis: map.ris,
            titulo: f.titulo || '', autores, ano: f.ano || '',
            periodico: f.periodico || (item.typeKey === 'TRABALHO_EVENTO' ? f.anais : '') || '',
            issn: f.issn || '', isbn: f.isbn || '',
            volume: f.volume || f.numeroVolumes || '', fasciculo: f.fasciculo || '',
            paginaInicial: f.paginaInicial || '', paginaFinal: f.paginaFinal || '',
            editora: f.editora || '', doi: f.doi || '', url: f.url || '',
        };
    }
    function bibExportRecords() {
        return state.items.map(itemToBibRecord).filter(Boolean);
    }
    function baixarArquivoTexto(nome, texto) {
        const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
        URL.revokeObjectURL(a.href);
    }
    function wireBibExport() {
        const status = (t) => { const el = $('#bibExportStatus'); if (el) el.textContent = t; };
        const btnBib = $('#btnBibExportBib');
        if (btnBib) btnBib.addEventListener('click', () => {
            const registros = bibExportRecords();
            if (!registros.length) { status('Nenhuma publicação (artigo, livro, capítulo, trabalho em evento ou relatório) catalogada ainda.'); return; }
            baixarArquivoTexto(`publicacoes-${fileStamp()}.bib`, window.LzBibRis.toBibTeX(registros));
            status(`${registros.length} publicação(ões) exportada(s) em BibTeX.`);
        });
        const btnRis = $('#btnBibExportRis');
        if (btnRis) btnRis.addEventListener('click', () => {
            const registros = bibExportRecords();
            if (!registros.length) { status('Nenhuma publicação (artigo, livro, capítulo, trabalho em evento ou relatório) catalogada ainda.'); return; }
            baixarArquivoTexto(`publicacoes-${fileStamp()}.ris`, window.LzBibRis.toRIS(registros));
            status(`${registros.length} publicação(ões) exportada(s) em RIS.`);
        });
    }

    /* =====================================================================
       ABA: CONFIGURAÇÕES
       ===================================================================== */
    /* =====================================================================
       Dados gerais (perfil) — editados em Configurações
       ===================================================================== */
    function perfilCardHtml(tk) {
        const def = LattesTypes.get(tk);
        const item = state.items.find(i => i.typeKey === tk);
        const vals = item ? (item.fields || {}) : {};
        const resumo = item ? esc(LattesTypes.itemTitle(item)) : 'vazio';
        const isFoto = tk === 'FOTO_PERFIL';
        const fotoBlock = isFoto ? `
            <div>
                <label class="block text-xs font-semibold mb-1">Imagem (JPEG ou PNG)</label>
                <div class="flex items-center gap-2">
                    <input type="file" data-perfil-foto accept="image/jpeg,image/png"
                           class="flex-1 text-sm text-gray-600 dark:text-gray-300 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                    ${Storage.storageMode() === 'gdrive' ? `
                    <button type="button" data-perfil-foto-drive title="Abrir a pasta desta foto no Google Drive" class="shrink-0 w-9 h-9 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-brands fa-google-drive"></i>
                    </button>` : ''}
                </div>
                <img data-perfil-foto-preview class="mt-2 max-h-40 rounded border border-gray-200 dark:border-gray-700 hidden" alt="Foto de perfil">
            </div>` : '';
        return `<details class="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                <i aria-hidden="true" class="fa-solid ${item ? 'fa-circle-check text-green-600 dark:text-green-400' : 'fa-circle text-gray-300 dark:text-gray-600'} text-xs"></i>
                ${esc(def.label)}
                <span class="text-xs font-normal ${item ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} truncate min-w-0">· ${resumo}</span>
            </summary>
            <form data-perfil-form="${tk}" class="p-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
                ${fotoBlock}
                ${def.fields.map(f => fieldHtml(f, vals[f.key])).join('')}
                <div class="flex gap-2">
                    <button type="submit" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar</button>
                </div>
            </form>
        </details>`;
    }
    // Conta quantos itens de perfil de instância ÚNICA (cartões + Identidade/
    // Passaporte) já têm algo preenchido — vira o "X/N preenchidos" no
    // cabeçalho. Áreas de atuação e Documentos pessoais ficam de fora (são de
    // instância múltipla, já mostram sua própria contagem no acordeão deles).
    function perfilProgressCount() {
        const singleTypes = LattesTypes.perfilTypes().filter(k => k !== 'AREA_ATUACAO' && k !== 'DOCUMENTO_PESSOAL');
        const preenchidos = singleTypes.filter(tk => state.items.some(i => i.typeKey === tk)).length;
        return { preenchidos, total: singleTypes.length };
    }
    function perfilSectionHtml() {
        const { preenchidos, total } = perfilProgressCount();
        return `<section id="perfilSection" class="lg:col-span-2 scroll-mt-20 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                <i class="fa-solid fa-id-card text-govbr-600 dark:text-unifesp-400"></i> Dados gerais (perfil)
                <span class="text-sm font-normal text-gray-500">(${preenchidos}/${total} preenchidos)</span>
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Informações autodeclaradas do Currículo Lattes (Identificação, Foto, Endereço, Texto inicial, Outras informações, Áreas de atuação, Identidade, Passaporte e Documentos pessoais). São itens <strong>do Lattes</strong> — a maioria não exige evidência, exceto Identidade, Passaporte e Documentos pessoais.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                ${LattesTypes.perfilTypes().filter(k => k !== 'AREA_ATUACAO' && k !== 'DOCUMENTO_PESSOAL' && k !== 'DOC_IDENTIDADE' && k !== 'DOC_PASSAPORTE').map(perfilCardHtml).join('')}
                ${areaAtuacaoSectionHtml()}
                ${fixedDocCardHtml('DOC_IDENTIDADE')}
                ${fixedDocCardHtml('DOC_PASSAPORTE')}
                ${documentoPessoalSectionHtml()}
            </div>
        </section>`;
    }

    // Identidade (RG) / Passaporte: itens fixos (sempre presentes, não são
    // removíveis) dentro de Documentos pessoais — diferente da lista livre de
    // Documentos pessoais, cada um tem campos próprios e alimenta a
    // exportação Lattes (NUMERO-IDENTIDADE/ORGAO-EMISSOR/... e
    // NUMERO-DO-PASSAPORTE em DADOS-GERAIS). "Preencher"/"Editar" abrem o
    // formulário completo do Catalogar (com upload de evidência) e voltam
    // para Configurações ao salvar.
    function fixedDocCardHtml(tk) {
        const def = LattesTypes.get(tk);
        const item = state.items.find(i => i.typeKey === tk);
        const preenchido = !!item;
        const resumo = item ? esc(LattesTypes.itemTitle(item)) : 'vazio';
        return `<div class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
            <i aria-hidden="true" title="${item && evCount(item) ? 'Com evidência anexada' : 'Sem evidência anexada'}" class="fa-solid ${item && evCount(item) ? 'fa-paperclip text-green-600 dark:text-green-500' : 'fa-file-circle-xmark text-gray-400'} shrink-0"></i>
            <span class="flex-1 min-w-0 truncate">${esc(def.label)} <span class="text-xs font-normal ${preenchido ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} truncate">· ${resumo}</span></span>
            <button type="button" data-fixed-doc="${tk}" class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400 text-xs font-semibold shrink-0"><i class="fa-solid fa-pen mr-1"></i> ${preenchido ? 'Editar' : 'Preencher'}</button>
        </div>`;
    }

    // Documentos pessoais: outro tipo de perfil com VÁRIAS instâncias, mas que
    // (diferente de Áreas de atuação) usa evidência (o próprio anexo). Em vez
    // de reconstruir a interface de anexo, a mini-lista aqui só lista/edita/
    // remove; "Adicionar"/"Editar" abrem o formulário completo do Catalogar
    // (com upload de arquivo) e voltam para Configurações ao salvar.
    function documentoPessoalListHtml() {
        const itens = state.items.filter(i => i.typeKey === 'DOCUMENTO_PESSOAL');
        if (!itens.length) return `<p class="text-xs text-gray-400 dark:text-gray-500 italic">Nenhum documento cadastrado.</p>`;
        return `<ul class="space-y-1 mb-2">${itens.map(i => `
            <li class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm">
                <i aria-hidden="true" title="${evCount(i) ? 'Com evidência anexada' : 'Sem evidência anexada'}" class="fa-solid ${evCount(i) ? 'fa-paperclip text-green-600 dark:text-green-500' : 'fa-file-circle-xmark text-red-600 dark:text-red-500'} shrink-0"></i>
                <span class="flex-1 min-w-0 truncate">${esc(LattesTypes.itemTitle(i))}</span>
                <button type="button" data-doc-edit="${i.id}" title="Editar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                <button type="button" data-doc-del="${i.id}" title="Remover" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
            </li>`).join('')}</ul>`;
    }
    function documentoPessoalSectionHtml() {
        const def = LattesTypes.get('DOCUMENTO_PESSOAL');
        const n = state.items.filter(i => i.typeKey === 'DOCUMENTO_PESSOAL').length;
        return `<details class="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                ${esc(def.label)}
                <span id="documentoPessoalCount" class="text-xs font-normal text-gray-400 truncate min-w-0">· ${n} cadastrado${n === 1 ? '' : 's'}</span>
            </summary>
            <div class="p-3 space-y-2 border-t border-gray-100 dark:border-gray-700">
                <div id="documentoPessoalList">${documentoPessoalListHtml()}</div>
                <button type="button" id="btnAddDocumentoPessoal" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-plus mr-1"></i> Adicionar documento</button>
            </div>
        </details>`;
    }
    // Seleciona uma categoria no <select> do Catalogar mesmo quando ela foi
    // filtrada da lista visível (ex.: perfilOnly) — injeta a <option> que
    // falta antes de atribuir o valor (senão a atribuição é ignorada).
    function forceSelectCategoria(catKey) {
        const selCat = $('#selCategoria');
        if (!selCat) return;
        if (!selCat.querySelector(`option[value="${catKey}"]`)) {
            const opt = document.createElement('option');
            opt.value = catKey;
            opt.textContent = LattesTypes.categoryNumLabel(catKey);
            selCat.appendChild(opt);
        }
        selCat.value = catKey;
    }
    // Abre o item (novo ou existente) no formulário do Catalogar, forçando a
    // categoria/tipo indicado mesmo fora da lista de tipos visível (Documentos
    // pessoais/Identidade/Passaporte foram retirados de lá — só alcançáveis
    // por aqui). Ao salvar, volta a Configurações.
    function openPerfilDocForm(typeKey, item) {
        window.AppCore.switchTab('catalogar');
        buildForm(item, { focus: false });
        forceSelectCategoria(LattesTypes.primaryCategory(typeKey));
        if (state._selectTipo) state._selectTipo(typeKey);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function wireDocumentoPessoalListActions(sec) {
        const list = sec.querySelector('#documentoPessoalList');
        if (!list) return;
        $$('[data-doc-edit]', list).forEach(b => b.addEventListener('click', () => {
            const item = state.items.find(i => i.id === b.dataset.docEdit);
            if (item) openPerfilDocForm('DOCUMENTO_PESSOAL', item);
        }));
        $$('[data-doc-del]', list).forEach(b => b.addEventListener('click', async () => {
            const item = state.items.find(i => i.id === b.dataset.docDel);
            if (!item) return;
            if (!confirm(`Mover "${LattesTypes.itemTitle(item)}" para a lixeira? Pode ser restaurado depois em Configurações › Lixeira.`)) return;
            await window.AppCore.deleteItem(item.id);
            toast('Documento movido para a lixeira.', 'ok');
            refreshDocumentoPessoalList(sec);
            window.AppCore.renderItemList();
        }));
    }
    function refreshDocumentoPessoalList(sec) {
        const list = sec.querySelector('#documentoPessoalList');
        if (list) list.innerHTML = documentoPessoalListHtml();
        const n = state.items.filter(i => i.typeKey === 'DOCUMENTO_PESSOAL').length;
        const count = sec.querySelector('#documentoPessoalCount');
        if (count) count.textContent = `· ${n} cadastrado${n === 1 ? '' : 's'}`;
        wireDocumentoPessoalListActions(sec);
    }
    function wireDocumentoPessoalSection(sec) {
        const addBtn = sec.querySelector('#btnAddDocumentoPessoal');
        if (addBtn) addBtn.addEventListener('click', () => openPerfilDocForm('DOCUMENTO_PESSOAL', undefined));
        wireDocumentoPessoalListActions(sec);
    }
    // Botões "Preencher"/"Editar" dos itens fixos (Identidade/Passaporte)
    function wireFixedDocButtons(sec) {
        $$('[data-fixed-doc]', sec).forEach(b => b.addEventListener('click', () => {
            const tk = b.dataset.fixedDoc;
            openPerfilDocForm(tk, state.items.find(i => i.typeKey === tk));
        }));
    }

    // Áreas de atuação: único tipo de perfil com VÁRIAS instâncias — em vez do
    // cartão único (perfilCardHtml), mostra uma mini-lista com adicionar/
    // editar/remover, dentro de Configurações > Dados gerais.
    function areaAtuacaoListHtml() {
        const itens = state.items.filter(i => i.typeKey === 'AREA_ATUACAO');
        if (!itens.length) return `<p class="text-xs text-gray-400 dark:text-gray-500 italic">Nenhuma área cadastrada.</p>`;
        // Ordem manual (setas ▲▼): a tela real do Lattes deixa priorizar a ordem
        // de exibição das áreas de atuação — SEQUENCIA-AREA-DE-ATUACAO no XML
        // segue a ordem daqui.
        return `<ul class="space-y-1 mb-2">${itens.map((i, idx) => `
            <li class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm">
                <button type="button" data-area-up="${i.id}" title="Subir" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" data-area-down="${i.id}" title="Descer" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === itens.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <span class="flex-1 min-w-0 truncate">${esc(LattesTypes.itemTitle(i))}</span>
                <button type="button" data-area-edit="${i.id}" title="Editar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                <button type="button" data-area-del="${i.id}" title="Remover" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
            </li>`).join('')}</ul>`;
    }
    // Troca a posição de duas Áreas de atuação (mantém a ordem relativa dos
    // demais itens do catálogo — só troca os dois objetos de lugar).
    function moveAreaAtuacao(id, dir) {
        const areas = state.items.filter(i => i.typeKey === 'AREA_ATUACAO');
        const pos = areas.findIndex(i => i.id === id);
        const alvo = pos + dir;
        if (pos < 0 || alvo < 0 || alvo >= areas.length) return;
        const idxA = state.items.indexOf(areas[pos]), idxB = state.items.indexOf(areas[alvo]);
        const tmp = state.items[idxA]; state.items[idxA] = state.items[idxB]; state.items[idxB] = tmp;
        window.AppCore.saveCatalog();
    }
    function areaAtuacaoSectionHtml() {
        const def = LattesTypes.get('AREA_ATUACAO');
        const n = state.items.filter(i => i.typeKey === 'AREA_ATUACAO').length;
        return `<details class="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                ${esc(def.label)}
                <span id="areaAtuacaoCount" class="text-xs font-normal text-gray-400 truncate min-w-0">· ${n} cadastrada${n === 1 ? '' : 's'}</span>
            </summary>
            <div class="p-3 space-y-2 border-t border-gray-100 dark:border-gray-700">
                <div id="areaAtuacaoList">${areaAtuacaoListHtml()}</div>
                <form id="areaAtuacaoForm" class="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700" data-editing-id="">
                    ${def.fields.map(f => fieldHtml(f, '')).join('')}
                    <div class="flex items-center gap-2">
                        <button type="submit" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-plus mr-1"></i> <span id="areaAtuacaoSubmitLabel">Adicionar área</span></button>
                        <button type="button" id="areaAtuacaoCancel" class="hidden px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm">Cancelar edição</button>
                    </div>
                </form>
            </div>
        </details>`;
    }
    function areaAtuacaoResetForm(form) {
        form.dataset.editingId = '';
        wireAreaTree(form, {});
        const lbl = $('#areaAtuacaoSubmitLabel'); if (lbl) lbl.textContent = 'Adicionar área';
        const cancel = $('#areaAtuacaoCancel'); if (cancel) cancel.classList.add('hidden');
    }
    function refreshAreaAtuacaoList(sec) {
        const list = sec.querySelector('#areaAtuacaoList');
        if (list) list.innerHTML = areaAtuacaoListHtml();
        const n = state.items.filter(i => i.typeKey === 'AREA_ATUACAO').length;
        const count = sec.querySelector('#areaAtuacaoCount');
        if (count) count.textContent = `· ${n} cadastrada${n === 1 ? '' : 's'}`;
        wireAreaAtuacaoListActions(sec);
    }
    function wireAreaAtuacaoListActions(sec) {
        const list = sec.querySelector('#areaAtuacaoList');
        if (!list) return;
        $$('[data-area-up]', list).forEach(b => b.addEventListener('click', () => {
            moveAreaAtuacao(b.dataset.areaUp, -1);
            refreshAreaAtuacaoList(sec);
            window.AppCore.renderItemList();
        }));
        $$('[data-area-down]', list).forEach(b => b.addEventListener('click', () => {
            moveAreaAtuacao(b.dataset.areaDown, 1);
            refreshAreaAtuacaoList(sec);
            window.AppCore.renderItemList();
        }));
        $$('[data-area-edit]', list).forEach(b => b.addEventListener('click', () => {
            const item = state.items.find(i => i.id === b.dataset.areaEdit);
            if (!item) return;
            const form = sec.querySelector('#areaAtuacaoForm');
            form.dataset.editingId = item.id;
            wireAreaTree(form, item.fields || {});
            $('#areaAtuacaoSubmitLabel').textContent = 'Salvar alterações';
            $('#areaAtuacaoCancel').classList.remove('hidden');
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }));
        $$('[data-area-del]', list).forEach(b => b.addEventListener('click', async () => {
            const item = state.items.find(i => i.id === b.dataset.areaDel);
            if (!item) return;
            if (!confirm(`Mover "${LattesTypes.itemTitle(item)}" para a lixeira?`)) return;
            await window.AppCore.deleteItem(item.id);
            const form = sec.querySelector('#areaAtuacaoForm');
            if (form.dataset.editingId === item.id) areaAtuacaoResetForm(form);
            refreshAreaAtuacaoList(sec);
            window.AppCore.renderItemList();
        }));
    }
    function wireAreaAtuacaoSection(sec) {
        const form = sec.querySelector('#areaAtuacaoForm');
        if (!form) return;
        wireAreaTree(form, {});
        wireAreaAtuacaoListActions(sec);
        const cancelBtn = sec.querySelector('#areaAtuacaoCancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => areaAtuacaoResetForm(form));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const def = LattesTypes.get('AREA_ATUACAO');
            const fields = collectFields(form, def);
            const encResid = normalizeEncoding(fields); // compatibilidade ISO-8859-1
            if (!validateItemFields(def, fields, form)) return;

            const editingId = form.dataset.editingId;
            let item = editingId ? state.items.find(i => i.id === editingId) : null;
            if (!item) item = { id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), source: 'local', hasPdf: false, evidencias: [], pdfName: null, lattesRef: null };
            item.lattesItem = true;
            item.typeKey = 'AREA_ATUACAO';
            item.categoryKey = LattesTypes.primaryCategory('AREA_ATUACAO');
            item.fields = fields;
            item.updatedAt = window.AppCore.nowISO();

            await window.AppCore.persistItem(item);
            toast(editingId ? 'Área de atuação atualizada.' : 'Área de atuação adicionada.', 'ok');
            if (encResid) toast(`Atenção: ${encResid} caractere(s) fora do ISO-8859-1 permanecem (ex.: emoji).`, 'aviso');
            areaAtuacaoResetForm(form);
            refreshAreaAtuacaoList(sec);
            window.AppCore.renderItemList();
        });
    }

    /* ------------------------- Configuração do RSC ------------------------ */
    // Os dados funcionais do servidor (cargo, SIAPE, contatos etc.) ficam na
    // própria aba RSC (ver tab-rsc.js) — aqui só o habilitar/desabilitar do
    // módulo, pra não duplicar formulário em dois lugares diferentes.
    function rscSectionHtml() {
        return `<section id="rscSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-award text-govbr-600 dark:text-unifesp-400"></i> RSC-PCCTAE (opcional)</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Reconhecimento de Saberes e Competências (Decreto nº 13.048/2026). Quando habilitado, cada item elegível ganha uma camada com os dados do RSC, e surge a aba <strong>RSC</strong> (simulador) — os dados do servidor (cargo, SIAPE, contatos etc.) são preenchidos lá. Uso individual.</p>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="rscEnable" ${state.rscEnabled ? 'checked' : ''}>
                <span>Habilitar módulo <strong>RSC-PCCTAE</strong></span>
            </label>
        </section>`;
    }
    function wireRscConfig() {
        const en = $('#rscEnable'); if (!en) return;
        en.addEventListener('change', () => {
            state.rscEnabled = en.checked;
            const s = Storage.loadSettings(); s.rscEnabled = state.rscEnabled; Storage.saveSettings(s);
            window.AppCore.applyRscVisibility();
            toast(state.rscEnabled ? 'Módulo RSC habilitado.' : 'Módulo RSC desabilitado.', 'ok');
        });
    }
    // Duas listas configuráveis que a aba "Linha do tempo" usa para montar a
    // nuvem de palavras: palavras a excluir (nunca aparecem) e termos de mais
    // de uma palavra (ex.: "tech talks") que devem ser contados como um único
    // termo, em vez de "tech" e "talks" separados.
    function nuvemPalavrasSectionHtml() {
        return `
        <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-cloud text-govbr-600 dark:text-unifesp-400"></i> Nuvem de palavras</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Personalize a nuvem de palavras da aba <strong>Linha do tempo</strong>, montada a partir dos títulos, palavras-chave e área de conhecimento dos seus itens.</p>
            <div class="mb-3">
                <label class="block text-xs font-semibold mb-1" for="nuvemExclusaoInput">Palavras excluídas</label>
                <textarea id="nuvemExclusaoInput" rows="2" placeholder="Separe por ponto e vírgula (;), vírgula (,) ou uma por linha" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc((state.nuvemExclusao || []).join('; '))}</textarea>
                <p class="text-xs text-gray-500 mt-1">Termos que nunca devem aparecer na nuvem (ex.: uma sigla genérica, o nome da sua instituição). Separe por ponto e vírgula, vírgula ou quebra de linha.</p>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-semibold mb-1" for="nuvemCompostasInput">Palavras compostas</label>
                <textarea id="nuvemCompostasInput" rows="2" placeholder="Separe por ponto e vírgula (;), vírgula (,) ou uma por linha — ex.: tech talks; machine learning" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc((state.nuvemCompostas || []).join('; '))}</textarea>
                <p class="text-xs text-gray-500 mt-1">Termos de mais de uma palavra que devem aparecer juntos na nuvem (ex.: "tech talks"), em vez de contados palavra a palavra. Separe por ponto e vírgula, vírgula ou quebra de linha.</p>
            </div>
            <button id="btnSalvarNuvemListas" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar listas da nuvem</button>
        </section>`;
    }
    function wireNuvemPalavrasSection() {
        const btn = $('#btnSalvarNuvemListas'); if (!btn) return;
        // Aceita ponto e vírgula, vírgula OU quebra de linha como separador —
        // um usuário reportou que a lista "não reconfigurava" a nuvem porque
        // separou os termos por vírgula/linha em vez de ";"; como só ";" era
        // reconhecido, a entrada inteira virava um único "termo" gigante que
        // nunca batia com nenhuma palavra real da nuvem.
        const parseLista = (v) => v.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
        btn.addEventListener('click', () => {
            state.nuvemExclusao = parseLista($('#nuvemExclusaoInput').value);
            state.nuvemCompostas = parseLista($('#nuvemCompostasInput').value);
            const s = Storage.loadSettings();
            s.nuvemExclusao = state.nuvemExclusao;
            s.nuvemCompostas = state.nuvemCompostas;
            Storage.saveSettings(s);
            toast('Listas da nuvem de palavras salvas.', 'ok');
        });
    }
    function wirePerfilSection() {
        const sec = $('#perfilSection');
        if (!sec) return;
        // Vários cartões de perfil ficam abertos na mesma seção e vários tipos
        // reaproveitam as mesmas chaves de campo (ex.: "descricao" em Texto
        // inicial E em Outras informações) — por isso cada wiring roda
        // isolado POR FORMULÁRIO, nunca na seção inteira (senão o contador/
        // validador de um campo "vaza" para o campo de mesmo nome no outro
        // cartão, já que querySelector pega só o primeiro do documento).
        $$('[data-perfil-form]', sec).forEach(form => {
            wireValidators(form);
            wireCounters(form);
            wireDateBr(form);
            wireNA(form);
            wireConditional(form, LattesTypes.get(form.dataset.perfilForm));
            wireRepeater(form, LattesTypes.get(form.dataset.perfilForm));
        });
        $$('[data-perfil-foto]', sec).forEach(inp => inp.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const err = window.AppCore.checkEvidenceFile(f, ['jpg', 'jpeg', 'png']);
            if (err) { toast(err, 'aviso'); e.target.value = ''; return; }
            const prev = inp.parentElement.parentElement.querySelector('[data-perfil-foto-preview]');
            if (prev) { prev.src = URL.createObjectURL(f); prev.classList.remove('hidden'); }
        }));
        $$('[data-perfil-foto-drive]', sec).forEach(btn => btn.addEventListener('click', () => {
            const foto = state.items.find(i => i.typeKey === 'FOTO_PERFIL');
            const catKey = foto ? foto.categoryKey : LattesTypes.primaryCategory('FOTO_PERFIL');
            window.AppCore.openGDriveFolder(LattesTypes.categoryFolder(catKey));
        }));
        // Carrega a foto atual (se houver) no preview
        (async () => {
            const foto = state.items.find(i => i.typeKey === 'FOTO_PERFIL' && evCount(i));
            const prev = sec.querySelector('[data-perfil-foto-preview]');
            if (!foto || !prev) return;
            const ev = window.AppCore.evListFromItem(foto)[0];
            try {
                const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder('PERFIL_FOTOS'), ev.ext);
                if (url) { prev.src = url; prev.classList.remove('hidden'); }
            } catch (_) {}
        })();
        $$('[data-perfil-form]', sec).forEach(form => form.addEventListener('submit', onPerfilSubmit));
        wireAreaAtuacaoSection(sec);
        wireFixedDocButtons(sec);
        wireDocumentoPessoalSection(sec);
    }
    async function onPerfilSubmit(e) {
        e.preventDefault();
        const form = e.currentTarget;
        const tk = form.dataset.perfilForm;
        const def = LattesTypes.get(tk);
        const fields = collectFields(form, def);
        const encResid = normalizeEncoding(fields); // compatibilidade ISO-8859-1
        if (!validateItemFields(def, fields, form)) return;

        let item = state.items.find(i => i.typeKey === tk) || {
            id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), source: 'local', hasPdf: false, evidencias: [], pdfName: null, lattesRef: null,
        };
        item.lattesItem = true;              // mantém relacionado ao Lattes
        item.typeKey = tk;
        item.categoryKey = LattesTypes.primaryCategory(tk);
        item.fields = fields;
        item.updatedAt = window.AppCore.nowISO();

        // Foto de perfil: a imagem é o conteúdo do item (não uma comprovação)
        if (tk === 'FOTO_PERFIL') {
            const inp = form.querySelector('[data-perfil-foto]');
            const file = inp && inp.files[0];
            if (file) {
                const ext = window.AppCore.fileExt(file);
                item.evidencias = [{ basename: item.id, ext, name: file.name, publica: true }];
                item.hasPdf = true; item.fileExt = ext; item.pdfName = file.name;
                if (Storage.hasDirectory()) {
                    try { await Storage.writeAttachment(item.id, file, LattesTypes.categoryFolder(item.categoryKey), ext); }
                    catch (err) { toast('Falha ao gravar a imagem: ' + err.message, 'aviso'); }
                } else {
                    toast('Imagem não gravada: configure um diretório em Configurações.', 'aviso');
                }
            }
        }

        await window.AppCore.persistItem(item);
        toast(`${def.label} salvo.`, 'ok');
        if (encResid) toast(`Atenção: ${encResid} caractere(s) fora do ISO-8859-1 permanecem (ex.: emoji).`, 'aviso');
        render();
        window.AppCore.renderItemList();
    }

    // Grupos de Configurações — fonte única usada tanto pelos divisores
    // (cfgGroup) quanto pelo índice fixo (cfgIndexHtml), pra manter os dois
    // sempre em sincronia (mesma ordem, mesmo ícone, mesmo id de âncora).
    const CFG_GROUPS = [
        { id: 'grp-armazenamento', icon: 'fa-folder-tree', label: 'Armazenamento e backup' },
        { id: 'grp-perfil', icon: 'fa-id-card', label: 'Meu perfil' },
        { id: 'grp-fontes', icon: 'fa-arrow-right-arrow-left', label: 'Trazer e levar dados' },
        { id: 'grp-opcionais', icon: 'fa-puzzle-piece', label: 'Recursos opcionais' },
        { id: 'grp-avancado', icon: 'fa-sliders', label: 'Avançado' },
        { id: 'grp-lixeira', icon: 'fa-trash-can', label: 'Lixeira' },
        { id: 'grp-sobre', icon: 'fa-circle-info', label: 'Sobre e suporte' },
        { id: 'grp-risco', icon: 'fa-triangle-exclamation', label: 'Zona de risco' },
    ];
    // Cabeçalho de grupo das Configurações (divisor de seções) — recebe uma
    // entrada de CFG_GROUPS. O id vira âncora do índice fixo (scrollIntoView).
    function cfgGroup(g) {
        return `<h2 id="${g.id}" class="lg:col-span-2 scroll-mt-20 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 pt-3 pb-1 border-b border-gray-200 dark:border-gray-700"><i class="fa-solid ${g.icon}"></i> ${esc(g.label)}</h2>`;
    }

    // Índice fixo (sticky) com os 8 grupos — fica grudado no topo enquanto o
    // usuário rola a aba, com destaque (scrollspy) do grupo visível no
    // momento. Clicar rola suavemente até o grupo.
    function cfgIndexHtml() {
        return `
        <nav aria-label="Índice de Configurações" class="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-2">
            <div class="flex gap-1.5 overflow-x-auto">
                ${CFG_GROUPS.map(g => `
                    <a href="#${g.id}" data-cfg-index="${g.id}" class="cfg-index-link shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-govbr-600 dark:hover:border-unifesp-400 hover:text-govbr-600 dark:hover:text-unifesp-400 whitespace-nowrap">
                        <i aria-hidden="true" class="fa-solid ${g.icon}"></i> ${esc(g.label)}
                    </a>`).join('')}
            </div>
        </nav>`;
    }

    // Um item do card-resumo (checklist) do topo da aba: mostra estado
    // (ok/aviso/informativo) + detalhe, e é clicável (mesma âncora do índice).
    function statusItemHtml(tone, icon, label, detail, anchor) {
        const toneClasses = {
            ok: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
            warn: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
            info: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
        };
        const iconEl = tone === 'ok'
            ? '<i aria-hidden="true" class="fa-solid fa-circle-check text-green-600 dark:text-green-400"></i>'
            : `<i aria-hidden="true" class="fa-solid ${icon} ${tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-govbr-600 dark:text-unifesp-400'}"></i>`;
        return `<a href="#${anchor}" data-cfg-index="${anchor}" class="flex items-center gap-2 px-3 py-2 rounded-lg border ${toneClasses[tone]} text-sm hover:brightness-95 dark:hover:brightness-125 transition">
            ${iconEl}
            <span class="min-w-0"><strong class="block">${esc(label)}</strong><span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${esc(detail)}</span></span>
        </a>`;
    }
    // Card-resumo no topo da aba: dá uma visão de status em segundos, sem
    // abrir nada — diretório configurado?, perfil quanto preenchido?, backup
    // em dia? Cada item já é um atalho pra seção correspondente.
    function statusChecklistHtml(dirName, storageMode) {
        const { preenchidos, total } = perfilProgressCount();
        const sinceBackup = (Storage.loadSettings() || {}).sinceBackup || 0;
        const dirDetail = dirName ? `${storageMode === 'gdrive' ? 'Google Drive' : 'Pasta local'} — ${dirName}` : 'Não configurado ainda';
        const backupDetail = sinceBackup ? `${sinceBackup} alteraç${sinceBackup === 1 ? 'ão' : 'ões'} desde o último backup` : 'Em dia — sem alterações desde o último backup';
        return `
        <section aria-label="Resumo da configuração" class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            ${statusItemHtml(dirName ? 'ok' : 'warn', 'fa-folder-open', 'Diretório', dirDetail, 'dirSection')}
            ${statusItemHtml('info', 'fa-id-card', 'Perfil', `${preenchidos}/${total} preenchidos`, 'perfilSection')}
            ${statusItemHtml(sinceBackup >= 10 ? 'warn' : 'ok', 'fa-clock-rotate-left', 'Backup', backupDetail, 'backupSection')}
        </section>`;
    }
    // Rola suavemente até a âncora (grupo do índice ou item do checklist) e
    // destaca o grupo correspondente no índice enquanto o usuário rola a aba.
    let cfgIndexObserver = null;
    function wireCfgIndex() {
        $$('[data-cfg-index]').forEach(a => a.addEventListener('click', (e) => {
            e.preventDefault();
            const el = document.getElementById(a.dataset.cfgIndex);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }));
        const links = $$('.cfg-index-link');
        if (!links.length) return;
        const ACTIVE = ['bg-govbr-600', 'dark:bg-unifesp-700', 'text-white', 'border-govbr-600', 'dark:border-unifesp-700'];
        const INACTIVE = ['text-gray-600', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-600'];
        const setActive = (id) => links.forEach(a => {
            const on = a.dataset.cfgIndex === id;
            ACTIVE.forEach(c => a.classList.toggle(c, on));
            INACTIVE.forEach(c => a.classList.toggle(c, !on));
        });
        setActive(links[0].dataset.cfgIndex);
        if (cfgIndexObserver) cfgIndexObserver.disconnect();
        if (!('IntersectionObserver' in window)) return;
        const headers = CFG_GROUPS.map(g => document.getElementById(g.id)).filter(Boolean);
        cfgIndexObserver = new IntersectionObserver((entries) => {
            const visible = entries.filter(e => e.isIntersecting);
            if (!visible.length) return;
            const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
            setActive(topMost.target.id);
        }, { rootMargin: '-96px 0px -75% 0px', threshold: 0 });
        headers.forEach(h => cfgIndexObserver.observe(h));
    }

    // Uma linha da lista da Lixeira: título, categoria, há quantos dias foi
    // excluído, e os botões de Restaurar / Excluir definitivamente.
    function trashItemRowHtml(item) {
        const dias = Math.max(0, Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86400000));
        return `<li class="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
            <div class="min-w-0">
                <div class="font-medium truncate">${esc(LattesTypes.itemTitle(item))}</div>
                <div class="text-xs text-gray-500">${esc(LattesTypes.categoryLabel(item.categoryKey))} · excluído há ${dias} dia${dias === 1 ? '' : 's'}</div>
            </div>
            <div class="flex gap-1.5 shrink-0">
                <button data-restaurar="${item.id}" class="px-2.5 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-xs whitespace-nowrap"><i class="fa-solid fa-rotate-left mr-1"></i> Restaurar</button>
                <button data-purgar="${item.id}" class="px-2.5 py-1.5 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs whitespace-nowrap"><i class="fa-solid fa-trash mr-1"></i> Excluir definitivamente</button>
            </div>
        </li>`;
    }
    function lixeiraSectionHtml() {
        return `
            <section class="lg:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i class="fa-solid fa-trash-can text-govbr-600 dark:text-unifesp-400"></i> Lixeira <span class="text-sm font-normal text-gray-500">(${state.trash.length})</span>
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Itens excluídos ficam aqui por até ${window.AppCore.TRASH_RETENTION_DIAS} dias antes de serem removidos definitivamente. Os arquivos (quando há diretório configurado) vão para a pasta “${esc(LattesTypes.lixeiraFolder())}”, não são apagados na hora.</p>
                ${state.trash.length ? `
                <div class="flex justify-end mb-2">
                    <button id="btnEsvaziarLixeira" class="px-3 py-1.5 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs"><i class="fa-solid fa-trash mr-1"></i> Esvaziar lixeira</button>
                </div>
                <ul class="space-y-2">${state.trash.map(trashItemRowHtml).join('')}</ul>` : `
                <p class="text-sm text-gray-500 italic">A lixeira está vazia.</p>`}
            </section>`;
    }
    function wireLixeiraSection() {
        $$('[data-restaurar]').forEach(b => b.addEventListener('click', async () => {
            await window.AppCore.restoreItem(b.dataset.restaurar);
            toast('Item restaurado.', 'ok');
            window.AppCore.renderItemList();
            render();
        }));
        $$('[data-purgar]').forEach(b => b.addEventListener('click', async () => {
            const item = state.trash.find(i => i.id === b.dataset.purgar);
            if (item && !confirm(`Excluir definitivamente "${LattesTypes.itemTitle(item)}"? Esta ação não pode ser desfeita.`)) return;
            await window.AppCore.purgeTrashItem(b.dataset.purgar);
            toast('Item excluído definitivamente.', 'ok');
            render();
        }));
        const btnEmpty = $('#btnEsvaziarLixeira');
        if (btnEmpty) btnEmpty.addEventListener('click', async () => {
            if (!confirm(`Excluir definitivamente os ${state.trash.length} item(ns) da lixeira? Esta ação não pode ser desfeita.`)) return;
            await window.AppCore.emptyTrash();
            toast('Lixeira esvaziada.', 'ok');
            render();
        });
    }

    async function render() {
        window.AppCore.updateHeaderIdentity(); // reflete edições no nome (Identificação, import, limpar catálogo…)
        const panel = $('#tab-config');
        const dirName = Storage.hasDirectory() ? await Storage.directoryName() : null;
        const storageMode = Storage.storageMode();
        // Reconfere a saúde da pasta (silencioso) toda vez que a aba é aberta,
        // pra manter o status em dia sem precisar clicar em "Verificar pasta".
        if (Storage.hasDirectory()) await window.AppCore.checkDirHealth();

        // Sem diretório configurado ainda: assistente guiado (passo a passo)
        // em vez da parede de botões — pergunta primeiro configuração ou já
        // tem um diretório, depois local ou remoto, só então mostra a ação
        // certa. Com um diretório já ativo, pula direto pro painel de estado
        // (pasta atual + botões de gerenciar), como sempre foi.
        const semDiretorio = !Storage.hasDirectory();
        const modoBtn = (val, label) => `<button type="button" data-wizard-modo="${val}" class="px-3 py-2 rounded text-sm border ${dirWizardModo === val ? 'bg-govbr-600 dark:bg-unifesp-700 text-white border-govbr-600 dark:border-unifesp-700' : 'border-gray-300 dark:border-gray-600'}">${esc(label)}</button>`;
        const tipoBtn = (val, label) => `<button type="button" data-wizard-tipo="${val}" class="px-3 py-2 rounded text-sm border ${dirWizardTipo === val ? 'bg-govbr-600 dark:bg-unifesp-700 text-white border-govbr-600 dark:border-unifesp-700' : 'border-gray-300 dark:border-gray-600'}">${esc(label)}</button>`;

        let dirSectionHtml;
        if (semDiretorio) {
            let html = `
                <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-sm font-bold mb-1">1. Prefixo do identificador dos arquivos</h3>
                    <p class="text-xs text-gray-500 mb-2">Os arquivos são nomeados como <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">prefixo-XXX.pdf</code> (3 alfanuméricos). Prefixo de até 3 caracteres (letras minúsculas/números). Só precisa definir uma vez — depois de configurar o diretório, esta opção some daqui.</p>
                    <div class="flex items-center gap-2">
                        <input id="idPrefix" type="text" maxlength="3" value="${esc(state.idPrefix)}" class="w-20 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono">
                        <span class="text-xs text-gray-500">Exemplo: <code id="idPrefixEx" class="bg-gray-200 dark:bg-gray-700 px-1 rounded">${esc(state.idPrefix)}-k7p</code></span>
                        <button id="btnSavePrefix" class="ml-auto px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar prefixo</button>
                    </div>
                </div>
                <div class="mb-3">
                    <p class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">2. Isto é uma primeira configuração, ou você já tem um diretório (local ou no Drive) com itens?</p>
                    <div class="flex flex-wrap gap-2">
                        ${modoBtn('novo', 'Primeira configuração')}
                        ${modoBtn('existente', 'Já tenho um diretório')}
                    </div>
                </div>`;
            if (dirWizardModo) {
                html += `
                <div class="mb-3">
                    <p class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">3. Onde ficam os arquivos?</p>
                    <div class="flex flex-wrap gap-2">
                        ${tipoBtn('local', 'Pasta no computador')}
                        ${tipoBtn('remoto', 'Google Drive')}
                    </div>
                </div>`;
            }
            if (dirWizardModo && dirWizardTipo === 'local') {
                html += `
                <div class="flex flex-wrap gap-2">
                    <button id="btnChooseDir" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${Storage.supportsFS ? '' : 'disabled'}><i class="fa-solid fa-folder mr-1"></i> Escolher pasta</button>
                    ${dirWizardModo === 'existente' ? `<button id="btnSync" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-rotate mr-1"></i> Sincronizar do diretório</button>` : ''}
                </div>
                ${Storage.supportsFS ? '' : '<p class="text-xs text-red-600 font-semibold mt-1">Seu navegador não suporta esta função — use Chrome ou Edge.</p>'}`;
            }
            if (dirWizardModo && dirWizardTipo === 'remoto') {
                html += `
                <div class="flex flex-wrap gap-2 mb-2">
                    <input id="gdrivePasta" type="text" placeholder="Pasta (ex.: lattesZen)" value="lattesZen" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                </div>
                <p class="text-xs text-gray-500 mb-2">
                    O lattesZen só acessa os arquivos que ele mesmo cria (escopo <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">drive.file</code>) — nunca o restante do seu Drive.
                    ${APP_CONFIG.googleDriveClientId ? '' : '<span class="text-red-600 font-semibold">Recurso ainda não configurado neste site (falta o Client ID do Google Cloud Console em config.js).</span>'}
                </p>
                <div class="flex flex-wrap gap-2">
                    <button id="btnGDriveConnect" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${APP_CONFIG.googleDriveClientId ? '' : 'disabled'}><i class="fa-brands fa-google mr-1"></i> Conectar ao Google Drive</button>
                    ${dirWizardModo === 'existente' ? `<button id="btnGDriveMigrate" class="px-3 py-2 rounded border border-govbr-600 dark:border-unifesp-400 text-govbr-700 dark:text-unifesp-300 text-sm" ${APP_CONFIG.googleDriveClientId ? '' : 'disabled'}><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Migrar meus arquivos e conectar</button>` : ''}
                </div>
                ${dirWizardModo === 'existente' ? `<p class="text-xs text-gray-500 mt-1">"Migrar meus arquivos e conectar" pede pra você escolher a pasta local atual e copia tudo pro Drive antes de trocar. "Conectar" sozinho começa com uma pasta vazia no Drive.</p>` : ''}
                <div id="gdriveStatus" class="text-sm mt-2"></div>`;
            }
            dirSectionHtml = html;
        } else {
            // Com um diretório já configurado (local ou Google Drive), a seção
            // "Armazenamento remoto (Google Drive)" não aparece mais aqui —
            // só faz sentido no assistente, antes de configurar (ou depois de
            // "Esquecer pasta"). "Pasta atual" já indica qual back-end está
            // em uso; pra trocar, o caminho é "Esquecer pasta" e refazer o
            // assistente (inclusive pra migrar arquivos locais pro Drive).
            dirSectionHtml = `
                <p class="text-sm mb-1">Pasta atual: <strong id="dirNameLbl">${esc(dirName)}</strong></p>
                <p class="text-sm mb-3" id="dirHealthStatus">${window.AppCore.dirHealthStatusHtml()}</p>
                <div class="flex flex-wrap gap-2">
                    <button id="btnChooseDir" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${Storage.supportsFS ? '' : 'disabled'}><i class="fa-solid fa-folder mr-1"></i> Escolher pasta</button>
                    <button id="btnSync" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-rotate mr-1"></i> Sincronizar do diretório</button>
                    <button id="btnCheckDir" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-stethoscope mr-1"></i> Verificar pasta</button>
                </div>`;
        }

        panel.innerHTML = `
            <div class="space-y-6">
                ${cfgIndexHtml()}
                ${statusChecklistHtml(dirName, storageMode)}

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                ${cfgGroup(CFG_GROUPS[0])}
                <section id="dirSection" class="scroll-mt-20 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-folder-open text-govbr-600 dark:text-unifesp-400"></i> Diretório de armazenamento</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Cada item catalogado é salvo aqui como <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.pdf</code> +
                        <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.json</code>.
                        ${Storage.supportsFS ? '' : '<span class="text-red-600 font-semibold">Seu navegador não suporta esta função — use Chrome ou Edge.</span>'}
                    </p>
                    ${dirSectionHtml}
                    ${gdriveMigrationNotice ? `<div id="gdriveMigrationNotice" class="text-sm mt-3 p-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i> ${esc(gdriveMigrationNotice)}
                        <button id="btnDismissGDriveNotice" class="block mt-1 text-xs underline">Entendi, dispensar</button>
                    </div>` : ''}
                    <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button id="btnForget" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-link-slash mr-1"></i> Esquecer pasta</button>
                    </div>
                </section>

                <section id="backupSection" class="scroll-mt-20 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-file-export text-govbr-600 dark:text-unifesp-400"></i> Backup (JSON)</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Exporte ou importe todo o catálogo (metadados) e as configurações do sistema (prefixo do identificador, listas de autocomplete, RSC-PCCTAE) num único arquivo JSON — é o que permite restaurar tudo num navegador novo. Com um diretório configurado, o backup é salvo automaticamente na subpasta <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">Cópia de segurança</code>.</p>
                    <div class="flex flex-wrap gap-2">
                        <button id="btnExport" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Exportar catálogo</button>
                        <label class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm cursor-pointer"><i class="fa-solid fa-upload mr-1"></i> Importar catálogo
                            <input type="file" id="importJson" accept="application/json" class="hidden">
                        </label>
                    </div>
                </section>

                ${cfgGroup(CFG_GROUPS[1])}
                ${perfilSectionHtml()}

                ${cfgGroup(CFG_GROUPS[2])}
                ${lattesXmlSectionHtml()}
                ${orcidImportSectionHtml()}
                ${bibImportSectionHtml()}

                ${cfgGroup(CFG_GROUPS[3])}
                ${rscSectionHtml()}
                ${nuvemPalavrasSectionHtml()}

                ${cfgGroup(CFG_GROUPS[4])}
                <details class="lg:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <summary class="text-lg font-bold mb-2 flex items-center gap-2 cursor-pointer select-none">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-sm text-gray-400"></i>
                        <i class="fa-solid fa-list-check text-govbr-600 dark:text-unifesp-400"></i> Listas de autocomplete
                    </summary>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Listas de sugestões dos campos (Instituições, Financiadores/Agências, etc.). Valores já usados no catálogo
                        aparecem automaticamente. Estas listas são <strong>apenas para visualização</strong> — a única forma de
                        alterá-las é a função <strong>Renomear em todos os itens</strong>, garantindo consistência com os itens já lançados.
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-start gap-2">
                        <i aria-hidden="true" class="fa-solid fa-wand-magic-sparkles text-govbr-600 dark:text-unifesp-400 mt-0.5"></i>
                        <span>Para <strong>corrigir/normalizar</strong> um valor (ex.: padronizar o nome de uma instituição), use
                        <strong>Renomear em todos os itens</strong> dentro de cada lista: o novo valor é aplicado a todos os itens que
                        usam o antigo, e os arquivos JSON no diretório são regravados.</span>
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                        ${AUTOCOMPLETE_KEYS.map(k => `
                            <details class="border border-gray-200 dark:border-gray-700 rounded">
                                <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                                    ${esc(VOCAB_LABELS[k] || k)}
                                    <span class="text-xs font-normal text-gray-500">(${collectSuggestions(k).length})</span>
                                </summary>
                                <div class="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-900/40">
                                    <p class="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                                        <i aria-hidden="true" class="fa-solid fa-arrows-turn-right mr-1"></i> Renomear em todos os itens
                                    </p>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <select data-renfrom="${k}" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 flex-1 min-w-[10rem]">
                                            <option value="">— valor atual —</option>
                                            ${collectSuggestions(k).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
                                        </select>
                                        <span class="text-gray-400" aria-hidden="true">→</span>
                                        <input type="text" data-rento="${k}" placeholder="Novo valor (normalizado)" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 flex-1 min-w-[10rem]">
                                        <button type="button" data-rename="${k}" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm whitespace-nowrap disabled:opacity-40" disabled>Aplicar</button>
                                    </div>
                                    <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1" data-rencount="${k}"></p>
                                </div>
                                <div class="p-2">
                                    <p class="text-[11px] text-gray-400 dark:text-gray-500 mb-1"><i aria-hidden="true" class="fa-solid fa-eye mr-1"></i> Somente leitura — use “Renomear” acima para alterar.</p>
                                    <textarea id="vocab-${k}" rows="6" readonly tabindex="-1" aria-label="Sugestões de ${esc(VOCAB_LABELS[k] || k)} (somente leitura)" class="w-full text-sm px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono cursor-default resize-none focus:outline-none">${esc(collectSuggestions(k).join('\n'))}</textarea>
                                </div>
                            </details>`).join('')}
                    </div>
                </details>

                ${cfgGroup(CFG_GROUPS[5])}
                ${lixeiraSectionHtml()}

                ${cfgGroup(CFG_GROUPS[6])}
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-circle-info text-govbr-600 dark:text-unifesp-400"></i> Sobre o lattesZen</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Versão <span class="font-mono">${esc(APP_CONFIG.version)}</span> — veja o que mudou em cada versão nas <a href="notas-de-versao.html" target="_blank" rel="noopener" class="text-govbr-600 dark:text-unifesp-400 underline">notas de versão</a>. Precisa de ajuda? Confira a <a href="ajuda.html" target="_blank" rel="noopener" class="text-govbr-600 dark:text-unifesp-400 underline">página de Ajuda</a>.</p>
                </section>

                ${cfgGroup(CFG_GROUPS[7])}
                <section class="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <button id="btnClear" class="px-3 py-2 rounded bg-red-600 text-white text-sm"><i class="fa-solid fa-trash mr-1"></i> Limpar catálogo (índice local)</button>
                </section>
                </div>
            </div>`;

        wireCfgIndex();
        wirePerfilSection();
        wireRscConfig();
        wireNuvemPalavrasSection();
        wireExportLattes();
        wireLixeiraSection();
        wireOrcidImport();
        $('#bibInput').addEventListener('change', onBibFileSelected);
        wireBibExport();
        $('#xmlInput').addEventListener('change', onXmlSelected);
        const idPrefixInput = $('#idPrefix');
        if (idPrefixInput) idPrefixInput.addEventListener('input', (e) => {
            $('#idPrefixEx').textContent = `${window.AppCore.sanitizePrefix(e.target.value)}-k7p`;
        });
        const btnSavePrefix = $('#btnSavePrefix');
        if (btnSavePrefix) btnSavePrefix.addEventListener('click', () => {
            state.idPrefix = window.AppCore.sanitizePrefix($('#idPrefix').value);
            const s = Storage.loadSettings(); s.idPrefix = state.idPrefix; Storage.saveSettings(s);
            toast(`Prefixo definido: "${state.idPrefix}". Novos arquivos: ${state.idPrefix}-XXX.`, 'ok');
            render();
        });
        const btnChooseDir = $('#btnChooseDir');
        if (btnChooseDir) btnChooseDir.addEventListener('click', async () => {
            try {
                await Storage.chooseDirectory();
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
                try { await Storage.ensureInbox(); } catch (_) {}      // cria "Caixa de Entrada" / "00 Processado"
                state.dirHealth = null; // acabou de ser escolhida; revalidada no próximo render
                // Sincroniza na hora: se a pasta já tinha itens (ex.: pasta de
                // outro computador, ou reconfigurando após limpar o navegador),
                // o catálogo local não precisa esperar um clique extra em
                // "Sincronizar do diretório" pra aparecer.
                let msg = 'Diretório configurado (estrutura de pastas criada).';
                try {
                    const { encontrados } = await window.AppCore.syncFromDirectory();
                    msg += encontrados
                        ? ` ${encontrados} item(ns) já cadastrado(s) na pasta foram sincronizados automaticamente.`
                        : ' Pasta vazia — pronta para uso.';
                } catch (_) {}
                toast(msg, 'ok');
                window.AppCore.renderItemList();
                render();
            } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'erro'); }
        });
        const btnSync = $('#btnSync');
        if (btnSync) btnSync.addEventListener('click', async () => {
            try {
                const { encontrados } = await window.AppCore.syncFromDirectory();
                toast(`${encontrados} arquivo(s) .json lido(s) do diretório.`, 'ok');
                window.AppCore.renderItemList();
            } catch (e) { toast(e.message, 'erro'); }
        });
        $('#btnForget').addEventListener('click', async () => {
            await Storage.forgetDirectory();
            state.dirHealth = null;
            dirWizardModo = null; dirWizardTipo = null; // volta o assistente pro início
            window.AppCore.renderDirBanner();
            toast('Pasta esquecida — escolha um novo diretório ou pasta no Drive abaixo.', 'ok');
            render();
        });
        $$('[data-wizard-modo]').forEach(btn => {
            btn.addEventListener('click', () => { dirWizardModo = btn.dataset.wizardModo; dirWizardTipo = null; render(); });
        });
        $$('[data-wizard-tipo]').forEach(btn => {
            btn.addEventListener('click', () => { dirWizardTipo = btn.dataset.wizardTipo; render(); });
        });
        const btnCheckDir = $('#btnCheckDir');
        if (btnCheckDir) btnCheckDir.addEventListener('click', async () => {
            await window.AppCore.checkDirHealth({ requestIfNeeded: true });
            if (state.dirHealth && state.dirHealth.ok) toast('Pasta acessível.', 'ok');
            else toast('Não foi possível acessar a pasta — verifique se ela ainda existe e se a permissão foi concedida.', 'erro');
            render();
        });
        const btnGDriveConnect = $('#btnGDriveConnect');
        if (btnGDriveConnect) btnGDriveConnect.addEventListener('click', async () => {
            const pasta = $('#gdrivePasta').value.trim() || 'lattesZen';
            const statusEl = $('#gdriveStatus');
            btnGDriveConnect.disabled = true;
            if (statusEl) statusEl.innerHTML = '<span class="text-gray-500">Conectando… (autorize na janela do Google)</span>';
            try {
                await Storage.connectGoogleDrive({ pasta });
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
                try { await Storage.ensureInbox(); } catch (_) {}      // cria "Caixa de Entrada" / "Processados"
                state.dirHealth = null; // acabou de conectar; revalidada no próximo render
                let msg = 'Conectado ao Google Drive (estrutura de pastas criada).';
                try {
                    const { encontrados } = await window.AppCore.syncFromDirectory();
                    msg += encontrados
                        ? ` ${encontrados} item(ns) já cadastrado(s) na pasta foram sincronizados automaticamente.`
                        : ' Pasta vazia — pronta para uso.';
                } catch (_) {}
                toast(msg, 'ok');
                window.AppCore.renderItemList();
                render();
            } catch (e) {
                if (statusEl) statusEl.innerHTML = `<span class="text-red-700 dark:text-red-400"><i aria-hidden="true" class="fa-solid fa-triangle-exclamation mr-1"></i> ${esc(e.message)}</span>`;
                toast('Falha ao conectar: ' + e.message, 'erro');
                btnGDriveConnect.disabled = false;
            }
        });
        const btnGDriveMigrate = $('#btnGDriveMigrate');
        if (btnGDriveMigrate) btnGDriveMigrate.addEventListener('click', async () => {
            const aviso = 'Isso copia TODOS os arquivos da pasta local atual para uma pasta no seu Google Drive (a pasta local não é apagada durante a cópia).\n\n' +
                'Ao terminar, o lattesZen passa a usar o Google Drive — TODAS as atualizações futuras (novos itens, edições, anexos) vão para lá, não mais para a pasta local.\n\n' +
                'Depois de conferir que os arquivos foram copiados corretamente, você pode excluir a pasta local com segurança.\n\n' +
                'Deseja continuar?';
            if (!confirm(aviso)) return;
            const pasta = $('#gdrivePasta').value.trim() || 'lattesZen';
            const statusEl = $('#gdriveStatus');
            btnGDriveMigrate.disabled = true;
            if (btnGDriveConnect) btnGDriveConnect.disabled = true;
            try {
                // No assistente (sem diretório ativo ainda), "Migrar meus
                // arquivos e conectar" ainda não tem uma pasta local pra
                // migrar — pede pra escolher agora, antes de conectar.
                if (!Storage.hasDirectory()) {
                    if (statusEl) statusEl.innerHTML = '<span class="text-gray-500">Escolha a pasta local com os seus arquivos…</span>';
                    await Storage.chooseDirectory();
                }
                if (statusEl) statusEl.innerHTML = '<span class="text-gray-500">Conectando… (autorize na janela do Google)</span>';
                await Storage.connectGoogleDrive({ pasta });
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
                try { await Storage.ensureInbox(); } catch (_) {}      // cria "Caixa de Entrada" / "Processados"
                if (statusEl) statusEl.innerHTML = '<span class="text-gray-500">Copiando arquivos da pasta local para o Google Drive…</span>';
                const copiados = await Storage.migrateLocalToGoogleDrive((n, name) => {
                    if (statusEl) statusEl.innerHTML = `<span class="text-gray-500">Copiando arquivos… (${n} até agora — ${esc(name)})</span>`;
                });
                state.dirHealth = null; // acabou de trocar de armazenamento; revalidada no próximo render
                let msg = `Migração concluída: ${copiados} arquivo(s) copiado(s) para o Google Drive.`;
                try {
                    const { encontrados } = await window.AppCore.syncFromDirectory();
                    if (encontrados) msg += ` ${encontrados} item(ns) sincronizado(s).`;
                } catch (_) {}
                toast(msg, 'ok');
                gdriveMigrationNotice = 'Migração concluída. A partir de agora, todas as atualizações do lattesZen ocorrem no Google Drive — a pasta local não será mais usada pelo app. Confira na pasta do Drive se os arquivos foram copiados corretamente; depois disso, a pasta local pode ser excluída com segurança.';
                window.AppCore.renderItemList();
                render();
            } catch (e) {
                if (e.name === 'AbortError') { btnGDriveMigrate.disabled = false; if (btnGDriveConnect) btnGDriveConnect.disabled = false; return; } // cancelou o seletor de pasta
                if (statusEl) statusEl.innerHTML = `<span class="text-red-700 dark:text-red-400"><i aria-hidden="true" class="fa-solid fa-triangle-exclamation mr-1"></i> ${esc(e.message)}</span>`;
                toast('Falha na migração: ' + e.message, 'erro');
                btnGDriveMigrate.disabled = false;
                if (btnGDriveConnect) btnGDriveConnect.disabled = false;
            }
        });
        const btnDismissGDriveNotice = $('#btnDismissGDriveNotice');
        if (btnDismissGDriveNotice) btnDismissGDriveNotice.addEventListener('click', () => { gdriveMigrationNotice = null; render(); });

        $('#btnExport').addEventListener('click', exportCatalog);
        $('#importJson').addEventListener('change', importCatalog);
        $('#btnClear').addEventListener('click', () => {
            if (!confirm('Isto apaga TODO o índice local no navegador — itens catalogados, rascunho, prévia de importação, listas de autocomplete e a configuração do RSC-PCCTAE. Os arquivos no diretório NÃO são removidos. Continuar?')) return;
            state.items = [];
            window.AppCore.saveCatalog();
            window.AppCore.clearDraft();                 // rascunho não salvo (lz_draft)
            state.lattesParsed = null;    // prévia de importação do XML
            state.orcidParsed = null;     // prévia de importação do ORCID
            state.bibParsed = null;       // prévia de importação de BibTeX/RIS
            state.editingId = null;       // sai de qualquer edição em curso
            state.evEditing = [];         // evidências em edição
            state.vocab = {};             // listas de autocomplete (curadas)
            state.rscCfg = {};            // configuração do RSC-PCCTAE
            // Persiste a limpeza das listas e do RSC nas configurações.
            const s = Storage.loadSettings(); s.vocab = {}; s.rsc = {}; Storage.saveSettings(s);
            window.AppCore.resetBackupReminder();        // zera o contador de backup
            toast('Índice local limpo (itens, listas e RSC).', 'ok');
            window.AppCore.renderItemList();
            render();               // re-renderiza a aba (Perfil, listas, RSC, contadores)
        });
        // Renomear/normalizar valores de autocomplete em todos os itens
        $$('[data-renfrom]').forEach(sel => {
            const k = sel.getAttribute('data-renfrom');
            const toEl = document.querySelector(`[data-rento="${k}"]`);
            const btn = document.querySelector(`[data-rename="${k}"]`);
            const cnt = document.querySelector(`[data-rencount="${k}"]`);
            const refresh = () => {
                const f = sel.value.trim();
                if (btn) btn.disabled = !f;
                if (cnt) cnt.textContent = f ? `${itemsUsingValue(k, f).length} item(ns) usam este valor.` : '';
            };
            sel.addEventListener('change', () => {
                if (toEl && sel.value.trim()) toEl.value = sel.value.trim(); // pré-preenche p/ editar
                refresh();
            });
            if (toEl) toEl.addEventListener('input', refresh);
            if (btn) btn.addEventListener('click', () => renameFieldValue(k, sel.value, toEl ? toEl.value : ''));
        });
        $('#btnCheckEnc').addEventListener('click', () => verificarCodificacao());
        $('#btnNormalize').addEventListener('click', () => normalizarPontuacao());
    }

    // Varre o catálogo procurando caracteres fora do ISO-8859-1
    function scanEncoding() {
        const problemas = [];
        state.items.forEach(i => {
            const chars = new Set();
            Object.values(i.fields || {}).forEach(v => {
                LzEncoding.findNonLatin1(v).forEach(x => chars.add(x.ch));
            });
            if (chars.size) problemas.push({ item: i, chars: Array.from(chars) });
        });
        return problemas;
    }

    function verificarCodificacao() {
        const box = $('#encResult');
        const probs = scanEncoding();
        if (!probs.length) {
            box.innerHTML = `<p class="text-green-700 dark:text-green-400"><i class="fa-solid fa-circle-check"></i> Todos os ${state.items.length} itens são 100% compatíveis com ISO-8859-1. Prontos para exportar ao Lattes.</p>`;
            return;
        }
        box.innerHTML = `
            <p class="text-amber-700 dark:text-amber-400 mb-2"><i class="fa-solid fa-triangle-exclamation"></i> ${probs.length} item(ns) com caracteres fora do ISO-8859-1:</p>
            <div class="space-y-1 max-h-60 overflow-y-auto">
                ${probs.map(p => `<div class="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                    <span class="font-medium">${esc(LattesTypes.itemTitle(p.item))}</span>
                    <span class="text-gray-500">— caracteres: ${p.chars.map(c => `<code>${esc(c)}</code>(U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')})`).join(' ')}</span>
                </div>`).join('')}
            </div>
            <p class="text-xs text-gray-500 mt-2">Use “Normalizar pontuação” para converter os casos comuns. Os que restarem serão exportados como entidades numéricas XML (válidas no Lattes).</p>`;
    }

    async function normalizarPontuacao() {
        let alterados = 0;
        state.items.forEach(i => {
            let changed = false;
            Object.keys(i.fields || {}).forEach(k => {
                const orig = i.fields[k];
                if (typeof orig === 'string') {
                    const norm = LzEncoding.normalizePunctuation(orig);
                    if (norm !== orig) { i.fields[k] = norm; changed = true; }
                }
            });
            if (changed) { i.updatedAt = window.AppCore.nowISO(); alterados++; }
        });
        if (!alterados) { toast('Nada a normalizar — pontuação já compatível.', 'ok'); verificarCodificacao(); return; }
        window.AppCore.saveCatalog();
        // regrava os JSON no diretório, se configurado
        if (Storage.hasDirectory()) {
            for (const i of state.items) {
                try { await Storage.writeJson(i.id, i, LattesTypes.categoryFolder(i.categoryKey)); } catch (_) {}
            }
        }
        toast(`Pontuação normalizada em ${alterados} item(ns).`, 'ok');
        window.AppCore.renderItemList();
        verificarCodificacao();
    }

    // Carimbo de data/hora para nomes de arquivo: AAAA-MM-DD_HHMMSS (hora local)
    function fileStamp() {
        const d = new Date(); const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }
    // Nome-base do backup: latteszen-<Nome completo>-<timestamp>
    // O nome vem do item de Identificação (Dados gerais); se não houver, omite.
    function catalogBaseName() {
        const id = state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
        const nome = id ? String(id.fields.titulo) : '';
        const safe = nome.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
        return safe ? `latteszen-${safe}-${fileStamp()}` : `latteszen-${fileStamp()}`;
    }

    async function exportCatalog() {
        const data = {
            app: 'lattesZen', version: APP_CONFIG.version, schemaVersion: window.AppCore.SCHEMA_VERSION, exportedAt: window.AppCore.nowISO(),
            items: state.items,
            // Configurações do sistema (prefixo do identificador, listas de
            // autocomplete, RSC etc.) — sem isto, restaurar o backup num
            // navegador novo perde tudo que está em Configurações.
            settings: Storage.loadSettings(),
        };
        const nome = catalogBaseName();
        // Local padrão: subpasta "00 - Backup" dentro do diretório configurado
        if (Storage.hasDirectory()) {
            try {
                await Storage.writeJson(nome, data, LattesTypes.backupFolder());
                window.AppCore.resetBackupReminder();
                toast(`Backup salvo em "${LattesTypes.backupFolder()}/${nome}.json".`, 'ok');
                return;
            } catch (e) {
                toast('Falha ao salvar no diretório: ' + e.message + ' — baixando arquivo.', 'aviso');
            }
        }
        // Sem diretório (ou falha): baixa o arquivo
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${nome}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        window.AppCore.resetBackupReminder();
    }

    // Higieniza um item vindo de JSON externo (integridade)
    function sanitizeImportedItem(i) {
        if (!Array.isArray(i.evidencias)) {
            i.evidencias = i.hasPdf ? [{ basename: i.id, ext: i.fileExt || 'pdf', name: i.pdfName || `${i.id}.pdf`, publica: true }] : [];
        }
        i.hasPdf = i.evidencias.length > 0;
        if (!i.categoryKey && i.typeKey) i.categoryKey = LattesTypes.primaryCategory(i.typeKey);
        i.schemaVersion = window.AppCore.SCHEMA_VERSION;
    }

    async function importCatalog(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            const items = Array.isArray(data) ? data : data.items;
            if (!Array.isArray(items)) throw new Error('Formato inválido.');
            const byId = new Map(state.items.map(i => [i.id, i]));
            items.forEach(i => { if (i && i.id) { sanitizeImportedItem(i); byId.set(i.id, i); } });
            state.items = Array.from(byId.values());
            window.AppCore.saveCatalog();
            // Restaura as configurações do sistema, se presentes no backup (prefixo
            // do identificador, listas de autocomplete, RSC etc.) — essencial ao
            // restaurar num navegador novo, onde essas configurações não existem.
            let restaurouConfig = false;
            if (data.settings && typeof data.settings === 'object') {
                const merged = Object.assign(Storage.loadSettings(), data.settings);
                Storage.saveSettings(merged);
                state.vocab = merged.vocab || {};
                state.idPrefix = window.AppCore.sanitizePrefix(merged.idPrefix || 'lz');
                state.lastCat = merged.lastCat || '';
                state.lastType = merged.lastType || '';
                state.rscEnabled = !!merged.rscEnabled;
                state.rscCfg = merged.rsc || {};
                window.AppCore.applyRscVisibility();
                restaurouConfig = true;
            }
            toast(`${items.length} item(ns) importado(s) do JSON.${restaurouConfig ? ' Configurações do sistema restauradas.' : ''}`, 'ok');
            window.AppCore.renderItemList();
            render();
        } catch (err) { toast('Falha ao importar: ' + err.message, 'erro'); }
        e.target.value = '';
    }

    // Publicado em AppCore: RENDERERS.config (ver app.js) usa TabConfig.render
    // diretamente; a exposição abaixo mantém o nome renderConfig, já usado
    // por tab-catalogar.js (renameFieldValue re-renderiza Configurações
    // após renomear um valor de autocomplete).
    window.AppCore.renderConfig = render;

    return { render };
})();
