/* ==========================================================================
   lattesZen — Aba Catalogar (motor do formulário de itens)
   --------------------------------------------------------------------------
   Quinta aba extraída de app.js (ver issue de refatoração) — de longe a mais
   entrelaçada: o motor de campos dinâmicos do formulário (buildForm e toda a
   cadeia de wireX/fieldHtml), o painel de PDF, a bandeja de evidências e os
   blocos de RSC/Visibilidade dentro do próprio formulário.

   Várias destas primitivas continuam sendo usadas por Configurações (ainda
   em app.js) — por isso são publicadas em window.AppCore no fim deste
   arquivo. Na direção oposta, um punhado de funções que ficaram em app.js
   (saveCatalog, saveVocab, renderConfig, clearDraft, maybeShowDraftBanner,
   saveDraftDebounced, fileExt, allowedExtsForAccept, checkEvidenceFile,
   evListFromItem, randCode) são lidas via window.AppCore.xxx dentro dos
   corpos das funções abaixo — app.js carrega DEPOIS deste módulo, então só
   podem ser chamadas em tempo de execução (nunca desestruturadas no topo).

   `renameFieldValue` é, na verdade, uma operação de Configurações (renomear
   um valor de autocomplete em todos os itens) que ficou fisicamente dentro
   deste bloco no app.js original — mesmo caso dos importadores XML/ORCID/
   BibTeX ainda por extrair (ver issue #23). Mantido aqui por ora para não
   fragmentar a extração; pode ser relocado quando Configurações virar seu
   próprio módulo.
   ========================================================================== */
window.TabCatalogar = (function () {
    const {
        state, $, $$, esc, toast, anoDe, sortByYear,
        isImageExt, isVideoExt, isArchiveExt, NA_VALUE,
        elegivelAoLattes, itemsUsingValue, normNome, validateField,
        setFieldError, associateLabels, isFieldDisabled,
    } = window.AppCore;

    /* =====================================================================
       ABA: CATALOGAR
       ===================================================================== */
    function render() {
        const panel = $('#tab-catalogar');
        panel.innerHTML = `
            <div class="grid lg:grid-cols-5 gap-6 items-start">
                <form id="itemForm" novalidate class="contents"></form>
                <section id="pdfSection" class="hidden lg:col-span-3 lg:sticky lg:top-4">
                    <div class="flex items-center justify-between mb-3">
                        <h2 class="text-lg font-bold flex items-center gap-2">
                            <i aria-hidden="true" class="fa-solid fa-file-lines text-red-600"></i>
                            Visualização do arquivo
                        </h2>
                        <div class="flex gap-1">
                            <button type="button" id="pdfNewTab" title="Abrir em nova aba" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden"><i class="fa-solid fa-up-right-from-square"></i></button>
                            <button type="button" id="pdfClose" title="Fechar" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                    <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center" style="height: 85vh; min-height: 560px">
                        <div id="pdfEmpty" class="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-6">
                            <i class="fa-regular fa-file-lines text-5xl mb-3"></i>
                            <p class="text-sm">O arquivo (PDF ou imagem) aparece aqui ao anexá-lo no formulário<br>ou ao abrir um item com evidência (aba <strong>Conformidade</strong>).</p>
                        </div>
                        <div id="pdfNoPreview" class="hidden h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-6">
                            <i class="fa-solid fa-file-zipper text-5xl mb-3"></i>
                            <p class="text-sm">Sem pré-visualização para este tipo de arquivo.<br>Use “Abrir em nova aba” para baixá-lo.</p>
                        </div>
                        <iframe id="pdfFrame" class="w-full h-full hidden" title="Pré-visualização do arquivo"></iframe>
                        <img id="pdfImg" class="max-w-full max-h-full object-contain hidden" alt="Pré-visualização da imagem">
                    </div>
                    <p id="pdfPanelName" class="text-xs text-gray-500 mt-1 truncate"></p>
                </section>
            </div>`;

        buildForm();
        window.AppCore.maybeShowDraftBanner();
        $('#pdfClose').addEventListener('click', clearPdf);
        $('#pdfNewTab').addEventListener('click', () => { if (state.currentPdfUrl) window.open(state.currentPdfUrl, '_blank'); });
    }

    /* =====================================================================
       Painel de visualização do PDF (dentro de "Catalogar")
       ===================================================================== */
    function setPdf(url, name, ext) {
        const frame = $('#pdfFrame'), img = $('#pdfImg'), noPreview = $('#pdfNoPreview');
        if (!frame) return; // painel não montado (outra aba ativa)
        if (state.currentPdfUrl && state.currentPdfUrl !== url) {
            try { URL.revokeObjectURL(state.currentPdfUrl); } catch (_) {}
        }
        state.currentPdfUrl = url;
        if (isImageExt(ext)) {
            img.src = url; img.classList.remove('hidden');
            frame.src = 'about:blank'; frame.classList.add('hidden');
            if (noPreview) noPreview.classList.add('hidden');
        } else if (isArchiveExt(ext)) {
            // Arquivo compactado (.zip/.tar/.gz): o navegador não tem visualizador
            // nativo, então navegar o iframe para a blob URL apenas dispara o
            // diálogo de download do sistema — mostra um aviso em vez disso.
            // "Abrir em nova aba" continua funcionando (baixar é o esperado ali).
            frame.src = 'about:blank'; frame.classList.add('hidden');
            img.removeAttribute('src'); img.classList.add('hidden');
            if (noPreview) noPreview.classList.remove('hidden');
        } else {
            // PDF: pede ao visualizador nativo do navegador para ajustar a
            // página inteira à janela (não afeta outros tipos de arquivo).
            frame.src = /^pdf$/i.test(ext || '') ? (url + '#view=Fit') : url;
            frame.classList.remove('hidden');
            img.removeAttribute('src'); img.classList.add('hidden');
            if (noPreview) noPreview.classList.add('hidden');
        }
        $('#pdfEmpty').classList.add('hidden');
        $('#pdfClose').classList.remove('hidden');
        $('#pdfNewTab').classList.remove('hidden');
        $('#pdfPanelName').textContent = name || '';
        const sec = $('#pdfSection'); if (sec) sec.classList.remove('hidden'); // só aparece após uma evidência ser selecionada
    }
    function clearPdf() {
        const frame = $('#pdfFrame'), img = $('#pdfImg'), noPreview = $('#pdfNoPreview');
        if (state.currentPdfUrl) { try { URL.revokeObjectURL(state.currentPdfUrl); } catch (_) {} state.currentPdfUrl = null; }
        const sec = $('#pdfSection'); if (sec) sec.classList.add('hidden');
        if (!frame) return;
        frame.src = 'about:blank'; frame.classList.add('hidden');
        if (img) { img.removeAttribute('src'); img.classList.add('hidden'); }
        if (noPreview) noPreview.classList.add('hidden');
        $('#pdfEmpty').classList.remove('hidden');
        $('#pdfClose').classList.add('hidden');
        $('#pdfNewTab').classList.add('hidden');
        $('#pdfPanelName').textContent = '';
    }
    function previewPdfFile(file) {
        if (!file) return;
        setPdf(URL.createObjectURL(file), file.name, window.AppCore.fileExt(file));
    }
    async function showPdfForItem(item) {
        if (!$('#pdfFrame')) return;
        const list = window.AppCore.evListFromItem(item);
        if (!list.length) { clearPdf(); return; }
        const ev = list.find(e => e.publica) || list[0];
        if (ev.kind === 'link') { clearPdf(); return; } // links abrem em nova aba, não pré-visualizam sozinhos
        try {
            const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder(item.categoryKey), ev.ext);
            if (url) setPdf(url, ev.name, ev.ext);
            else { clearPdf(); toast('Arquivo não encontrado no diretório (sincronize a pasta).', 'aviso'); }
        } catch (e) { clearPdf(); }
    }

    // Pré-visualiza uma evidência (nova ou já gravada) no painel lateral.
    // Evidências do tipo "link" não têm arquivo — abrem direto numa nova aba.
    async function previewEvidence(ev) {
        if (ev.kind === 'link') { window.open(ev.url, '_blank', 'noopener'); return; }
        if (ev.file) { setPdf(URL.createObjectURL(ev.file), ev.name, ev.ext); return; }
        try {
            // Arquivo já gravado: usar a categoria SALVA do item em edição
            // (não o seletor, que pode ter sido alterado sem salvar).
            const it = state.editingId ? state.items.find(i => i.id === state.editingId) : null;
            const catKey = it ? it.categoryKey : ($('#selCategoria') ? $('#selCategoria').value : null);
            const subdir = LattesTypes.categoryFolder(catKey);
            const url = await Storage.readAttachmentUrl(ev.basename, subdir, ev.ext);
            if (url) setPdf(url, ev.name, ev.ext);
            else toast('Arquivo não encontrado no diretório (sincronize a pasta).', 'aviso');
        } catch (e) { toast('Não foi possível abrir a evidência: ' + e.message, 'aviso'); }
    }

    // Renderiza a lista de evidências no formulário (com reordenar / pública / ver / remover).
    function renderEvList() {
        const ul = $('#evList');
        if (!ul) return;
        const hint = $('#evHint');
        if (hint) hint.classList.toggle('hidden', !state.evEditing.length); // só aparece com evidência carregada
        if (!state.evEditing.length) {
            ul.innerHTML = `<li class="text-xs text-gray-400 dark:text-gray-500 italic">Nenhuma evidência anexada.</li>`;
            return;
        }
        ul.innerHTML = state.evEditing.map((ev, idx) => {
            const thumb = ev.kind === 'link'
                ? `<i aria-hidden="true" class="fa-solid fa-link text-govbr-600 dark:text-unifesp-400 shrink-0 w-8 text-center"></i>`
                : isImageExt(ev.ext)
                    ? (ev.file
                        ? `<img src="${URL.createObjectURL(ev.file)}" class="w-8 h-8 object-cover rounded shrink-0" alt="">`
                        : `<img data-evthumb="${idx}" class="w-8 h-8 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700" alt="">`)
                    : isVideoExt(ev.ext)
                        ? `<i aria-hidden="true" class="fa-solid fa-file-video text-purple-600 shrink-0 w-8 text-center"></i>`
                        : isArchiveExt(ev.ext)
                            ? `<i aria-hidden="true" class="fa-solid fa-file-zipper text-amber-600 shrink-0 w-8 text-center"></i>`
                            : `<i aria-hidden="true" class="fa-solid fa-file-pdf text-red-600 shrink-0 w-8 text-center"></i>`;
            return `
            <li class="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm">
                ${thumb}
                <span class="min-w-0 flex-1 truncate" title="${esc(ev.name)}">${esc(ev.name)}${ev.file ? ' <span class="text-xs text-green-600">(novo)</span>' : ''}</span>
                <input type="text" data-evtag="${idx}" list="dl-evidenciaTag" value="${esc(ev.tag || '')}" placeholder="Tag" title="Tag da evidência (ex.: Certificado, Declaração…)" class="w-24 shrink-0 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                <label class="flex items-center gap-1 text-xs shrink-0" title="Será exibida no futuro módulo de publicação (pode marcar quantas quiser)">
                    <input type="checkbox" data-evpub="${idx}" ${ev.publica ? 'checked' : ''}> pública
                </label>
                <button type="button" data-evup="${idx}" title="Subir" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" data-evdown="${idx}" title="Descer" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === state.evEditing.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" data-evsee="${idx}" title="Ver no painel" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400 shrink-0"><i class="fa-solid fa-eye"></i></button>
                <button type="button" data-evdel="${idx}" title="Remover" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 shrink-0"><i class="fa-solid fa-xmark"></i></button>
            </li>`;
        }).join('');

        // Miniaturas de imagens já gravadas (carrega do diretório, se houver)
        state.evEditing.forEach(async (ev, idx) => {
            if (!isImageExt(ev.ext) || ev.file) return;
            const el = ul.querySelector(`[data-evthumb="${idx}"]`);
            if (!el) return;
            try {
                const it = state.editingId ? state.items.find(i => i.id === state.editingId) : null;
                const catKey = it ? it.categoryKey : ($('#selCategoria') ? $('#selCategoria').value : null);
                const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder(catKey), ev.ext);
                if (url) el.src = url;
            } catch (_) {}
        });

        $$('[data-evpub]', ul).forEach(c => c.addEventListener('change', (e) => {
            const i = +e.target.dataset.evpub;
            state.evEditing[i].publica = e.target.checked; // 0..N públicas (independentes)
            state.formDirty = true;
        }));
        $$('[data-evtag]', ul).forEach(inp => inp.addEventListener('input', (e) => {
            const i = +e.target.dataset.evtag;
            state.evEditing[i].tag = e.target.value;
            state.formDirty = true;
        }));
        const swap = (i, j) => { const t = state.evEditing[i]; state.evEditing[i] = state.evEditing[j]; state.evEditing[j] = t; state.formDirty = true; renderEvList(); };
        $$('[data-evup]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evup; if (i > 0) swap(i, i - 1); }));
        $$('[data-evdown]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evdown; if (i < state.evEditing.length - 1) swap(i, i + 1); }));
        $$('[data-evsee]', ul).forEach(b => b.addEventListener('click', (e) => previewEvidence(state.evEditing[+e.currentTarget.dataset.evsee])));
        $$('[data-evdel]', ul).forEach(b => b.addEventListener('click', (e) => {
            const i = +e.currentTarget.dataset.evdel;
            const ev = state.evEditing[i];
            if (!confirm(`Remover a evidência "${ev.name}"?`)) return;
            state.evEditing.splice(i, 1); state.formDirty = true; renderEvList();
        }));
    }

    // Adiciona arquivos à lista de evidências (usado por input, arrastar-soltar
    // e colar). Valida cada arquivo e respeita os tipos aceitos pelo tipo atual.
    function addEvidenceFiles(files) {
        const inp = $('#pdfInput');
        const allowed = window.AppCore.allowedExtsForAccept(inp ? inp.accept : '');
        // Casa o arquivo anexado com um da bandeja (por nome + tamanho) — assim,
        // mesmo anexando pelo seletor/arrastar, o original é movido p/ Processado.
        const inboxByKey = new Map((state._inbox || []).map(e => [`${e.name}|${e.size}`, e.name]));
        let added = null;
        Array.from(files || []).forEach(f => {
            const err = window.AppCore.checkEvidenceFile(f, allowed);
            if (err) { toast(err, 'aviso'); return; }
            const inboxName = inboxByKey.get(`${f.name}|${f.size}`) || null;
            state.evEditing.push({
                basename: null, ext: window.AppCore.fileExt(f), name: f.name || `colado.${window.AppCore.fileExt(f)}`,
                publica: state.evEditing.length === 0, tag: '', file: f, inboxName,
            });
            added = f;
            state.formDirty = true;
        });
        renderEvList();
        if (added) previewPdfFile(added);
    }

    // Usa um arquivo da bandeja de entrada como evidência (marcando a origem,
    // para mover o original a "Processados" ao salvar o item).
    async function useInboxFile(entry) {
        const inp = $('#pdfInput');
        const allowed = window.AppCore.allowedExtsForAccept(inp ? inp.accept : '');
        let file;
        try { file = await Storage.readInboxFile(entry.name); }
        catch (e) { toast('Não foi possível ler o arquivo da bandeja: ' + e.message, 'aviso'); return; }
        const err = window.AppCore.checkEvidenceFile(file, allowed);
        if (err) { toast(err, 'aviso'); return; }
        state.evEditing.push({
            basename: null, ext: window.AppCore.fileExt(file), name: file.name || entry.name,
            publica: state.evEditing.length === 0, tag: '', file, inboxName: entry.name,
        });
        state.formDirty = true;
        renderEvList();
        previewPdfFile(file);
    }

    // Bandeja de entrada: botão com um badge de contagem (sem listar os
    // arquivos). Clicar no botão anexa o próximo arquivo pendente ainda não
    // usado neste item.
    async function renderInbox() {
        const btn = $('#btnEvInbox'), badge = $('#inboxBadge');
        if (!btn) return;
        if (!Storage.hasDirectory()) {
            btn.disabled = true; btn.classList.add('opacity-40');
            if (badge) badge.classList.add('hidden');
            return;
        }
        let itens = [];
        try { itens = await Storage.listInbox(); } catch (_) { itens = []; }
        state._inbox = itens;
        btn.disabled = !itens.length;
        btn.classList.toggle('opacity-40', !itens.length);
        if (badge) {
            badge.textContent = itens.length ? String(itens.length) : '';
            badge.classList.toggle('hidden', !itens.length);
        }
    }
    // Anexa o próximo arquivo da bandeja que ainda não foi anexado a este item
    async function useNextInbox() {
        const itens = state._inbox || [];
        const staged = new Set(state.evEditing.filter(e => e.inboxName).map(e => e.inboxName));
        const prox = itens.find(it => !staged.has(it.name));
        if (!prox) { toast('Bandeja vazia ou já anexada a este item.', 'info'); return; }
        await useInboxFile(prox);
        await renderInbox();
    }

    // Evidência do tipo "link": não tem arquivo, só uma URL. Aceita o texto
    // sem esquema (adiciona "https://") e valida com o construtor URL.
    function normalizeUrl(raw) {
        let s = String(raw || '').trim();
        if (!s) return null;
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
        try { new URL(s); return s; } catch (_) { return null; }
    }
    function addUrlEvidence() {
        const inp = $('#evUrlInput');
        const url = normalizeUrl(inp.value);
        if (!url) { toast('Informe um link (URL) válido.', 'aviso'); return; }
        state.evEditing.push({
            kind: 'link', basename: null, ext: 'url', file: null,
            name: url, url, publica: state.evEditing.length === 0, tag: '',
        });
        state.formDirty = true;
        inp.value = '';
        $('#evUrlRow').classList.add('hidden');
        renderEvList();
    }

    // Camada RSC no formulário (abaixo dos campos do item), quando habilitado.
    // Listener global de "clique fora" do buscador de critério — fechado/
    // recriado a cada renderRscBlock (roda de novo a cada item aberto); sem
    // isso, cada render empilharia mais um listener em document, nunca
    // removido (memory leak).
    let critOutsideClickHandler = null;
    function renderRscBlock(item) {
        const box = $('#rscBlock'); if (!box) return;
        if (critOutsideClickHandler) { document.removeEventListener('click', critOutsideClickHandler); critOutsideClickHandler = null; }
        const typeKey = $('#selTipo') ? $('#selTipo').value : '';
        const eligivel = state.rscEnabled && typeKey && !LattesTypes.isPerfilType(typeKey) && !LattesTypes.isNaoLattesType(typeKey);
        if (!eligivel) { box.innerHTML = ''; return; }
        const rsc = (item && item.rsc) || {};
        // Lista única com TODOS os critérios do decreto (~50 itens), agrupados
        // por Requisito — extensa demais pra rolar procurando um item específico
        // (issue #24). Achatada uma vez aqui; critListaHtml() a filtra em tempo
        // real conforme o usuário digita, exibida como lista clicável (issue
        // #25) em vez de um <select> que só mostra o resultado depois de aberto.
        const todosCriterios = Object.keys(LzRSC.REQUISITOS).flatMap(r =>
            LzRSC.criteriosDoRequisito(r).map(c => ({ ...c, reqLabel: LzRSC.REQUISITOS[r] })));
        function criteriosFiltrados(filtro) {
            const q = normNome(filtro || '');
            if (!q) return todosCriterios;
            return todosCriterios.filter(c => normNome(`${c.item} ${c.desc} ${c.unidade}`).includes(q));
        }
        function labelDoCriterio(id) {
            const c = todosCriterios.find(x => x.id === id);
            return c ? `${c.item}. ${c.desc} — ${c.unidade} · ${String(c.pontos).replace('.', ',')} pts` : '';
        }
        function critListaHtml(filtro) {
            const encontrados = criteriosFiltrados(filtro);
            if (!encontrados.length) return `<p class="px-2 py-2 text-sm text-gray-500 italic">Nenhum critério encontrado.</p>`;
            const porReq = {};
            encontrados.forEach(c => (porReq[c.reqLabel] = porReq[c.reqLabel] || []).push(c));
            return Object.keys(porReq).map(label => {
                const itens = porReq[label].map(c =>
                    `<button type="button" data-crit="${c.id}" class="block w-full text-left px-2 py-1.5 text-sm hover:bg-amber-100 dark:hover:bg-gray-700">${c.item}. ${esc(c.desc)} — ${esc(c.unidade)} · ${String(c.pontos).replace('.', ',')} pts</button>`).join('');
                return `<div><p class="sticky top-0 px-2 py-1 text-[11px] font-semibold text-gray-500 bg-gray-50 dark:bg-gray-800">Requisito ${esc(label)}</p>${itens}</div>`;
            }).join('');
        }
        box.innerHTML = `
        <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 space-y-2">
            <label class="flex items-center gap-2 text-sm font-semibold"><i aria-hidden="true" class="fa-solid fa-award text-amber-600"></i>
                <input type="checkbox" id="rscConta" ${rsc.conta ? 'checked' : ''}> Contabilizar este item no RSC-PCCTAE</label>
            <div id="rscFields" class="${rsc.conta ? '' : 'hidden'} space-y-2">
                <div class="relative"><label class="block text-xs font-semibold mb-1" for="rscCritFiltro">Critério específico (Anexos I–VI do Decreto)</label>
                    <input type="text" id="rscCritFiltro" autocomplete="off" placeholder="Digite pra buscar (ex.: prêmio, capacitação, comissão...)"
                           value="${esc(labelDoCriterio(rsc.criterio))}"
                           class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                    <input type="hidden" id="rscCrit" value="${esc(rsc.criterio || '')}">
                    <div id="rscCritLista" class="hidden absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg"></div>
                    <p class="text-[11px] text-gray-500 mt-0.5">Todos os critérios do decreto estão listados, agrupados por Requisito (I a VI). Digite acima para filtrar.</p></div>
                <p class="text-[11px] text-gray-500"><i aria-hidden="true" class="fa-solid fa-calendar-days mr-1"></i>Para critérios por tempo (ano/mês), o período é calculado a partir dos campos de <strong>data</strong> do item acima (início/fim).</p>
                <div class="grid sm:grid-cols-2 gap-2">
                    <div id="rscPapelWrap" class="hidden"><label class="block text-xs font-semibold mb-1" for="rscPapel">Papel</label>
                        <select id="rscPapel" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                            <option value="titular" ${rsc.papel !== 'substituto' ? 'selected' : ''}>Titular</option>
                            <option value="substituto" ${rsc.papel === 'substituto' ? 'selected' : ''}>Substituto</option></select></div>
                    <div id="rscQtdWrap" class="hidden"><label class="block text-xs font-semibold mb-1" for="rscQtd">Quantidade</label>
                        <input id="rscQtd" type="number" min="0" step="1" value="${esc(rsc.quantidade != null ? rsc.quantidade : 1)}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>
                </div>
                <div><label class="block text-xs font-semibold mb-1" for="rscJust">Justificativa (para o memorial)</label>
                    <textarea id="rscJust" rows="2" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc(rsc.justificativa || '')}</textarea></div>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="rscUsado" ${rsc.jaUsado ? 'checked' : ''}> Já utilizado em concessão anterior (não conta no saldo)</label>
                <p id="rscPontos" class="text-sm font-semibold text-amber-700 dark:text-amber-400"></p>
            </div>
        </div>`;

        const conta = $('#rscConta'), fields = $('#rscFields'), critHidden = $('#rscCrit');
        function recompute() {
            const crit = LzRSC.criterio(critHidden.value);
            $('#rscPapelWrap').classList.toggle('hidden', !(crit && crit.pontosSub != null));
            $('#rscQtdWrap').classList.toggle('hidden', !(crit && crit.calc === 'unidade'));
            const data = collectRsc($('#itemForm'));
            const pi = LzRSC.pontosItem(data);
            const el = $('#rscPontos');
            if (!crit) { el.textContent = 'Selecione o critério para calcular os pontos.'; return; }
            el.textContent = `Pontos: ${String(pi.pontos).replace('.', ',')}  (${pi.quantidade} × ${String(pi.unitario).replace('.', ',')} · ${crit.unidade})`;
        }
        conta.addEventListener('change', () => { fields.classList.toggle('hidden', !conta.checked); state.formDirty = true; recompute(); });

        // Buscador de critério (issues #24/#25): lista de resultados clicável
        // logo abaixo do campo, refeita a cada tecla — em vez de um <select>
        // que só mostrava o filtro depois de clicar pra abrir.
        const critFiltro = $('#rscCritFiltro'), critLista = $('#rscCritLista');
        // Última seleção CONFIRMADA (clicada de fato) — separada de
        // critHidden.value, que fica vazio enquanto o usuário digita (só volta
        // a valer algo quando ele clica num resultado). É o que "restaurar o
        // campo" (clique fora / Esc sem escolher) usa como valor de retorno.
        let criterioConfirmado = rsc.criterio || '';
        const abrirLista = (filtro) => { critLista.innerHTML = critListaHtml(filtro); critLista.classList.remove('hidden'); };
        const fecharLista = () => critLista.classList.add('hidden');
        const restaurarConfirmado = () => {
            critHidden.value = criterioConfirmado;
            critFiltro.value = labelDoCriterio(criterioConfirmado);
            recompute();
        };
        function selecionarCriterio(id) {
            criterioConfirmado = id;
            critHidden.value = id;
            critFiltro.value = labelDoCriterio(id);
            fecharLista();
            state.formDirty = true;
            recompute();
        }
        critFiltro.addEventListener('focus', () => abrirLista(critFiltro.value));
        critFiltro.addEventListener('input', (e) => {
            // Não deixa o evento borbulhar até o listener de #itemForm (que
            // marca state.formDirty a qualquer "input" no formulário) — só
            // vira dado do item quando um resultado é de fato clicado.
            e.stopPropagation();
            critHidden.value = ''; // texto mudou: a seleção anterior não vale mais até escolher de novo (ou restaurar)
            abrirLista(critFiltro.value);
            recompute();
        });
        critFiltro.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            fecharLista();
            restaurarConfirmado();
            critFiltro.blur();
        });
        critLista.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-crit]');
            if (btn) selecionarCriterio(btn.dataset.crit);
        });
        // Clique fora do campo/lista: fecha e, se o texto digitado não virou
        // uma seleção de verdade, volta a mostrar o critério anterior (não
        // deixa texto solto sem critério real por trás).
        critOutsideClickHandler = (e) => {
            if (critLista.classList.contains('hidden')) return;
            if (e.target === critFiltro || critLista.contains(e.target)) return;
            fecharLista();
            restaurarConfirmado();
        };
        document.addEventListener('click', critOutsideClickHandler);

        ['change', 'input'].forEach(ev => $('#rscFields').addEventListener(ev, () => { state.formDirty = true; recompute(); }));
        // O período do RSC vem dos campos de data do item: recalcula ao editá-los.
        const itemForm = $('#itemForm');
        ['anoInicio', 'anoFim', 'ano'].forEach(name => {
            const el = itemForm && itemForm.elements ? itemForm.elements[name] : null;
            if (el && el.addEventListener) el.addEventListener('input', recompute);
        });
        recompute();
    }

    // Camada de Visibilidade no formulário (abaixo do bloco RSC): três eixos
    // independentes — Exportar para Lattes (entra ou não no XML gerado),
    // Visibilidade no Lattes (Público/Privado — só anotação, a Plataforma
    // Lattes não expõe isso no XML de/para lattesZen) e Publicar na Web
    // (entra ou não na página HTML própria). Nenhum dos três afeta o RSC,
    // que usa sua própria marcação (rsc.conta), isolada.
    function renderVisibilidadeBlock(item) {
        const box = $('#visibilidadeBlock'); if (!box) return;
        const typeKey = $('#selTipo') ? $('#selTipo').value : '';
        const catKey = $('#selCategoria') ? $('#selCategoria').value : '';
        if (!typeKey || LattesTypes.isPerfilType(typeKey)) { box.innerHTML = ''; return; }
        const v = (item && item.visibilidade) || {};
        const exportarLattes = v.exportarLattes !== false;
        const visivelNoLattes = v.visivelNoLattes !== 'Privado';
        const publicarWeb = v.publicarWeb !== false;
        const doLattes = elegivelAoLattes(typeKey, catKey);

        box.innerHTML = `
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 rounded px-3 py-2">
            ${doLattes ? `
            <label class="flex items-center gap-1.5"><input type="checkbox" id="visExportarLattes" ${exportarLattes ? 'checked' : ''}> Exportar item para meu Lattes</label>
            <label class="flex items-center gap-1.5"><input type="checkbox" id="visVisivelLattes" ${visivelNoLattes ? 'checked' : ''}> Item visível (público) no Lattes</label>` : ''}
            <label class="flex items-center gap-1.5"><input type="checkbox" id="visPublicarWeb" ${publicarWeb ? 'checked' : ''}> Publicar item na Web</label>
        </div>`;

        const expChk = $('#visExportarLattes');
        if (expChk) expChk.addEventListener('change', () => { state.formDirty = true; });
        const visChk = $('#visVisivelLattes');
        if (visChk) visChk.addEventListener('change', () => { state.formDirty = true; });
        const pubChk = $('#visPublicarWeb');
        if (pubChk) pubChk.addEventListener('change', () => { state.formDirty = true; });
    }
    // Lê a camada de Visibilidade do formulário → { exportarLattes,
    // visivelNoLattes, publicarWeb } (ou null se o bloco não foi montado —
    // tipo de perfil). Independente do RSC — nunca lida aqui.
    function collectVisibilidade(form) {
        const pubChk = form.querySelector('#visPublicarWeb');
        if (!pubChk) return null;
        const expChk = form.querySelector('#visExportarLattes');
        const visChk = form.querySelector('#visVisivelLattes');
        return {
            exportarLattes: expChk ? expChk.checked : false,
            visivelNoLattes: (visChk ? visChk.checked : true) ? 'Público' : 'Privado',
            publicarWeb: pubChk.checked,
        };
    }
    // Normaliza ano/data-completa para dd/mm/aaaa (usado no período do RSC).
    // 'aaaa' vira 01/01/aaaa (início) ou 31/12/aaaa (fim). ISO aaaa-mm-dd também.
    function _rscToBR(v, endOfYear) {
        const s = String(v == null ? '' : v).trim();
        if (!s) return '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
        let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        m = s.match(/^(\d{2})\/(\d{4})$/); // mm/aaaa
        if (m) {
            if (!endOfYear) return `01/${m[1]}/${m[2]}`;
            const ultimoDia = new Date(Number(m[2]), Number(m[1]), 0).getDate();
            return `${String(ultimoDia).padStart(2, '0')}/${m[1]}/${m[2]}`;
        }
        m = s.match(/^(\d{4})$/); if (m) return endOfYear ? `31/12/${s}` : `01/01/${s}`;
        return '';
    }
    // Lê a camada RSC do formulário → objeto rsc (ou {conta:false}). O período
    // (início/fim) é derivado dos campos de data do próprio item, não mais de
    // campos de data no bloco RSC (evita redundância). Itens ainda em
    // exercício (situação "Atual (não finalizado)") não têm data de fim
    // própria — nesse caso, o fim do período usado no cálculo é a "Data de
    // abrangência (final)" configurada em Configurações › RSC (issue #27):
    // sem isso, esses itens nunca teriam o tempo decorrido contado.
    function collectRsc(form) {
        const conta = form.querySelector('#rscConta');
        if (!conta) return null;
        const val = id => { const el = form.querySelector('#' + id); return el ? el.value.trim() : ''; };
        const chk = id => { const el = form.querySelector('#' + id); return !!(el && el.checked); };
        const fld = name => { const el = form.elements ? form.elements[name] : null; return (el && typeof el.value === 'string') ? el.value.trim() : ''; };
        const dataAbrangencia = (state.rscCfg && state.rscCfg.dataAbrangenciaFinal) || '';
        return {
            conta: conta.checked,
            criterio: val('rscCrit'),
            dataInicio: _rscToBR(fld('anoInicio'), false),
            dataFim: _rscToBR(fld('anoFim') || fld('ano'), true) || _rscToBR(dataAbrangencia, true),
            papel: val('rscPapel') || 'titular',
            quantidade: val('rscQtd') || '',
            justificativa: val('rscJust'), jaUsado: chk('rscUsado'),
        };
    }

    function buildForm(item, opts) {
        opts = opts || {};
        const form = $('#itemForm');
        const editing = !!item;

        // Item novo: Categoria/Tipo começam vazios, exigindo escolha explícita
        // (painel de campos só aparece depois — ver renderDynFields). Exceção:
        // "Salvar e novo" (opts.keepType) mantém a mesma categoria/tipo, de
        // propósito, para agilizar o cadastro em série.
        let currentType = item ? LattesTypes.normalizeType(item.typeKey) : (opts.keepType ? (state.lastType || '') : '');
        let currentCat = item ? (item.categoryKey || LattesTypes.primaryCategory(currentType))
            : (opts.keepType ? (state.lastCat || (LattesTypes.categories[0] && LattesTypes.categories[0].key)) : '');
        if (currentCat === 'NAO_LATTES' || currentCat === 'ATIVIDADES_LIVRES') currentCat = 'AL_DESENVOLVIMENTO'; // legado

        // Layout em T: `form` tem display:contents (ver renderCatalogar) — os 2
        // wrappers abaixo é que viram os itens do grid de 5 colunas. Topo
        // (span 5): título, evidências, categoria/tipo. Esquerda (span 2,
        // oculta até um Tipo ser escolhido — updateCamposPanel): os campos do
        // item. A pré-visualização do PDF (direita, span 3) é outra section,
        // fora deste form.
        form.innerHTML = `
            <div class="lg:col-span-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <h2 class="text-lg font-bold flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-file-circle-plus text-govbr-600 dark:text-unifesp-400"></i>
                    <span id="formTitulo">${editing ? 'Editar item' : 'Novo item'}</span>
                </h2>
                <div id="draftBanner"></div>
                <div class="grid md:grid-cols-2 gap-3">
                    <div id="evidenceBlock" class="bg-govbr-50 dark:bg-gray-900 border border-govbr-100 dark:border-gray-700 rounded px-3 py-2 transition-shadow">
                        <label class="block text-xs font-semibold mb-2" for="pdfInput"><i aria-hidden="true" class="fa-solid fa-file-arrow-up text-govbr-600 dark:text-unifesp-400 mr-1"></i> <span id="pdfInputLabel">Evidências</span></label>
                        <div class="flex items-center gap-2">
                            <button type="button" id="btnEvInbox" title="Bandeja de entrada: anexar próximo arquivo pendente" class="relative w-12 h-12 shrink-0 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center disabled:opacity-40">
                                <i aria-hidden="true" class="fa-solid fa-inbox text-[2em]"></i>
                                <span id="inboxBadge" class="hidden absolute -bottom-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-govbr-600 dark:bg-unifesp-600 text-white text-[10px] leading-4 rounded-full text-center"></span>
                            </button>
                            <button type="button" id="btnEvFiles" title="Escolher arquivos (PDF, imagem, vídeo ou zip/tar.gz)" class="relative w-12 h-12 shrink-0 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center">
                                <i aria-hidden="true" class="fa-solid fa-magnifying-glass text-[2em]"></i>
                                <i aria-hidden="true" class="fa-solid fa-plus absolute -bottom-1 -right-1 w-3.5 h-3.5 text-[9px] leading-[14px] bg-govbr-600 dark:bg-unifesp-600 text-white rounded-full text-center"></i>
                            </button>
                            <button type="button" id="btnEvUrl" title="Inserir evidência por link (URL)" class="relative w-12 h-12 shrink-0 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center">
                                <i aria-hidden="true" class="fa-solid fa-pen text-[2em]"></i>
                                <span aria-hidden="true" class="absolute -bottom-1.5 -right-1.5 px-1 bg-govbr-600 dark:bg-unifesp-600 text-white text-[8px] leading-[13px] rounded">URL</span>
                            </button>
                            <button type="button" id="btnEvDrive" title="Abrir a pasta desta categoria no Google Drive" class="hidden w-12 h-12 shrink-0 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center">
                                <i aria-hidden="true" class="fa-brands fa-google-drive text-[1.6em]"></i>
                            </button>
                        </div>
                        <input type="file" id="pdfInput" multiple accept="application/pdf,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,application/zip,application/x-zip-compressed,application/gzip,application/x-gzip,application/x-tar" class="hidden">
                        <div id="evUrlRow" class="hidden mt-2 flex gap-1.5">
                            <input type="url" id="evUrlInput" placeholder="https://…" class="flex-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                            <button type="button" id="evUrlAdd" class="text-xs px-2 py-1 rounded bg-govbr-600 dark:bg-unifesp-700 text-white">Adicionar</button>
                            <button type="button" id="evUrlCancel" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Cancelar</button>
                        </div>
                        <p id="evHint" class="hidden text-xs text-gray-500 mt-2">Arraste e solte, cole (Ctrl+V) ou use os botões acima — PDF, imagem, vídeo, link ou zip/tar.gz. Marque <strong>“pública”</strong> em <em>quantas</em> evidências quiser (0 ou mais). Use ↑ ↓ para reordenar. A <strong>tag</strong> categoriza o documento (ex.: Certificado, Declaração…).</p>
                        <ul id="evList" class="mt-2 space-y-1"></ul>
                    </div>
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-semibold mb-1" for="selCategoria">Categoria</label>
                            <select id="selCategoria" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></select>
                        </div>
                        <div id="tipoWrap" class="hidden">
                            <label class="block text-xs font-semibold mb-1" for="selTipo">Tipo do item</label>
                            <select id="selTipo" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></select>
                        </div>
                    </div>
                </div>
                <p id="catNote" class="hidden text-xs text-govbr-700 dark:text-unifesp-300 bg-govbr-50 dark:bg-gray-800 border border-govbr-100 dark:border-gray-700 rounded px-2 py-1.5"></p>
            </div>

            <div id="camposPanel" class="hidden lg:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div id="dynFields" class="space-y-3"></div>
                <div id="rscBlock" class="space-y-3"></div>
                <div id="visibilidadeBlock" class="space-y-3"></div>

                <div class="space-y-1">
                    <label class="block text-xs font-semibold" for="notasGerais">Anotações gerais</label>
                    <textarea id="notasGerais" name="notasGerais" rows="3" maxlength="4000" placeholder="Escreva aqui suas conquistas, aprendizados ou impacto da atividade. Este é um campo livre e não será exportado para o Lattes ou publicado." class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc(item && item.notasGerais || '')}</textarea>
                </div>

                <p id="idInfo" class="text-xs text-gray-500"></p>

                <div class="flex gap-2 pt-1 flex-wrap">
                    <button type="submit" class="px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold hover:opacity-90" title="Atalho: Ctrl+S (Cmd+S no Mac)">
                        <i aria-hidden="true" class="fa-solid fa-floppy-disk mr-1"></i> ${editing ? 'Salvar alterações' : 'Salvar'}
                    </button>
                    <button type="button" id="btnSalvarNovo" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm" title="Salva e abre um novo item na mesma categoria/tipo. Atalho: Ctrl+Enter (Cmd+Enter no Mac), quando não há um item em edição">
                        <i aria-hidden="true" class="fa-solid fa-plus mr-1"></i> Salvar e novo
                    </button>
                    ${editing ? `<button type="button" id="btnSalvarProximo" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm" title="Salva e abre o próximo item da mesma categoria (ordem sequencial e circular). Atalho: Ctrl+Enter (Cmd+Enter no Mac)">
                        <i aria-hidden="true" class="fa-solid fa-forward mr-1"></i> Salvar e próximo
                    </button>` : ''}
                    <button type="button" id="btnLimpar" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm" title="Limpa o formulário e começa um novo item em branco">
                        <i aria-hidden="true" class="fa-solid fa-eraser mr-1"></i> Limpar
                    </button>
                    <button type="button" id="btnCancelar" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm ${editing ? '' : 'hidden'}">Cancelar</button>
                </div>
            </div>
            ${datalistsHtml()}`;

        // Categoria (select nativo) — placeholder em branco: item novo só mostra
        // os campos depois de Categoria e Tipo escolhidos explicitamente.
        const selCat = $('#selCategoria');
        selCat.innerHTML = `<option value="">— Selecione —</option>` + LattesTypes.categories
            .filter(c => !c.rscOnly || state.rscEnabled)   // categoria RSC só com o módulo ligado
            .filter(c => !c.perfilOnly)                     // Fotos de Perfil/Documentos pessoais: só via Configurações
            .map(c => `<option value="${c.key}">${esc(c.num + '. ' + c.label)}</option>`).join('');
        if (currentCat) selCat.value = currentCat;

        // ---- Tipo do item: <select> nativo (caixa de seleção), só visível após Categoria escolhida ----
        let tipoOptions = [];
        const tipoOptionsFor = (catKey) => {
            const cat = LattesTypes.categories.find(c => c.key === catKey);
            if (!cat) return [];
            if (cat.groups) return cat.groups.flatMap(g => g.types.map(tk => ({ key: tk, label: LattesTypes.label(tk), group: g.label })));
            return (cat.types || []).map(tk => ({ key: tk, label: LattesTypes.label(tk), group: null }));
        };
        function renderTipoOptions() {
            const sel = $('#selTipo'); if (!sel) return;
            let html = `<option value="">— Selecione —</option>`, last = null, open = false;
            tipoOptions.forEach(o => {
                if (o.group !== last) {
                    if (open) html += `</optgroup>`;
                    open = !!o.group;
                    if (open) html += `<optgroup label="${esc(o.group)}">`;
                    last = o.group;
                }
                html += `<option value="${o.key}">${esc(o.label)}</option>`;
            });
            if (open) html += `</optgroup>`;
            sel.innerHTML = html;
        }
        function updateTipoVisibility() {
            const wrap = $('#tipoWrap'); if (wrap) wrap.classList.toggle('hidden', !selCat.value);
        }
        function selectTipo(key, silent) {
            const sel = $('#selTipo'); if (!sel) return;
            // Garante que a option exista mesmo fora da lista atual (ex.: abrir um
            // documento de perfil/identidade a partir de Configurações).
            if (key && !sel.querySelector(`option[value="${key}"]`)) {
                const opt = document.createElement('option');
                opt.value = key; opt.textContent = LattesTypes.label(key);
                sel.appendChild(opt);
            }
            sel.value = key || '';
            updateTipoVisibility();
            if (!silent) { currentType = key; renderDynFields(); window.AppCore.saveDraftDebounced(); }
        }
        state._selectTipo = selectTipo;                  // ponte p/ restaurar rascunho
        function fillTipos() {
            tipoOptions = tipoOptionsFor(selCat.value);
            // Editando um item existente, o tipo gravado é sempre respeitado
            // mesmo que não conste mais na lista da categoria (ex.: tipo
            // legado após uma reorganização) — selectTipo() injeta a option
            // que faltar. Para item novo (ou "Salvar e novo"), só mantém se
            // for um tipo realmente válido nessa categoria; senão fica vazio,
            // exigindo clique explícito na caixa de seleção de Tipo do item.
            const valid = currentType && (editing || tipoOptions.some(o => o.key === currentType));
            currentType = valid ? currentType : '';
            renderTipoOptions();
            selectTipo(currentType, true);
            renderDynFields();
            const catNote = $('#catNote');
            if (catNote) {
                const cat = LattesTypes.categoryByKey(selCat.value);
                catNote.textContent = (cat && cat.note) || '';
                catNote.classList.toggle('hidden', !(cat && cat.note));
            }
        }
        function renderDynFields() {
            // Painel de campos (coluna esquerda) só aparece depois de um Tipo
            // do item escolhido — layout em T (topo: evidências/categoria/
            // tipo; esquerda: campos; direita: prévia do PDF).
            const camposPanel = $('#camposPanel');
            if (camposPanel) camposPanel.classList.toggle('hidden', !$('#selTipo').value);
            const def = LattesTypes.get($('#selTipo').value);
            const vals = item ? (item.fields || {}) : {};
            $('#dynFields').innerHTML = dynFieldsHtml(def ? def.fields : [], vals);
            associateLabels($('#dynFields'));           // a11y: label for/id + aria-required
            if (def && def.fields.some(f => f.type === 'areatree')) wireAreaTree($('#dynFields'), vals);
            wireValidators($('#dynFields'));             // ISSN/ISBN/DOI/URL
            wireCounters($('#dynFields'));               // contador de textareas
            wireNA($('#dynFields'));                     // checkbox "N/A" dos campos URL
            wireDateBr($('#dynFields'));                 // máscara dd/mm/aaaa (campos datebr)
            wireConditional($('#dynFields'), def);       // campos bloqueados por condição
            wireDynamicLabels($('#dynFields'), def);     // rótulos que mudam conforme outro campo
            wireRepeater($('#dynFields'), def);          // listas (Equipe, Financiadores, Produção C&T...)
            wireCrossrefButton($('#dynFields'), def);    // "Buscar metadados" no campo DOI (Crossref)
            renderRscBlock(item);                        // camada RSC (se habilitado)
            renderVisibilidadeBlock(item);                // Exportar Lattes / visibilidade / Publicar na Web
            const semEvidencia = !!(def && def.noEvidence);
            $('#evidenceBlock').style.display = semEvidencia ? 'none' : '';
            if (semEvidencia) { state.evEditing = []; renderEvList(); clearPdf(); }
            const accept = (def && def.accept) || window.AppCore.EVID_ACCEPT_DEFAULT;
            const inp = $('#pdfInput'); if (inp) inp.accept = accept;
            const lbl = $('#pdfInputLabel');
            if (lbl) lbl.textContent = accept === 'image/jpeg,image/png' ? 'Foto (JPEG ou PNG)'
                : (def && def.key === 'DOCUMENTO_PESSOAL' ? 'Documento (PDF ou imagem)' : 'Evidências (PDF, imagem, vídeo, link ou zip/tar.gz)');
            const btnDrive = $('#btnEvDrive');
            if (btnDrive) btnDrive.classList.toggle('hidden', Storage.storageMode() !== 'gdrive');
        }

        // Tipo do item: caixa de seleção nativa
        $('#selTipo').addEventListener('change', (e) => selectTipo(e.target.value));

        selCat.addEventListener('change', () => { currentType = ''; fillTipos(); window.AppCore.saveDraftDebounced(); });
        // Limpa o destaque de erro assim que o usuário corrige o campo
        $('#dynFields').addEventListener('input', (e) => { if (e.target.matches('input,select,textarea')) setFieldError(e.target, ''); });
        $('#dynFields').addEventListener('change', (e) => { if (e.target.matches('input,select,textarea')) setFieldError(e.target, ''); });

        // Evidências: carrega as do item em edição (ou lista vazia p/ novo item)
        state.evEditing = editing ? window.AppCore.evListFromItem(item) : [];
        fillTipos();
        renderEvList();

        // Anexo por seletor de arquivos
        $('#pdfInput').addEventListener('change', (e) => { addEvidenceFiles(e.target.files); e.target.value = ''; });
        // Anexo por arrastar-e-soltar
        const drop = $('#evidenceBlock');
        ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
            if (drop.style.display === 'none') return;
            e.preventDefault(); drop.classList.add('ring-2', 'ring-govbr-400');
        }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('ring-2', 'ring-govbr-400'); }));
        drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addEvidenceFiles(e.dataTransfer.files); });
        // Anexo por colar (Ctrl+V) uma imagem/arquivo
        form.addEventListener('paste', (e) => {
            if (drop.style.display === 'none') return;
            const items = e.clipboardData && e.clipboardData.items; if (!items) return;
            const files = [];
            for (const it of items) { if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); } }
            if (files.length) { e.preventDefault(); addEvidenceFiles(files); }
        });

        // Bandeja de entrada (Caixa de Entrada) — botão com badge: clique anexa o próximo
        $('#btnEvInbox').addEventListener('click', useNextInbox);
        renderInbox();
        // Escolher arquivos: abre o seletor nativo (input file oculto)
        $('#btnEvFiles').addEventListener('click', () => $('#pdfInput').click());
        // Inserir link (URL): abre/fecha a linha de entrada da URL
        $('#btnEvUrl').addEventListener('click', () => {
            const row = $('#evUrlRow');
            row.classList.toggle('hidden');
            if (!row.classList.contains('hidden')) $('#evUrlInput').focus();
        });
        $('#evUrlCancel').addEventListener('click', () => { $('#evUrlRow').classList.add('hidden'); $('#evUrlInput').value = ''; });
        $('#evUrlAdd').addEventListener('click', addUrlEvidence);
        // Abrir no Google Drive: localiza a pasta da categoria atual
        $('#btnEvDrive').addEventListener('click', () => {
            const catKey = item ? item.categoryKey : ($('#selCategoria') ? $('#selCategoria').value : null);
            window.AppCore.openGDriveFolder(LattesTypes.categoryFolder(catKey));
        });
        $('#evUrlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUrlEvidence(); } });

        // Marca "não salvo" a cada digitação e atualiza o rascunho automático
        form.addEventListener('input', () => { state.formDirty = true; window.AppCore.saveDraftDebounced(); });

        // Submit / Salvar e novo / Cancelar
        form.addEventListener('submit', onSubmitForm);
        $('#btnSalvarNovo').addEventListener('click', () => { state.saveAndNew = true; form.requestSubmit(); });
        const btnProximo = $('#btnSalvarProximo');
        if (btnProximo) btnProximo.addEventListener('click', () => { state.saveAndNext = true; form.requestSubmit(); });
        $('#btnCancelar').addEventListener('click', () => { state.editingId = null; state.evEditing = []; state.formDirty = false; buildForm(undefined, { focus: true }); });
        $('#btnLimpar').addEventListener('click', () => {
            if (state.formDirty && !confirm('Limpar os dados não salvos deste formulário?')) return;
            state.editingId = null; state.evEditing = []; state.formDirty = false;
            buildForm(undefined, { focus: true });
        });

        state.editingId = editing ? item.id : null;
        $('#idInfo').textContent = editing ? `ID: ${item.id}` : `O ID será gerado ao salvar (prefixo “${state.idPrefix}”).`;

        // Painel lateral do PDF: mostra evidência do item em edição, ou limpa
        if (editing && state.evEditing.length) showPdfForItem(item);
        else clearPdf();

        state.formDirty = false;                         // form recém-montado = limpo
        if (opts.focus) { const first = $('#dynFields').querySelector('input, select, textarea'); if (first) first.focus(); }
    }
    // Publicado em AppCore para os módulos de aba já extraídos (ex.:
    // tab-conformidade.js) poderem abrir um item no formulário — eles
    // carregam ANTES deste arquivo, então só podem ler isto em tempo de
    // clique, nunca no topo.
    window.AppCore.buildForm = buildForm;

    // Opções de ano para os seletores (decrescente). Inclui uma folga futura
    // (conclusões previstas) e garante que o valor já salvo apareça, mesmo
    // fora da faixa padrão.
    function yearOptions(val) {
        const atual = new Date().getFullYear();
        const inicio = atual + 5, fim = 1900;
        const anos = [];
        for (let y = inicio; y >= fim; y--) anos.push(y);
        const v = String(val || '').trim();
        if (v && !anos.includes(Number(v)) && /^\d{3,4}$/.test(v)) anos.unshift(Number(v));
        return anos.map(y => `<option value="${y}" ${String(y) === v ? 'selected' : ''}>${y}</option>`).join('');
    }

    // Campos que ganham autocomplete (combobox): escolha da lista OU digitação
    // de um valor novo. Sugestões = lista curada (editável em Configurações) +
    // valores já usados no catálogo.
    const AUTOCOMPLETE_KEYS = ['instituicao', 'financiador', 'entidade', 'orgao', 'editora', 'periodico', 'evento', 'evidenciaTag', 'cidade'];
    const VOCAB_LABELS = {
        instituicao: 'Instituições', financiador: 'Financiadores / Agências', entidade: 'Entidades',
        orgao: 'Órgãos', editora: 'Editoras', periodico: 'Periódicos / Revistas', evento: 'Eventos',
        evidenciaTag: 'Tags de evidências', cidade: 'Cidades',
    };
    // Tags sugeridas por padrão para categorizar evidências (documentos anexados).
    // Qualquer outro valor digitado pelo usuário também é aprendido (collectSuggestions).
    const DEFAULT_EVIDENCE_TAGS = ['Anais', 'Ata', 'Atestado', 'Capa', 'Certidão', 'Certificado', 'Comprovante',
        'Contrato', 'Convite', 'Crachá', 'Declaração', 'Diploma', 'Folder', 'Foto', 'Portaria', 'Programação',
        'Recibo', 'Relatório', 'Vídeo', 'Outros'];
    // evidenciaTag não é um campo de item.fields — vive em cada evidência
    // (item.evidencias[].tag) — por isso tem coleta/busca/renomeio à parte.
    function collectSuggestions(key) {
        const set = new Set(state.vocab[key] || []);
        if (key === 'evidenciaTag') {
            state.items.forEach(i => (i.evidencias || []).forEach(e => { if (e.tag && String(e.tag).trim()) set.add(String(e.tag).trim()); }));
        } else {
            state.items.forEach(i => { const v = i.fields && i.fields[key]; if (v && String(v).trim()) set.add(String(v).trim()); });
        }
        return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    function datalistsHtml() {
        return AUTOCOMPLETE_KEYS.map(k =>
            `<datalist id="dl-${k}">${collectSuggestions(k).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`
        ).join('');
    }

    // Renomeia/normaliza um valor de autocomplete em TODOS os itens que o usam
    // (e na lista curada). Regrava os JSONs no diretório. É a forma de "mudar
    // em um lugar só" um valor já presente em itens lançados.
    async function renameFieldValue(key, from, to) {
        const f = String(from == null ? '' : from).trim();
        const t = String(to == null ? '' : to).trim();
        if (!f) { toast('Selecione o valor a renomear.', 'aviso'); return; }
        if (!t) { toast('Informe o novo valor.', 'aviso'); return; }
        if (f === t) { toast('O novo valor é igual ao atual.', 'aviso'); return; }
        const alvo = itemsUsingValue(key, f);
        const label = VOCAB_LABELS[key] || key;
        if (!confirm(`Renomear em ${label}:\n\n"${f}"\n→ "${t}"\n\nSerá aplicado a ${alvo.length} item(ns) e a lista de sugestões. Os JSONs no diretório serão regravados. Continuar?`)) return;

        if (key === 'evidenciaTag') {
            alvo.forEach(it => (it.evidencias || []).forEach(e => { if (String(e.tag == null ? '' : e.tag).trim() === f) e.tag = t; }));
        } else {
            alvo.forEach(it => { it.fields[key] = t; });
        }
        window.AppCore.saveCatalog();

        let falhas = 0;
        if (Storage.hasDirectory()) {
            for (const it of alvo) {
                try { await Storage.writeJson(it.id, it, LattesTypes.categoryFolder(it.categoryKey)); }
                catch (_) { falhas++; }
            }
        }

        // Atualiza a lista curada: remove o antigo, garante o novo.
        const set = new Set((state.vocab[key] || []).map(s => String(s).trim()).filter(Boolean));
        set.delete(f); set.add(t);
        state.vocab[key] = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        window.AppCore.saveVocab();

        window.AppCore.renderItemList();
        window.AppCore.renderConfig();
        if (falhas) toast(`Renomeado em ${alvo.length} item(ns), mas ${falhas} JSON(s) não puderam ser regravados (verifique o diretório).`, 'aviso');
        else toast(`"${f}" → "${t}" aplicado a ${alvo.length} item(ns).`, 'ok');
    }

    // Campo "repeater": lista de linhas com colunas próprias (ex.: Equipe do
    // projeto, Financiadores, Produção C&T) — cada linha é um objeto guardado
    // num array em item.fields[chave] (o app já serializa fields inteiro como
    // JSON, então não precisamos achatar em texto). O valor "ao vivo" fica num
    // <input type="hidden"> com o array em JSON; collectFields() faz o parse.
    function repeaterRowLabel(f, row) {
        return f.columns.map(c => {
            const v = row[c.key];
            if (c.type === 'checkbox') return v ? c.label : '';
            return v;
        }).filter(Boolean).join(' · ');
    }
    function repeaterListHtml(f, rows) {
        if (!rows.length) return `<li class="text-xs text-gray-400 dark:text-gray-500 italic">Nenhum item adicionado.</li>`;
        return rows.map((row, i) => `<li class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm" data-repeater-row="${i}">
            <span class="flex-1 min-w-0 truncate">${esc(repeaterRowLabel(f, row) || '(sem descrição)')}</span>
            <button type="button" data-repeater-del="${f.key}" data-idx="${i}" title="Remover" class="w-6 h-6 shrink-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i aria-hidden="true" class="fa-solid fa-trash"></i></button>
        </li>`).join('');
    }
    function repeaterColInput(fkey, c) {
        const base = 'text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900';
        const tag = `data-repeater-input="${fkey}:${c.key}"`;
        if (c.type === 'checkbox') return `<label class="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" ${tag}> ${esc(c.label)}</label>`;
        if (c.type === 'select') return `<select ${tag} class="${base}"><option value="">${esc(c.label)}</option>${(c.options || []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
        if (c.type === 'datebr') return `<input type="text" ${tag} inputmode="numeric" maxlength="10" placeholder="${esc(c.label)}" data-datebr class="${base}" style="width:7rem">`;
        const t = c.type === 'number' ? 'number' : 'text';
        return `<input type="${t}" ${tag} placeholder="${esc(c.label)}" class="${base}" style="min-width:9rem">`;
    }

    function fieldHtml(f, val, compact) {
        // `undefined` = campo nunca definido (item novo, ou tipo ganhou o campo
        // depois de itens antigos existirem) → usa o padrão, se houver. Já um
        // valor vazio já salvo ('') é uma escolha explícita do usuário e não é
        // sobrescrito.
        if (val === undefined && f.default != null) val = f.default;
        val = val == null ? '' : val;
        const req = f.required ? 'required' : '';
        const reqMark = f.required ? ' <span class="text-red-500">*</span>' : '';
        const base = 'w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900';
        let input;
        if (f.type === 'textarea') {
            const max = f.maxlength || 4000;
            input = `<textarea name="${f.key}" ${req} rows="2" maxlength="${max}" data-maxcount="${max}" placeholder="${esc(f.placeholder || '')}" class="${base}">${esc(val)}</textarea>
                <p class="text-[11px] text-gray-400 dark:text-gray-500 text-right mt-0.5" data-counter-for="${f.key}"></p>`;
        } else if (f.type === 'select') {
            input = `<select name="${f.key}" ${req} class="${base}">
                <option value="">—</option>
                ${f.options.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select>`;
        } else if (f.type === 'datebr') {
            // Data aaaa, mm/aaaa OU dd/mm/aaaa (texto com máscara). Guardada por
            // extenso para controle interno; na exportação XML Lattes só o ano
            // é mantido (o schema só aceita ANO). Valor ISO (aaaa-mm-dd), herdado
            // de importação/legado, vira dd/mm/aaaa.
            let dv = val == null ? '' : String(val);
            const iso = dv.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (iso) dv = `${iso[3]}/${iso[2]}/${iso[1]}`;
            const dph = compact ? 'aaaa' : 'aaaa, mm/aaaa ou dd/mm/aaaa';
            // Largura fixa (não w-full): o valor nunca passa de 10 caracteres
            // (dd/mm/aaaa), então o campo não deve esticar para preencher a linha.
            const dateBase = base.replace('w-full', 'w-32');
            input = `<input type="text" name="${f.key}" value="${esc(dv)}" ${req} inputmode="numeric" maxlength="10" placeholder="${dph}" data-datebr class="${dateBase}">`;
        } else if (f.type === 'checkboxes') {
            const selected = String(val || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            input = `<div class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                ${f.options.map(o => {
                    const desc = f.descriptions && f.descriptions[o];
                    const cb = `<input type="checkbox" data-cbgroup="${f.key}" value="${esc(o)}" ${selected.includes(o) ? 'checked' : ''} class="mt-0.5">`;
                    if (!desc) return `<label class="flex items-center gap-1.5 text-sm">${cb} ${esc(o)}</label>`;
                    return `<label class="flex items-start gap-1.5 text-sm w-full">${cb}
                        <span>${esc(o)}
                            <details class="mt-0.5"><summary class="text-xs text-govbr-700 dark:text-unifesp-400 cursor-pointer select-none">Ver definição legal</summary>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">${esc(desc)}</p></details>
                        </span></label>`;
                }).join('')}
            </div>`;
        } else if (f.type === 'skilllevels') {
            const levels = f.levels || ['Bom', 'Razoável', 'Pouco'];
            const map = {};
            String(val || '').split(';').forEach(pair => {
                const idx = pair.indexOf(':');
                if (idx > -1) { const s = pair.slice(0, idx).trim(), l = pair.slice(idx + 1).trim(); if (s && l) map[s] = l; }
            });
            input = `<div class="space-y-1 pt-1">
                ${f.options.map(sk => `<div class="flex items-center gap-2 text-sm">
                    <span class="w-32 shrink-0">${esc(sk)}</span>
                    <select data-slgroup="${f.key}" data-skill="${esc(sk)}" class="${base}">
                        <option value="">—</option>
                        ${levels.map(l => `<option value="${esc(l)}" ${map[sk] === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                    </select>
                </div>`).join('')}
            </div>`;
        } else if (f.type === 'areatree') {
            // Cascata CNPq/CAPES: 4 selects dependentes (preenchidos por wireAreaTree)
            const sel = (lvl, lbl) => `<select data-areatree="${lvl}" class="${base}"><option value="">${lbl}</option></select>`;
            input = `<div data-areatree-group class="space-y-1.5">
                ${sel('g', '— Grande área —')}
                ${sel('a', '— Área —')}
                ${sel('s', '— Subárea —')}
                ${sel('e', '— Especialidade —')}
            </div>`;
        } else if (f.type === 'cnaeSetores') {
            // Até 3 setores (lista CNAE fixa) — schema Lattes tem 3 atributos
            // nomeados (SETOR-DE-ATIVIDADE-1..3), por isso 3 selects fixos.
            const chosen = String(val || '').split(';').map(s => s.trim()).filter(Boolean);
            const opts = window.CNAE_SETORES || [];
            const sel = (i) => `<select data-setor="${i}" class="${base}">
                <option value="">— Setor ${i} —</option>
                ${opts.map(o => `<option value="${esc(o)}" ${chosen[i - 1] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select>`;
            input = `<div class="space-y-1.5">${[1, 2, 3].map(sel).join('')}</div>`;
        } else if (f.type === 'repeater') {
            // Migra valor antigo em texto livre (ex.: campo que era textarea e
            // virou repeater) para o novo formato de lista, sem perder os
            // dados já salvos — um valor por linha vira uma linha da lista.
            let rows = Array.isArray(val) ? val : [];
            if (!rows.length && typeof val === 'string' && val.trim() && f.columns && f.columns.length === 1) {
                const col = f.columns[0].key;
                rows = val.split('\n').map(s => s.trim()).filter(Boolean).map(nome => ({ [col]: nome }));
            }
            input = `<div data-repeater-wrap="${f.key}">
                <input type="hidden" name="${f.key}" data-repeater="${f.key}" value='${esc(JSON.stringify(rows))}'>
                <ul data-repeater-list="${f.key}" class="space-y-1 mb-1.5">${repeaterListHtml(f, rows)}</ul>
                <div class="flex flex-wrap items-center gap-1.5">
                    ${f.columns.map(c => repeaterColInput(f.key, c)).join('')}
                    <button type="button" data-repeater-add="${f.key}" class="px-2 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-xs whitespace-nowrap"><i aria-hidden="true" class="fa-solid fa-plus"></i> ${esc(f.addLabel || 'Adicionar')}</button>
                </div>
            </div>`;
        } else if (f.type === 'checkbox') {
            // Pergunta Sim/Não como caixa de seleção única (marcado = Sim,
            // desmarcado = Não — nunca fica em branco, como o padrão do Lattes).
            // Pergunta e caixa ficam na mesma linha (foge do wrapper padrão
            // label-em-cima/campo-embaixo usado pelos demais tipos de campo).
            return `<div data-field="${f.key}" class="${compact ? 'w-24 shrink-0' : ''}">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="${f.key}" ${val === 'Sim' ? 'checked' : ''}> ${esc(f.label)}${reqMark}</label>
                ${f.help ? `<p class="text-xs text-gray-500 mt-0.5">${esc(f.help)}</p>` : ''}
            </div>`;
        } else if (f.type === 'url') {
            // URL + "N/A" (Não se aplica): conta como preenchido; vai em branco no XML
            const na = String(val) === NA_VALUE;
            input = `<div class="flex items-center gap-2">
                <input type="url" name="${f.key}" value="${na ? '' : esc(val)}" ${req} data-validate="url" maxlength="300" placeholder="https://…" class="${base} flex-1 ${na ? 'opacity-50' : ''}" ${na ? 'disabled' : ''}>
                <label class="flex items-center gap-1 text-xs shrink-0 whitespace-nowrap" title="Marque quando não há URL. Conta como preenchido; na exportação XML vai em branco.">
                    <input type="checkbox" data-na="${f.key}" ${na ? 'checked' : ''}> N/A
                </label>
            </div>`;
        } else if (f.key === 'doi') {
            // Campo DOI com botão "Buscar metadados" (Crossref) ao lado —
            // autopreenche título/ano/periódico/autores etc. do tipo atual
            // (issue #5). Feedback de carregamento/erro fica no <p> abaixo.
            input = `<div class="flex items-center gap-2">
                <input type="text" name="doi" value="${esc(val)}" data-validate="doi" maxlength="500" placeholder="${esc(f.placeholder || '10.xxxx/xxxxx')}" class="${base} flex-1">
                <button type="button" data-crossref-btn class="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs whitespace-nowrap shrink-0"><i aria-hidden="true" class="fa-solid fa-magnifying-glass mr-1"></i>Buscar metadados</button>
            </div>
            <p class="text-xs text-gray-500 mt-0.5" data-crossref-status></p>`;
        } else {
            const t = (f.type === 'url' ? 'url' : (f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')));
            const listAttr = (t === 'text' && AUTOCOMPLETE_KEYS.includes(f.key)) ? `list="dl-${f.key}"` : '';
            let vkind = '';
            if (f.validate) vkind = f.validate;
            else if (f.key === 'issn' || f.key === 'isbn' || f.key === 'doi') vkind = f.key;
            else if (t === 'url') vkind = 'url';
            const vAttr = vkind ? `data-validate="${vkind}"` : '';
            const ph = f.placeholder || (f.key === 'issn' ? '0000-0000'
                : f.key === 'isbn' ? 'ISBN-10 ou ISBN-13'
                : t === 'url' ? 'https://…' : '');
            const extra = t === 'number' ? 'min="0" step="any"'
                : `maxlength="${f.maxlength || (t === 'url' ? 300 : 500)}"`;
            if (f.na) {
                // Campo + "N/A" (Não se aplica), mesmo padrão do campo URL:
                // conta como preenchido; vai em branco numa futura exportação.
                const na = String(val) === NA_VALUE;
                input = `<div class="flex items-center gap-2">
                    <input type="${t}" name="${f.key}" value="${na ? '' : esc(val)}" ${req} ${listAttr} ${vAttr} ${extra} placeholder="${esc(ph)}" class="${base} flex-1 ${na ? 'opacity-50' : ''}" ${na ? 'disabled' : ''}>
                    <label class="flex items-center gap-1 text-xs shrink-0 whitespace-nowrap" title="Marque quando não se aplica. Conta como preenchido.">
                        <input type="checkbox" data-na="${f.key}" ${na ? 'checked' : ''}> N/A
                    </label>
                </div>`;
            } else {
                input = `<input type="${t}" name="${f.key}" value="${esc(val)}" ${req} ${listAttr} ${vAttr} ${extra} placeholder="${esc(ph)}" class="${base}">`;
            }
        }
        return `<div data-field="${f.key}" class="${compact ? 'w-24 shrink-0' : ''}">
            <label class="block text-xs font-semibold mb-1">${esc(f.label)}${reqMark}</label>
            ${input}
            ${f.help ? `<p class="text-xs text-gray-500 mt-0.5">${esc(f.help)}</p>` : ''}
        </div>`;
    }
    // Monta o HTML dos campos dinâmicos, agrupando na mesma linha os campos
    // consecutivos que compartilham `f.row` (ex.: Ano início/Ano fim, ou a
    // "Quantidade de alunos" de Projetos) — cada um renderizado compacto
    // (`fieldHtml(f, val, true)`), lado a lado num flex-wrap. `def.fields`
    // continua uma lista plana — collectFields/validateItemFields/
    // wireConditional não precisam saber desse agrupamento visual.
    function dynFieldsHtml(fields, vals) {
        const list = fields || [];
        let html = '', i = 0;
        while (i < list.length) {
            const f = list[i];
            if (f.row) {
                const group = [f]; i++;
                while (i < list.length && list[i].row === f.row) { group.push(list[i]); i++; }
                html += `<div class="flex flex-wrap items-end gap-3">${group.map(sf => fieldHtml(sf, vals[sf.key], true)).join('')}</div>`;
            } else {
                html += fieldHtml(f, vals[f.key]);
                i++;
            }
        }
        return html;
    }

    function wireValidators(container) {
        $$('[data-validate]', container).forEach(el => {
            el.addEventListener('blur', () => {
                const v = el.value.trim();
                const res = validateField(el.dataset.validate, v);
                if (v && !res.ok) setFieldError(el, res.msg);
                else { setFieldError(el, ''); if (v && res.value) el.value = res.value; } // normaliza (hífen)
            });
            el.addEventListener('input', () => setFieldError(el, '')); // limpa erro ao digitar
        });
    }
    // Contador de caracteres para textareas com data-maxcount
    function wireCounters(container) {
        $$('textarea[data-maxcount]', container).forEach(ta => {
            const max = +ta.dataset.maxcount;
            const out = container.querySelector(`[data-counter-for="${ta.name}"]`);
            if (!out) return;
            const upd = () => { out.textContent = `${ta.value.length}/${max}`; };
            upd();
            ta.addEventListener('input', upd);
        });
    }
    // Máscara para campos 'datebr': aceita aaaa, mm/aaaa OU dd/mm/aaaa. Até 4
    // dígitos fica só o ano (sem barra); a 1ª barra só entra a partir do 5º
    // dígito (aí é mm/aaaa) e a 2ª a partir do 7º (dd/mm/aaaa) — assim dá para
    // digitar um ano puro sem ele virar "mm/aaaa" pela metade.
    function wireDateBr(container) {
        $$('[data-datebr]', container).forEach(el => {
            el.addEventListener('input', () => {
                const d = el.value.replace(/\D/g, '').slice(0, 8);
                let out = d;
                if (d.length > 6) out = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4); // dd/mm/aaaa
                else if (d.length > 4) out = d.slice(0, 2) + '/' + d.slice(2);                   // mm/aaaa (ou dd/mm em progresso)
                el.value = out;
            });
        });
    }
    // Campos com `disabledWhen`: esconde o campo inteiro (bloco data-field) e
    // limpa o valor quando o campo controlador atinge o valor da condição
    // (e reaparece quando sai dela) — em vez de só desabilitar/acinzentar,
    // para telas com muitos campos condicionais (ex.: Formação acadêmica,
    // onde cada Nível usa um subconjunto bem diferente de campos).
    // Lê o valor "lógico" de um controlador (checkbox Sim/Não vira 'Sim'/'Não';
    // os demais controles usam .value normalmente).
    const controlValue = (el) => el.type === 'checkbox' ? (el.checked ? 'Sim' : 'Não') : el.value;
    function wireConditional(container, def) {
        (def && def.fields || []).filter(f => f.disabledWhen).forEach(f => {
            const conds = Array.isArray(f.disabledWhen) ? f.disabledWhen : [f.disabledWhen];
            const ctrls = conds.map(c => container.querySelector(`[name="${c.field}"]`)).filter(Boolean);
            const wrap = container.querySelector(`[data-field="${f.key}"]`);
            if (!ctrls.length || !wrap) return;
            const input = container.querySelector(`[name="${f.key}"]`);
            const apply = () => {
                const vals = {}; conds.forEach(c => { const el = container.querySelector(`[name="${c.field}"]`); if (el) vals[c.field] = controlValue(el); });
                const off = isFieldDisabled(f, vals);
                wrap.classList.toggle('hidden', off);
                if (off) {
                    if (input) { input.value = ''; if (input.type === 'checkbox') input.checked = false; input.removeAttribute('required'); input.dispatchEvent(new Event('change')); } // propaga p/ campos encadeados (ex.: comBolsa → bolsa)
                    $$(`[data-cbgroup="${f.key}"]`, wrap).forEach(cb => { cb.checked = false; });
                    $$(`[data-areatree]`, wrap).forEach(sel => { sel.value = ''; });
                    $$(`[data-setor]`, wrap).forEach(sel => { sel.value = ''; });
                } else if (input && f.required) {
                    input.required = true;
                }
            };
            // 'input' garante reação imediata em controladores de texto livre
            // (ex.: País) — 'change' sozinho só dispara ao perder o foco.
            ctrls.forEach(ctrl => { ctrl.addEventListener('change', apply); ctrl.addEventListener('input', apply); });
            apply(); // estado inicial
        });
    }
    // Campos com `labelWhen`: troca o texto do <label> conforme o valor do
    // campo controlador (ex.: "Título da dissertação/tese" vira "Título
    // monografia" quando o Nível é Graduação) — o campo em si (chave/valor)
    // continua único; só o rótulo muda.
    function wireDynamicLabels(container, def) {
        (def && def.fields || []).filter(f => f.labelWhen).forEach(f => {
            const ctrl = container.querySelector(`[name="${f.labelWhen.field}"]`);
            const wrap = container.querySelector(`[data-field="${f.key}"]`);
            const label = wrap && wrap.querySelector(':scope > label');
            if (!ctrl || !label) return;
            const apply = () => {
                const text = f.labelWhen.map[ctrl.value] || f.label;
                label.innerHTML = esc(text) + (f.required ? ' <span class="text-red-500">*</span>' : '');
            };
            ctrl.addEventListener('change', apply);
            apply();
        });
    }
    // Campos "repeater" (Equipe do projeto, Financiadores, Produção C&T,
    // Orientações...): lista + mini-formulário de adicionar linha. O array de
    // linhas vive no <input type="hidden"> (JSON) — collectFields() lê de lá.
    function wireRepeater(container, def) {
        (def && def.fields || []).filter(f => f.type === 'repeater').forEach(f => {
            const wrap = container.querySelector(`[data-repeater-wrap="${f.key}"]`);
            if (!wrap) return;
            const hidden = wrap.querySelector(`[data-repeater="${f.key}"]`);
            const list = wrap.querySelector(`[data-repeater-list="${f.key}"]`);
            const getRows = () => { try { return JSON.parse(hidden.value || '[]'); } catch (_) { return []; } };
            const wireRowRemove = () => {
                $$(`[data-repeater-del="${f.key}"]`, list).forEach(b => b.addEventListener('click', () => {
                    const rows = getRows(); rows.splice(Number(b.dataset.idx), 1); setRows(rows);
                }));
            };
            const setRows = (rows) => { hidden.value = JSON.stringify(rows); list.innerHTML = repeaterListHtml(f, rows); wireRowRemove(); };
            wrap._setRows = setRows; // exposto para preenchimento programático (ex.: Crossref)
            wireRowRemove();
            // Coluna com `enabledWhenCol: { key, equals }`: só habilita (e limpa
            // ao desabilitar) quando OUTRA coluna do mesmo formulário de
            // adicionar-linha tiver exatamente esse valor (ex.: UF só habilita
            // quando País = Brasil).
            f.columns.filter(c => c.enabledWhenCol).forEach(c => {
                const dep = wrap.querySelector(`[data-repeater-input="${f.key}:${c.key}"]`);
                const ctrl = wrap.querySelector(`[data-repeater-input="${f.key}:${c.enabledWhenCol.key}"]`);
                if (!dep || !ctrl) return;
                const apply = () => {
                    const on = normNome(ctrl.value) === normNome(c.enabledWhenCol.equals);
                    dep.disabled = !on;
                    if (!on) dep.value = '';
                };
                ctrl.addEventListener('input', apply);
                ctrl.addEventListener('change', apply);
                apply();
            });
            const addBtn = wrap.querySelector(`[data-repeater-add="${f.key}"]`);
            if (!addBtn) return;
            addBtn.addEventListener('click', () => {
                const row = {}; let ok = true;
                f.columns.forEach(c => {
                    const el = wrap.querySelector(`[data-repeater-input="${f.key}:${c.key}"]`);
                    if (!el) return;
                    if (c.type === 'checkbox') { row[c.key] = el.checked; return; }
                    const v = el.value.trim();
                    if (c.required && !v) ok = false;
                    row[c.key] = v;
                });
                if (!ok) { toast('Preencha os campos obrigatórios do item antes de adicionar.', 'aviso'); return; }
                const rows = getRows(); rows.push(row); setRows(rows);
                f.columns.forEach(c => {
                    const el = wrap.querySelector(`[data-repeater-input="${f.key}:${c.key}"]`);
                    if (!el) return;
                    if (c.type === 'checkbox') el.checked = false; else el.value = '';
                });
            });
        });
    }

    /* =====================================================================
       BUSCAR METADADOS NO CROSSREF (a partir do DOI) — issue #5
       ---------------------------------------------------------------------
       Ao clicar em "Buscar metadados" no campo DOI, consulta a API pública
       do Crossref (sem chave) e autopreenche os campos do tipo ATUAL do
       formulário (título, ano, periódico/ISSN, volume/fascículo/páginas,
       autores) — só os campos que aquele tipo realmente tem. Só sobrescreve
       campo já preenchido se a usuária confirmar.
       ===================================================================== */
    async function fetchCrossrefMetadata(doi) {
        const clean = String(doi || '').trim().replace(/^\s*(https?:\/\/)?(dx\.)?doi\.org\//i, '').trim();
        if (!/^10\.\d{4,9}\/\S+$/.test(clean)) throw new Error('Preencha um DOI válido (formato 10.xxxx/sufixo) antes de buscar.');
        let resp;
        try { resp = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, { headers: { 'Accept': 'application/json' } }); }
        catch (_) { throw new Error('Não foi possível conectar ao Crossref — verifique sua conexão com a internet.'); }
        if (resp.status === 404) throw new Error('DOI não encontrado no Crossref.');
        if (!resp.ok) throw new Error(`Crossref retornou um erro (HTTP ${resp.status}).`);
        const data = await resp.json();
        return (data && data.message) || {};
    }
    // Converte a resposta do Crossref (`message`) nos campos do tipo ATUAL
    // (`def`) — só preenche o que o tipo realmente tem (ex.: só ARTIGO_PERIODICO
    // tem "periodico"; TRABALHO_EVENTO não tem, mas tem volume/fascículo).
    function crossrefToFields(def, message) {
        const temCampo = (k) => def && def.fields.some((f) => f.key === k);
        const fields = {};
        const titulo = Array.isArray(message.title) ? message.title[0] : '';
        if (titulo && temCampo('titulo')) fields.titulo = titulo;

        const datas = message.published || message['published-print'] || message['published-online'] || message.issued || {};
        const ano = datas['date-parts'] && datas['date-parts'][0] && datas['date-parts'][0][0];
        if (ano && temCampo('ano')) fields.ano = String(ano);

        const periodico = Array.isArray(message['container-title']) ? message['container-title'][0] : '';
        if (periodico && temCampo('periodico')) fields.periodico = periodico;

        const issn = Array.isArray(message.ISSN) ? message.ISSN[0] : '';
        if (issn && temCampo('issn')) fields.issn = issn;

        if (message.volume && temCampo('volume')) fields.volume = String(message.volume);
        if (message.issue && temCampo('fasciculo')) fields.fasciculo = String(message.issue);

        if (message.page) {
            const [ini, fim] = String(message.page).split('-').map((s) => s.trim());
            if (ini && temCampo('paginaInicial')) fields.paginaInicial = ini;
            if (fim && temCampo('paginaFinal')) fields.paginaFinal = fim;
        }

        if (Array.isArray(message.author) && message.author.length && temCampo('autoresLista')) {
            const nomes = message.author.map((a) => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean);
            if (nomes.length) fields.autoresLista = nomes.map((nome) => ({ nomeCompleto: nome, nomeCitacao: '' }));
        }
        return fields;
    }
    function wireCrossrefButton(container, def) {
        const btn = container.querySelector('[data-crossref-btn]');
        if (!btn) return;
        const statusEl = container.querySelector('[data-crossref-status]');
        const setStatus = (msg, isErr) => {
            if (!statusEl) return;
            statusEl.textContent = msg || '';
            statusEl.classList.toggle('text-red-600', !!isErr);
            statusEl.classList.toggle('dark:text-red-400', !!isErr);
        };
        btn.addEventListener('click', async () => {
            const doiInput = container.querySelector('[name="doi"]');
            const original = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Buscando…';
            setStatus('');
            try {
                const message = await fetchCrossrefMetadata(doiInput ? doiInput.value : '');
                const novos = crossrefToFields(def, message);
                const chaves = Object.keys(novos);
                if (!chaves.length) { setStatus('Nenhum dado aproveitável encontrado para esse DOI.', true); return; }

                const estaPreenchido = (k) => {
                    if (k === 'autoresLista') {
                        const wrap = container.querySelector('[data-repeater-wrap="autoresLista"]');
                        const hidden = wrap && wrap.querySelector('[data-repeater="autoresLista"]');
                        try { return hidden && JSON.parse(hidden.value || '[]').length > 0; } catch (_) { return false; }
                    }
                    const el = container.querySelector(`[name="${k}"]`);
                    return !!(el && el.value.trim());
                };
                const conflitantes = chaves.filter(estaPreenchido);
                let substituir = true;
                if (conflitantes.length) {
                    const rotulos = conflitantes.map((k) => (def.fields.find((f) => f.key === k) || {}).label || k).join(', ');
                    substituir = confirm(`${conflitantes.length} campo(s) já preenchido(s) (${rotulos}). Substituir também esses pelos dados do Crossref?`);
                }
                let aplicados = 0;
                chaves.forEach((k) => {
                    if (!substituir && conflitantes.includes(k)) return;
                    if (k === 'autoresLista') {
                        const wrap = container.querySelector('[data-repeater-wrap="autoresLista"]');
                        if (wrap && wrap._setRows) { wrap._setRows(novos.autoresLista); aplicados++; }
                        return;
                    }
                    const el = container.querySelector(`[name="${k}"]`);
                    if (el) { el.value = novos[k]; aplicados++; }
                });
                state.formDirty = true;
                setStatus(`${aplicados} campo(s) preenchido(s) a partir do Crossref.`);
            } catch (e) {
                setStatus(e.message, true);
            } finally {
                btn.disabled = false; btn.innerHTML = original;
            }
        });
    }

    // Checkbox "N/A" (Não se aplica): bloqueia/limpa o input associado.
    // Usado nos campos URL e em qualquer campo com `na: true` na definição.
    function wireNA(container) {
        $$('[data-na]', container).forEach(cb => cb.addEventListener('change', () => {
            const input = container.querySelector(`[name="${cb.dataset.na}"]`);
            if (!input) return;
            if (cb.checked) { input.value = ''; input.disabled = true; input.classList.add('opacity-50'); setFieldError(input, ''); }
            else { input.disabled = false; input.classList.remove('opacity-50'); input.focus(); }
            state.formDirty = true;
            window.AppCore.saveDraftDebounced();
        }));
    }

    // Preenche e conecta a cascata Grande área > Área > Subárea > Especialidade
    function wireAreaTree(container, vals) {
        const DATA = window.AreasConhecimento || [];
        const g = container.querySelector('[data-areatree="g"]');
        const a = container.querySelector('[data-areatree="a"]');
        const s = container.querySelector('[data-areatree="s"]');
        const e = container.querySelector('[data-areatree="e"]');
        if (!g || !a || !s || !e) return;

        const fill = (sel, placeholder, names, current) => {
            sel.innerHTML = `<option value="">${esc(placeholder)}</option>` +
                names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
            if (current) {
                const want = normNome(current);
                const opt = Array.from(sel.options).find(o => o.value && normNome(o.value) === want);
                sel.value = opt ? opt.value : '';
            } else sel.value = '';
        };
        const findG = () => DATA.find(x => x.n === g.value);
        const findA = () => { const G = findG(); return G ? G.a.find(x => x.n === a.value) : null; };
        const findS = () => { const A = findA(); return A ? A.s.find(x => x.n === s.value) : null; };
        const refillA = cur => { const G = findG(); fill(a, '— Área —', G ? G.a.map(x => x.n) : [], cur); a.disabled = !G; };
        const refillS = cur => { const A = findA(); fill(s, '— Subárea —', A ? A.s.map(x => x.n) : [], cur); s.disabled = !A; };
        const refillE = cur => { const S = findS(); fill(e, '— Especialidade —', S ? S.e : [], cur); e.disabled = !S; };

        fill(g, '— Grande área —', DATA.map(x => x.n), vals.grandeArea);
        refillA(vals.area); refillS(vals.subarea); refillE(vals.especialidade);

        g.addEventListener('change', () => { refillA(''); refillS(''); refillE(''); });
        a.addEventListener('change', () => { refillS(''); refillE(''); });
        s.addEventListener('change', () => { refillE(''); });
    }

    // Coleta os valores dos campos de um formulário conforme a definição do tipo
    function collectFields(form, def) {
        const fields = {};
        def.fields.forEach(f => {
            if (f.type === 'checkboxes') {
                fields[f.key] = $$(`[data-cbgroup="${f.key}"]`, form).filter(c => c.checked).map(c => c.value).join('; ');
            } else if (f.type === 'skilllevels') {
                fields[f.key] = $$(`[data-slgroup="${f.key}"]`, form).filter(s => s.value).map(s => `${s.dataset.skill}: ${s.value}`).join('; ');
            } else if (f.type === 'areatree') {
                const gv = q => { const el = form.querySelector(`[data-areatree="${q}"]`); return el ? el.value.trim() : ''; };
                const G = gv('g'), A = gv('a'), S = gv('s'), E = gv('e');
                fields.grandeArea = G; fields.area = A; fields.subarea = S; fields.especialidade = E;
                fields[f.key] = (G && A) ? [G, A, S, E].filter(Boolean).join(' > ') : ''; // separador ASCII (compatível com ISO-8859-1)
            } else if (f.type === 'cnaeSetores') {
                fields[f.key] = [1, 2, 3].map(i => { const el = form.querySelector(`[data-setor="${i}"]`); return el ? el.value.trim() : ''; }).filter(Boolean).join('; ');
            } else if (f.type === 'repeater') {
                const el = form.querySelector(`[data-repeater="${f.key}"]`);
                try { fields[f.key] = el ? JSON.parse(el.value || '[]') : []; } catch (_) { fields[f.key] = []; }
            } else if (f.type === 'checkbox') {
                const el = form.querySelector(`[name="${f.key}"]`);
                fields[f.key] = el && el.checked ? 'Sim' : 'Não';
            } else if (f.type === 'url' || f.na) {
                const na = form.querySelector(`[data-na="${f.key}"]`);
                if (na && na.checked) fields[f.key] = NA_VALUE;
                else { const el = form.elements[f.key]; fields[f.key] = el ? el.value.trim() : ''; }
            } else {
                const el = form.elements[f.key];
                if (el) fields[f.key] = el.value.trim();
            }
        });
        // Zera campos bloqueados por condição (não devem ser gravados)
        def.fields.forEach(f => { if (isFieldDisabled(f, fields)) fields[f.key] = ''; });
        return fields;
    }
    // Normaliza pontuação tipográfica dos campos-texto p/ compatibilidade
    // ISO-8859-1 (futura exportação ao Lattes). Retorna nº de caracteres que
    // ainda ficaram fora do Latin-1 (ex.: emoji) — que viram entidades no XML.
    function normalizeEncoding(fields) {
        let residual = 0;
        const normStr = (s) => {
            // Remove caracteres de controle (preserva \t e \n) — integridade
            s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
            if (window.LzEncoding) {
                try { s = LzEncoding.normalizePunctuation(s); } catch (_) {}
                try { residual += (LzEncoding.findNonLatin1(s) || []).length; } catch (_) {}
            }
            return s;
        };
        Object.keys(fields).forEach(k => {
            if (Array.isArray(fields[k])) {
                // Campo "repeater" (Equipe, Financiadores...): normaliza os textos de cada linha.
                fields[k].forEach(row => { Object.keys(row || {}).forEach(rk => { if (typeof row[rk] === 'string' && row[rk]) row[rk] = normStr(row[rk]); }); });
                return;
            }
            if (typeof fields[k] !== 'string' || !fields[k]) return;
            fields[k] = normStr(fields[k]);
        });
        return residual;
    }

    // Chave lógica p/ detectar duplicatas (tipo + título normalizado + ano).
    // Retorna null quando não há título — aí não arriscamos falso positivo.
    function dupKey(typeKey, fields) {
        fields = fields || {};
        const title = normNome(fields.titulo || fields.curso || fields.orientando || fields.candidato || fields.grandeArea || '');
        if (!title) return null;
        const ano = anoDe(fields.ano || fields.anoFim || fields.anoInicio || '');
        return typeKey + '|' + title + '|' + ano;
    }

    // Resolve o elemento visual de um campo (p/ marcar erro inline)
    function fieldControl(form, f) {
        if (!form) return null;
        if (f.type === 'areatree') return form.querySelector('[data-areatree="g"]');
        if (f.type === 'checkboxes') return form.querySelector(`[data-cbgroup="${f.key}"]`);
        if (f.type === 'skilllevels') return form.querySelector(`[data-slgroup="${f.key}"]`);
        return (form.elements && form.elements[f.key]) || form.querySelector(`[name="${f.key}"]`);
    }
    // Valida obrigatórios + coerência de anos + ISSN/ISBN. Marca erros inline
    // (única via de validação — o form usa novalidate, sem "balão" nativo).
    function validateItemFields(def, fields, form) {
        // limpa erros anteriores dos campos deste tipo
        def.fields.forEach(f => { const el = fieldControl(form, f); if (el) setFieldError(el, ''); });

        // 1) Obrigatórios — destaca todos e foca o primeiro
        const faltando = def.fields.filter(f => f.required && !fields[f.key]);
        if (faltando.length) {
            let first = null;
            faltando.forEach(f => { const el = fieldControl(form, f); if (el) { setFieldError(el, 'Campo obrigatório.'); if (!first) first = el; } });
            if (first) { first.focus(); first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            toast('Preencha os campos obrigatórios destacados: ' + faltando.map(f => f.label).join(', '), 'aviso');
            return false;
        }

        // 2) Coerência de anos: fim não pode ser anterior ao início. Extrai o
        //    ANO de qualquer formato (aaaa, aaaa-mm-dd ou dd/mm/aaaa — datebr).
        //    O campo de início chama 'anoInicio' nos tipos com período completo
        //    (Atuação, Projetos…) e só 'ano' nos demais (Ano de início/fim).
        const _yr = s => { const y = anoDe(s); return y ? +y : null; };
        const inicioKey = def.fields.some(f => f.key === 'anoInicio') ? 'anoInicio' : 'ano';
        const ini = _yr(fields[inicioKey]), fim = _yr(fields.anoFim);
        if (ini && fim && fim < ini) {
            const el = fieldControl(form, { key: 'anoFim' });
            if (el) { setFieldError(el, 'O ano de fim não pode ser anterior ao de início.'); el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            toast('O ano de fim não pode ser anterior ao de início.', 'aviso');
            return false;
        }

        // 3) Formatos específicos (ISSN/ISBN/DOI/URL) e números ≥ 0
        for (const f of def.fields) {
            const raw = fields[f.key];
            // Marcado "Não se aplica" — não valida formato/número. Campos URL
            // sempre oferecem N/A (independente de `f.na`, só usado pelos
            // demais tipos), então entram aqui mesmo sem esse flag.
            if (raw === NA_VALUE && (f.na || f.type === 'url')) continue;
            const kind = f.validate ? f.validate : (f.key === 'issn' || f.key === 'isbn' || f.key === 'doi') ? f.key : (f.type === 'url' ? 'url' : null);
            if (kind) {
                if (raw == null || raw === '') continue;
                const res = validateField(kind, raw);
                if (!res.ok) {
                    toast(res.msg, 'aviso');
                    const el = fieldControl(form, f);
                    if (el) { setFieldError(el, res.msg); el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    return false;
                }
                fields[f.key] = res.value; // valor normalizado
            } else if (f.type === 'number' && raw !== '' && raw != null) {
                if (isNaN(Number(raw)) || Number(raw) < 0) {
                    const el = fieldControl(form, f);
                    if (el) { setFieldError(el, 'Informe um número ≥ 0.'); el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    toast(`${f.label}: informe um número válido (≥ 0).`, 'aviso');
                    return false;
                }
            }
        }
        return true;
    }

    async function onSubmitForm(e) {
        e.preventDefault();
        const form = e.target;
        // Lê e já reseta os flags dos botões alternativos ("Salvar e novo" /
        // "Salvar e próximo") aqui em cima — assim, se a validação abaixo
        // falhar e o usuário salvar depois pelo botão padrão, não fica um
        // "novo"/"próximo" pendente de um clique anterior.
        const saveNew = state.saveAndNew, saveNext = state.saveAndNext;
        state.saveAndNew = false; state.saveAndNext = false;
        const categoryKey = $('#selCategoria').value;
        const typeKey = $('#selTipo').value;
        const naoLattes = LattesTypes.isNaoLattesCategory(categoryKey) || LattesTypes.isNaoLattesType(typeKey);
        const def = LattesTypes.get(typeKey);

        const fields = collectFields(form, def);
        const encResid = normalizeEncoding(fields); // compatibilidade ISO-8859-1
        if (!validateItemFields(def, fields, form)) return;

        let editing = state.editingId ? state.items.find(i => i.id === state.editingId) : null;
        // Tipo único (singleton): se já existir outro item desse tipo, atualiza-o
        // em vez de criar/duplicar.
        if (LattesTypes.isSingleton(typeKey)) {
            const ex = state.items.find(i => i.typeKey === typeKey && (!editing || i.id !== editing.id));
            if (ex) editing = ex;
        }
        // Detecção de duplicata (só ao criar item novo, não-singleton)
        if (!editing && !LattesTypes.isSingleton(typeKey)) {
            const key = dupKey(typeKey, fields);
            if (key) {
                const dup = state.items.find(i => i.typeKey === typeKey && dupKey(i.typeKey, i.fields) === key);
                if (dup && !confirm(`Já existe um item parecido:\n"${LattesTypes.itemTitle(dup)}".\n\nDeseja cadastrar mesmo assim?`)) return;
            }
        }
        const item = editing || {
            id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(),
            source: 'local', hasPdf: false, pdfName: null, lattesRef: null,
        };
        // Captura o "próximo" ANTES de mutar os campos deste item — assim, se
        // a edição fizer o item sair do filtro atual (o caso mais comum: você
        // acabou de corrigir o problema que motivou o filtro), ainda avança
        // pro item que era o seguinte na lista de antes, em vez de "perder a
        // posição" porque o item editado não bate mais no filtro.
        const proximoAlvo = (editing && saveNext) ? nextItemAfter(item.id, categoryKey) : null;
        const prevCat = item.categoryKey || null;              // categoria ANTES da edição
        const prevEvid = window.AppCore.evListFromItem(item); // estado anterior (p/ apagar removidas)
        item.lattesItem = !naoLattes;
        item.typeKey = typeKey;
        item.categoryKey = categoryKey;
        item.fields = fields;
        item.updatedAt = window.AppCore.nowISO();
        // Anotações gerais: campo livre, fora de `fields` — não entra na
        // exportação Lattes (XML) nem na página pública (Publicar na Web).
        item.notasGerais = (form.elements['notasGerais'] ? form.elements['notasGerais'].value.trim() : '');

        // Camada RSC (se habilitado e o item é elegível)
        if (state.rscEnabled) { const rscData = collectRsc(form); if (rscData) item.rsc = rscData; }
        // Camada de Visibilidade (Exportar Lattes / visibilidade no Lattes / Publicar na Web)
        const visibilidadeData = collectVisibilidade(form);
        if (visibilidadeData) item.visibilidade = visibilidadeData;

        // ---- Evidências: grava novas, remove excluídas, aplica ordem/pública ----
        const subdir = LattesTypes.categoryFolder(item.categoryKey);
        const semDir = !Storage.hasDirectory();
        // Se a CATEGORIA mudou, move os arquivos já gravados (json + anexos) da
        // pasta antiga para a nova — evita órfãos e evidências inacessíveis.
        if (!semDir && editing && prevCat && prevCat !== item.categoryKey) {
            try { await Storage.moveItemFiles(item.id, LattesTypes.categoryFolder(prevCat), subdir); } catch (_) {}
        }
        const usedBases = new Set(state.evEditing.filter(ev => ev.basename).map(ev => ev.basename));
        const newBase = () => { let b; do { b = `${item.id}-${window.AppCore.randCode(2)}`; } while (usedBases.has(b)); usedBases.add(b); return b; };
        let naoGravadas = 0;
        const evOut = [];
        const fromInbox = new Set();                 // originais da Inbox a mover p/ Processado
        for (const ev of state.evEditing) {
            if (ev.kind === 'link') {
                // Evidência por link: sem arquivo, guarda a URL direto no item.
                evOut.push({ kind: 'link', url: ev.url, ext: 'url', name: ev.name || ev.url, publica: !!ev.publica, tag: ev.tag || '' });
                continue;
            }
            if (ev.file) {
                // Sem diretório configurado NÃO registramos a evidência (o arquivo
                // não seria gravado — evita metadado apontando p/ arquivo inexistente).
                if (semDir) { naoGravadas++; continue; }
                const basename = ev.basename || newBase();
                try { await Storage.writeAttachment(basename, ev.file, subdir, ev.ext); }
                catch (e) { toast('Falha ao gravar evidência "' + ev.name + '": ' + e.message, 'aviso'); continue; }
                evOut.push({ basename, ext: ev.ext, name: ev.name, publica: !!ev.publica, tag: ev.tag || '' });
                if (ev.inboxName) fromInbox.add(ev.inboxName);   // veio da bandeja de entrada
            } else {
                evOut.push({ basename: ev.basename, ext: ev.ext, name: ev.name, publica: !!ev.publica, tag: ev.tag || '' });
            }
        }
        // apaga arquivos de evidências que foram removidas
        if (!semDir) {
            const keep = new Set(evOut.map(e => e.basename));
            for (const old of prevEvid) {
                if (old.basename && old.basename !== item.id && !keep.has(old.basename)) {
                    try { await Storage.deleteEntry(old.basename, subdir); } catch (_) {}
                }
            }
        }
        // Move para "Caixa de Entrada/00 Processado" os originais que vieram da bandeja
        let movidos = 0, falhasMove = 0;
        for (const nm of fromInbox) {
            try { await Storage.moveInboxToProcessed(nm); movidos++; }
            catch (_) { falhasMove++; }
        }
        if (movidos) toast(`${movidos} arquivo(s) da bandeja movido(s) para “00 Processado”.`, 'ok');
        if (falhasMove) toast(`${falhasMove} arquivo(s) da bandeja não puderam ser movidos.`, 'aviso');
        // "pública" é livre: 0..N evidências podem estar marcadas
        item.evidencias = evOut;
        item.hasPdf = evOut.length > 0;
        const pub = evOut.find(e => e.publica) || evOut[0] || null; // 1ª pública (ou 1ª) p/ preview/rótulo
        item.pdfName = pub ? pub.name : null;
        item.fileExt = pub ? pub.ext : null;
        if (naoGravadas) {
            toast(`${naoGravadas} evidência(s) não registrada(s): configure um diretório em Configurações e anexe novamente.`, 'aviso');
        }

        await window.AppCore.persistItem(item);
        // Feedback com o local de gravação (subpasta da categoria)
        const local = Storage.hasDirectory() ? ` em “${subdir}/”` : '';
        toast((editing ? 'Item atualizado' : 'Item adicionado') + local + '.', 'ok');
        if (encResid) toast(`Atenção: ${encResid} caractere(s) fora do ISO-8859-1 permanecem (ex.: emoji) — na exportação ao Lattes virarão entidades XML.`, 'aviso');

        // Lembra a última categoria/tipo (agiliza cadastro em série) e persiste
        state.lastCat = item.categoryKey; state.lastType = item.typeKey;
        const st = Storage.loadSettings(); st.lastCat = state.lastCat; st.lastType = state.lastType; Storage.saveSettings(st);

        window.AppCore.clearDraft(); // item salvo → descarta o rascunho automático
        state.editingId = null; state.evEditing = []; state.formDirty = false;
        // "Salvar" / "Salvar alterações": reabre o item recém-salvo (novo ou editado),
        // para revisar/anexar evidência. "Salvar e novo": abre um item em branco
        // (mesma cat/tipo). "Salvar e próximo": abre o item seguinte dentro da
        // MESMA CATEGORIA (ordem sequencial e circular — ver itemsDaCategoria).
        if (saveNext && !proximoAlvo) toast('Não há outro item nessa categoria para navegar.', 'info');
        if (proximoAlvo) buildForm(proximoAlvo, { focus: false });
        else if (!saveNew) buildForm(state.items.find(i => i.id === item.id), { focus: false });
        else buildForm(undefined, { focus: true, keepType: true });
        window.AppCore.renderItemList();
    }
    // Todos os itens de uma categoria (categoryKey), em ordem sequencial fixa
    // (mesma ordenação por ano da lista de Conformidade) — usada por "Salvar e
    // próximo" e pelos atalhos Alt+↓/Alt+↑ para percorrer a categoria inteira,
    // independente do filtro/busca/ordenação em uso na tela de Conformidade
    // naquele momento (evita "perder" itens que não batem no filtro atual).
    function itemsDaCategoria(categoryKey) {
        const asc = (state.sortOrder || 'desc') === 'asc';
        const items = state.items.filter(i => i.categoryKey === categoryKey && !LattesTypes.isPerfilType(i.typeKey));
        return sortByYear(items, asc);
    }
    // Próximo/anterior item dentro da MESMA categoria, de forma circular (do
    // último volta pro primeiro, e vice-versa) — null só se a categoria tiver
    // um único item (nada pra navegar) ou o item não estiver nela.
    function nextItemAfter(id, categoryKey) {
        const list = itemsDaCategoria(categoryKey);
        const idx = list.findIndex(i => i.id === id);
        if (idx === -1 || list.length < 2) return null;
        return list[(idx + 1) % list.length];
    }
    function prevItemBefore(id, categoryKey) {
        const list = itemsDaCategoria(categoryKey);
        const idx = list.findIndex(i => i.id === id);
        if (idx === -1 || list.length < 2) return null;
        return list[(idx - 1 + list.length) % list.length];
    }
    // Atalhos de teclado em Catalogar:
    //  - Ctrl/Cmd+S: salva o item em edição (mesmo efeito do botão "Salvar").
    //  - Ctrl/Cmd+Enter: "Salvar e próximo" (ou "Salvar e novo" se estiver
    //    criando um item novo — não há "próximo" nesse caso).
    //  - Alt+↓ / Alt+↑: enquanto edita um item existente, pula pro
    //    próximo/anterior item da MESMA CATEGORIA (ordem sequencial e
    //    circular — ver itemsDaCategoria) SEM salvar — útil pra revisar
    //    todos os itens de uma categoria em sequência antes de decidir o que
    //    corrigir em cada um.
    function wireKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (state.activeTab !== 'catalogar') return;
            const form = $('#itemForm');
            if (!form) return;
            const ctrlOrCmd = e.ctrlKey || e.metaKey;

            if (ctrlOrCmd && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                form.requestSubmit();
                return;
            }
            if (ctrlOrCmd && !e.shiftKey && e.key === 'Enter') {
                e.preventDefault();
                const btnProximo = $('#btnSalvarProximo');
                const btnNovo = $('#btnSalvarNovo');
                if (btnProximo) btnProximo.click();
                else if (btnNovo) btnNovo.click();
                else form.requestSubmit();
                return;
            }
            if (e.altKey && !ctrlOrCmd && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && state.editingId) {
                e.preventDefault();
                const editingItem = state.items.find(i => i.id === state.editingId);
                const catKey = editingItem ? editingItem.categoryKey : null;
                const alvo = e.key === 'ArrowDown' ? nextItemAfter(state.editingId, catKey) : prevItemBefore(state.editingId, catKey);
                if (!alvo) {
                    toast('Não há outro item nessa categoria para navegar.', 'info');
                    return;
                }
                if (state.formDirty && !confirm('Há alterações não salvas no formulário. Sair mesmo assim?')) return;
                buildForm(alvo, { focus: false });
            }
        });
    }

    // Publicado em AppCore: Configurações (ainda em app.js) reaproveita o
    // motor de campos/validação (fieldHtml, wireX, collectFields...) para
    // os formulários de perfil, e RENDERERS.catalogar (ver app.js) usa
    // TabCatalogar.render diretamente.
    window.AppCore.buildForm = buildForm;
    window.AppCore.fieldHtml = fieldHtml;
    window.AppCore.wireValidators = wireValidators;
    window.AppCore.wireCounters = wireCounters;
    window.AppCore.wireDateBr = wireDateBr;
    window.AppCore.wireConditional = wireConditional;
    window.AppCore.wireNA = wireNA;
    window.AppCore.wireAreaTree = wireAreaTree;
    window.AppCore.wireRepeater = wireRepeater;
    window.AppCore.collectFields = collectFields;
    window.AppCore.normalizeEncoding = normalizeEncoding;
    window.AppCore.validateItemFields = validateItemFields;
    window.AppCore.collectSuggestions = collectSuggestions;
    window.AppCore.renameFieldValue = renameFieldValue;
    window.AppCore.wireKeyboardShortcuts = wireKeyboardShortcuts;
    window.AppCore.AUTOCOMPLETE_KEYS = AUTOCOMPLETE_KEYS;
    window.AppCore.VOCAB_LABELS = VOCAB_LABELS;
    window.AppCore.DEFAULT_EVIDENCE_TAGS = DEFAULT_EVIDENCE_TAGS;

    return { render };
})();
