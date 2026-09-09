/* ==========================================================================
   lattesZen — Aba Conformidade (seções Conformidade/Pendências/RSC + lista de itens)
   --------------------------------------------------------------------------
   Quarta aba extraída de app.js (ver issue de refatoração), mesmo padrão das
   anteriores — lê estado/utilidades de window.AppCore. `switchTab`, `buildForm`,
   `uid`, `nowISO`, `persistItem` e `deleteItem` são definidos por app.js (que
   carrega DEPOIS deste módulo) — por isso são lidos via `window.AppCore.xxx`
   dentro dos corpos das funções (tempo de clique), nunca desestruturados no
   topo do arquivo.
   ========================================================================== */
window.TabConformidade = (function () {
    const {
        state, $, $$, esc, toast, anoDe, itemYear, sortByYear, publicarWebOk,
        elegivelAoLattes, normNome, isFieldDisabled, descState,
        isImageExt, isVideoExt, isArchiveExt, NA_VALUE,
    } = window.AppCore;

    /* =====================================================================
       ABA: CATÁLOGO (lista de itens)
       ===================================================================== */
    // Recortes da lista (cartões de conformidade + filtro da lista)
    const VIEW_META = {
        comprovados:  { cor: 'green', icone: 'fa-circle-check', titulo: 'Comprovados', desc: 'Com evidência anexada' },
        semPdf:       { cor: 'red',   icone: 'fa-file-circle-xmark', titulo: 'Sem evidência', desc: 'Falta anexar comprovação' },
        naoLattes:    { cor: 'purple', icone: 'fa-heart', titulo: 'Não-Lattes', desc: 'Itens pessoais' },
        descObrig:    { cor: 'red', icone: 'fa-align-left', titulo: 'Obrigatórios pendentes', desc: 'Falta campo obrigatório' },
        descOpcional: { cor: 'amber', icone: 'fa-align-left', titulo: 'Falta campo opcional', desc: 'Descrição incompleta (opcional)' },
        descCompleta: { cor: 'green', icone: 'fa-align-left', titulo: 'Descrição completa', desc: 'Todos os campos preenchidos' },
        rscUsavel:    { cor: 'amber', icone: 'fa-award', titulo: 'Usáveis para RSC', desc: 'Elegíveis dentro do período de uso' },
        rscMarcado:   { cor: 'green', icone: 'fa-award', titulo: 'Marcados para RSC', desc: 'Já contabilizados no RSC' },
        rscElegivel:  { cor: 'amber', icone: 'fa-award', titulo: 'Elegíveis para RSC', desc: 'Dentro do período, ainda não marcados' },
        rscForaPeriodo: { cor: 'gray', icone: 'fa-award', titulo: 'RSC fora do período', desc: 'Fora do período de uso do RSC' },
        chVerde:      { cor: 'green', icone: 'fa-clock', titulo: 'Com carga horária', desc: 'Carga horária preenchida' },
        chVermelho:   { cor: 'red', icone: 'fa-clock', titulo: 'Sem carga horária', desc: 'Falta preencher a carga horária' },
        chCinza:      { cor: 'gray', icone: 'fa-clock', titulo: 'Carga horária N/A', desc: 'Não se aplica' },
        lattesPendente:   { cor: 'red', icone: 'fa-graduation-cap', titulo: 'Ainda não no Lattes', desc: 'Não enviado à Plataforma Lattes' },
        lattesModificado: { cor: 'amber', icone: 'fa-graduation-cap', titulo: 'Modificado após o Lattes', desc: 'Editado localmente após ir ao Lattes' },
        lattesEnviado:    { cor: 'green', icone: 'fa-graduation-cap', titulo: 'Já no Lattes', desc: 'Sem edições desde o envio' },
        exportLattesSim:  { cor: 'green', icone: 'fa-file-export', titulo: 'Exportar p/ Lattes: sim', desc: 'Entra no XML gerado' },
        exportLattesNao:  { cor: 'gray', icone: 'fa-file-export', titulo: 'Exportar p/ Lattes: não', desc: 'Fora do XML gerado' },
        pubWebSim:        { cor: 'green', icone: 'fa-globe', titulo: 'Publicar na Web: sim', desc: 'Entra na página pública' },
        pubWebNao:        { cor: 'gray', icone: 'fa-globe', titulo: 'Publicar na Web: não', desc: 'Fora da página pública' },
        periodoInvalido:  { cor: 'red', icone: 'fa-calendar-xmark', titulo: 'Datas trocadas', desc: 'Fim antes do início' },
        anoImplausivel:   { cor: 'red', icone: 'fa-triangle-exclamation', titulo: 'Ano suspeito', desc: 'Fora do intervalo esperado' },
        semInstituicao:   { cor: 'red', icone: 'fa-building-circle-xmark', titulo: 'Sem instituição', desc: 'Falta informar a instituição' },
        semIdentificador: { cor: 'amber', icone: 'fa-barcode', titulo: 'Sem ISSN/ISBN', desc: 'Falta identificador bibliográfico' },
        possivelDuplicata: { cor: 'amber', icone: 'fa-copy', titulo: 'Possível duplicata', desc: 'Mesmo tipo, título e ano de outro item' },
        semAutores:        { cor: 'amber', icone: 'fa-user-slash', titulo: 'Sem autores', desc: 'Falta preencher os autores' },
    };
    // Tipos que exigem evidência (ex.: Identificação, Texto inicial, Outras
    // informações e Conexões não exigem) — usado nas métricas de conformidade.
    function needsEvidence(item) {
        const def = LattesTypes.get(item.typeKey);
        return !(def && def.noEvidence);
    }
    const VIEW_PREDICATE = {
        todos:          () => true,
        comprovados:    i => i.lattesItem && needsEvidence(i) && i.hasPdf,
        semPdf:         i => i.lattesItem && needsEvidence(i) && !i.hasPdf,
        naoLattes:      i => !i.lattesItem,
        descObrig:      i => descState(i) === 'red',
        descOpcional:   i => descState(i) === 'amber',
        descCompleta:   i => descState(i) === 'green',
        rscUsavel:      i => { const e = rscEstado(i); return e === 'green' || e === 'amber'; },
        rscMarcado:     i => rscEstado(i) === 'green',
        rscElegivel:    i => rscEstado(i) === 'amber',
        rscForaPeriodo: i => rscEstado(i) === 'gray',
        chVerde:        i => cargaHorariaEstado(i) === 'green',
        chVermelho:     i => cargaHorariaEstado(i) === 'red',
        chCinza:        i => cargaHorariaEstado(i) === 'gray',
        lattesPendente:   i => lattesEstado(i) === 'red',
        lattesModificado: i => lattesEstado(i) === 'amber',
        lattesEnviado:    i => lattesEstado(i) === 'green',
        exportLattesSim:  i => elegivelAoLattes(i.typeKey, i.categoryKey) && !(i.visibilidade && i.visibilidade.exportarLattes === false),
        exportLattesNao:  i => elegivelAoLattes(i.typeKey, i.categoryKey) && !!(i.visibilidade && i.visibilidade.exportarLattes === false),
        pubWebSim:        i => !LattesTypes.isPerfilType(i.typeKey) && publicarWebOk(i),
        pubWebNao:        i => !LattesTypes.isPerfilType(i.typeKey) && !publicarWebOk(i),
        periodoInvalido:  i => isPeriodoInvalido(i),
        anoImplausivel:   i => isAnoImplausivel(i),
        semInstituicao:   i => isSemInstituicao(i),
        semIdentificador: i => isSemIdentificador(i),
        possivelDuplicata: i => isPossivelDuplicata(i),
        semAutores:        i => isSemAutores(i),
    };

    // Caixa de totalização/filtragem dos itens usáveis no RSC-PCCTAE (só
    // aparece com o módulo habilitado). "Usáveis" = elegíveis e dentro do
    // período de uso (verde + âmbar de rscEstado — exclui os cinzas, fora
    // do período, e os tipos não elegíveis, ex. Identificação/Não-Lattes).
    function rscConformidadeBoxHtml() {
        const usaveis = state.items.filter(i => { const e = rscEstado(i); return e === 'green' || e === 'amber'; });
        const marcados = usaveis.filter(i => rscEstado(i) === 'green').length;
        const elegiveis = usaveis.length - marcados;
        const chip = (key, n) => {
            const m = VIEW_META[key];
            const active = state.viewFilter === key;
            return `<button type="button" data-view="${key}" title="Filtrar: ${m.titulo}"
                class="text-left bg-white dark:bg-gray-900 border rounded px-3 py-2 hover:shadow transition ${active ? `border-${m.cor}-500 ring-2 ring-${m.cor}-500/40` : 'border-gray-200 dark:border-gray-700'}">
                <span class="block text-xl font-bold text-${m.cor}-600 dark:text-${m.cor}-400">${n}</span>
                <span class="block text-xs text-gray-600 dark:text-gray-400">${m.titulo}</span>
            </button>`;
        };
        return `
            <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-5">
                <h3 class="font-bold text-sm flex items-center gap-2 mb-3"><i aria-hidden="true" class="fa-solid fa-award text-amber-600"></i> RSC-PCCTAE — itens usáveis</h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    ${chip('rscUsavel', usaveis.length)}
                    ${chip('rscMarcado', marcados)}
                    ${chip('rscElegivel', elegiveis)}
                    ${chip('rscForaPeriodo', state.items.filter(VIEW_PREDICATE.rscForaPeriodo).length)}
                </div>
            </div>`;
    }

    // Aba única (antigos "Catálogo" + "Relatório/Conformidade"): 4 seções —
    // Conformidade (barras), Pendências (chips), RSC (se habilitado) e Itens
    // (lista com filtro/ordenação, começa recolhida).
    function render() {
        const panel = $('#tab-conformidade');
        recalcularDuplicatas(); // os cartões/chips do topo usam count() logo abaixo — precisa estar pronto antes
        const count = k => state.items.filter(VIEW_PREDICATE[k]).length;
        const comprovados = count('comprovados');
        // Denominador da conformidade documental: só itens que EXIGEM evidência
        const total = state.items.filter(i => i.lattesItem && needsEvidence(i)).length;
        const pct = total ? Math.round(comprovados / total * 100) : 0;
        // Descrição: verde (completo) / amarelo (falta opcional) / vermelho (falta obrigatório)
        const totalDesc = state.items.length;
        const descG = state.items.filter(i => descState(i) === 'green').length;
        const descA = state.items.filter(i => descState(i) === 'amber').length;
        const descR = state.items.filter(i => descState(i) === 'red').length;
        const wDesc = n => totalDesc ? Math.round(n / totalDesc * 100) : 0;
        const pctDesc = wDesc(descG);

        // Chip compacto (mesmo padrão do quadro do RSC) — usado no resumo de
        // Pendências. "Comprovados", "Não-Lattes", "Exportar p/ Lattes: não" e
        // "Publicar na Web: não" não viram quadro/chip nenhum: são estados
        // deliberados do usuário, não pendências de dado — cada um continua
        // com seu ícone por item (ver itemCardHtml), só sumiram do resumo.
        const chip = (key) => {
            const m = VIEW_META[key];
            const active = state.viewFilter === key;
            return `<button type="button" data-view="${key}" title="Filtrar: ${m.titulo}"
                class="text-left bg-white dark:bg-gray-900 border rounded px-3 py-2 hover:shadow transition ${active ? `border-${m.cor}-500 ring-2 ring-${m.cor}-500/40` : 'border-gray-200 dark:border-gray-700'}">
                <span class="block text-xl font-bold text-${m.cor}-600 dark:text-${m.cor}-400">${count(key)}</span>
                <span class="block text-xs text-gray-600 dark:text-gray-400">${m.titulo}</span>
            </button>`;
        };

        panel.innerHTML = `
            <div class="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-5">
                <h3 class="font-bold text-sm flex items-center gap-2 mb-3"><i aria-hidden="true" class="fa-solid fa-chart-simple text-gray-500"></i> Conformidade</h3>
                <div class="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                        <div class="flex justify-between text-sm mb-1"><span class="font-semibold"><i class="fa-solid fa-file-pdf text-gray-400 mr-1"></i>Conformidade documental (evidência)</span><span>${pct}% (${comprovados}/${total})</span></div>
                        <div class="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full ${pct === 100 ? 'bg-green-500' : 'bg-red-500'}" style="width:${pct}%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-sm mb-1"><span class="font-semibold"><i class="fa-solid fa-align-left text-gray-400 mr-1"></i>Descrição completa (campos)</span><span>${pctDesc}% (${descG}/${totalDesc})</span></div>
                        <div class="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex" title="Verde: completo · Amarelo: falta opcional · Vermelho: falta obrigatório">
                            <div class="h-full bg-green-500" style="width:${wDesc(descG)}%"></div>
                            <div class="h-full bg-amber-500" style="width:${wDesc(descA)}%"></div>
                            <div class="h-full bg-red-500" style="width:${wDesc(descR)}%"></div>
                        </div>
                        <p class="text-xs text-gray-500 mt-0.5">${descG} completos · ${descA} falta opcional · ${descR} falta obrigatório</p>
                    </div>
                </div>
            </div>

            <div id="outrasPendenciasBox" class="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-5">
                <h3 class="font-bold text-sm flex items-center gap-2 mb-3"><i aria-hidden="true" class="fa-solid fa-list-check text-gray-500"></i> Pendências</h3>
                <div class="flex flex-wrap gap-2">
                    ${chip('semPdf')}${chip('descObrig')}${chip('chVermelho')}${chip('periodoInvalido')}${chip('anoImplausivel')}
                    ${chip('semInstituicao')}${chip('semIdentificador')}${chip('semAutores')}${chip('possivelDuplicata')}
                </div>
            </div>

            ${state.rscEnabled ? rscConformidadeBoxHtml() : ''}

            <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-5">
                <div class="px-4 py-3 bg-gray-100 dark:bg-gray-800 flex items-center justify-between gap-2 flex-wrap">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-list text-govbr-600 dark:text-unifesp-400"></i>
                        Itens <span id="itemCount" class="text-sm font-normal text-gray-500"></span>
                        <span id="viewChip" class="hidden text-xs font-normal"></span>
                    </h2>
                    <div class="print:hidden flex items-center gap-2 flex-wrap">
                        <label class="text-xs text-gray-500 flex items-center gap-1">
                            <i aria-hidden="true" class="fa-solid fa-arrow-down-wide-short"></i> Ordenar por ano
                            <select id="sortOrder" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                                <option value="desc">Decrescente (recente → antigo)</option>
                                <option value="asc">Crescente (antigo → recente)</option>
                            </select>
                        </label>
                        <input id="filterBox" type="search" placeholder="Filtrar..."
                               class="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 w-full sm:w-56">
                    </div>
                </div>
                <div class="print:hidden flex gap-2 px-3 pt-3 flex-wrap">
                    <button id="btnExpandAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Expandir todas</button>
                    <button id="btnCollapseAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Recolher todas</button>
                    <button id="btnImprimir" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ml-auto"><i class="fa-solid fa-print mr-1"></i> Imprimir / PDF</button>
                </div>
                <details id="itensSection" ${state.itensAberto ? 'open' : ''}>
                    <summary class="cursor-pointer select-none px-3 py-2 mt-1 text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i> Ver itens
                    </summary>
                    <div id="itemList" class="p-3 space-y-3"></div>
                </details>
            </div>`;

        $('#sortOrder').value = state.sortOrder || 'desc';
        renderItemList();
        const itensSection = $('#itensSection');
        if (itensSection) itensSection.addEventListener('toggle', () => { state.itensAberto = itensSection.open; });
        // Busca com debounce: currículos com centenas de itens reconstroem uma
        // árvore grande (categoria › tipo/instituição › itens) a cada chamada
        // — sem isso, cada tecla digitada refaz tudo na hora, o que fica
        // perceptível. Só a lista é adiada; os demais controles seguem
        // instantâneos (não dependem de digitação caractere a caractere).
        let filterTimer = null;
        $('#filterBox').addEventListener('input', () => {
            clearTimeout(filterTimer);
            filterTimer = setTimeout(renderItemList, 200);
        });
        $('#sortOrder').addEventListener('change', (e) => { state.sortOrder = e.target.value; renderItemList(); });
        $('#btnExpandAll').addEventListener('click', () => $$('#itemList details').forEach(d => d.open = true));
        $('#btnCollapseAll').addEventListener('click', () => $$('#itemList details').forEach(d => d.open = false));
        $('#btnImprimir').addEventListener('click', () => {
            // Itens começa recolhido — impressão sem isto perderia a lista
            // inteira (conteúdo de <details> fechado não imprime).
            if (itensSection) { itensSection.open = true; state.itensAberto = true; }
            window.print();
        });
        // Delegação (em vez de ligar em cada botão individualmente): os itens
        // (ícones de status [data-view] e ações [data-act]: editar/duplicar/
        // excluir) ficam dentro de #itemList, que é reconstruído sozinho
        // (busca/ordenar) sem passar de novo por aqui — listeners diretos nos
        // botões se perderiam nesse caso, e recriá-los a cada render custaria
        // caro em listas grandes. Ligado uma única vez em #tab-conformidade
        // (nó estável, nunca recriado).
        if (!panel.dataset.itemDelegado) {
            panel.dataset.itemDelegado = '1';
            panel.addEventListener('click', (e) => {
                const viewBtn = e.target.closest('[data-view]');
                if (viewBtn) {
                    const k = viewBtn.dataset.view;
                    state.viewFilter = (state.viewFilter === k) ? 'todos' : k; // clicar de novo limpa
                    state.itensAberto = true; // filtrar só faz sentido vendo o resultado — abre Itens
                    render();
                    return;
                }
                const actBtn = e.target.closest('[data-act]');
                if (actBtn) onItemAction(actBtn);
            });
        }
    }

    // Ícone de arquivo conforme o tipo de evidência (pdf/imagem/vídeo/zip-tar.gz/link)
    function evidenceExtIcon(ext) {
        if (ext === 'url') return 'fa-link';
        if (isImageExt(ext)) return 'fa-image';
        if (isVideoExt(ext)) return 'fa-file-video';
        if (isArchiveExt(ext)) return 'fa-file-zipper';
        return 'fa-file-pdf';
    }
    // Ícones de evidência do cartão: um por evidência anexada (cor única no
    // conjunto — verde se há alguma pública, âmbar se há evidência mas nenhuma
    // pública); sem evidência, mostra um único indicador vermelho.
    function evidenceIconsHtml(item) {
        const def = LattesTypes.get(item.typeKey);
        if (def && def.noEvidence) return '';
        const evid = Array.isArray(item.evidencias) ? item.evidencias : [];
        if (!evid.length) {
            return `<span title="Sem evidência anexada" class="inline-flex items-center justify-center w-6 h-6 text-red-600 dark:text-red-500"><i class="fa-solid fa-file-circle-xmark"></i></span>`;
        }
        const cor = evid.some(e => e.publica) ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500';
        // Agrupa por tipo de ícone (pdf/imagem/vídeo/zip-tar.gz/link): mesmo
        // tipo não repete o ícone, só soma no badge de contagem.
        const groups = new Map();
        evid.forEach(e => {
            const icon = evidenceExtIcon(e.ext);
            if (!groups.has(icon)) groups.set(icon, { count: 0, names: [], publica: false });
            const g = groups.get(icon);
            g.count++; g.names.push(e.name || ''); if (e.publica) g.publica = true;
        });
        return Array.from(groups.entries()).map(([icon, g]) => {
            const title = g.names.join(', ') + (g.publica ? ' (pública)' : '');
            const badge = g.count > 1 ? `<span class="absolute -bottom-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900 text-[9px] leading-[14px] rounded-full text-center">${g.count}</span>` : '';
            return `<button type="button" data-act="pdf" data-id="${item.id}" title="${esc(title)}" class="relative inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${cor}"><i class="fa-solid ${icon}"></i>${badge}</button>`;
        }).join('');
    }
    // Estado do item em relação ao RSC: 'green' (marcado/em uso), 'amber'
    // (elegível, dentro do período de uso, ainda não marcado), 'gray' (fora
    // do período de uso) ou null (módulo desligado ou tipo não elegível).
    // Alguns tipos só contam no RSC com carga horária ≥10h (Anexo II,
    // critérios 2.9 — formação continuada — e 2.11 — capacitação/evento):
    // Participação em eventos como "Ouvinte" (só assistiu, não gera produção
    // própria) e Formação complementar. Descarta (além da checagem de data,
    // que roda em seguida) quando a carga horária é conhecida e menor que
    // 10h, ou marcada N/A; mantém quando está em branco (não dá pra afirmar
    // que é < 10h).
    function cargaHorariaAbaixoDoMinimoRSC(item) {
        const f = item.fields || {};
        let ch;
        if (item.typeKey === 'PARTICIPACAO_EVENTO' && f.formaParticipacao === 'Ouvinte') ch = f.cargaHoraria;
        else if (item.typeKey === 'FORMACAO_COMPLEMENTAR') ch = f.cargaHoraria;
        else return false;
        const s = String(ch || '').trim();
        if (!s) return false;
        if (s === NA_VALUE) return true;
        const m = s.match(/\d+(?:[.,]\d+)?/);
        if (!m) return false;
        return parseFloat(m[0].replace(',', '.')) < 10;
    }
    function rscEstado(item) {
        if (!state.rscEnabled) return null;
        const eligivel = item.typeKey && !LattesTypes.isPerfilType(item.typeKey) && !LattesTypes.isNaoLattesType(item.typeKey);
        if (!eligivel) return null;
        if (cargaHorariaAbaixoDoMinimoRSC(item)) return null;
        if (item.rsc && item.rsc.conta) return 'green';
        const inicioAno = parseInt(anoDe((state.rscCfg && state.rscCfg.dataInicioContagem) || ''), 10);
        const itemAno = itemYear(item);
        const foraDoPeriodo = !isNaN(inicioAno) && itemAno != null && itemAno < inicioAno;
        return foraDoPeriodo ? 'gray' : 'amber';
    }
    // Cores compartilhadas pelos ícones de status do card do item.
    const ICON_COLOR_CLASS = {
        green: 'text-green-600 dark:text-green-500', amber: 'text-amber-600 dark:text-amber-500',
        red: 'text-red-600 dark:text-red-500', gray: 'text-gray-400 dark:text-gray-500',
    };
    // Ícone de status clicável: mesma aparência de sempre, mas agora é um
    // botão com data-view — clicar filtra a lista para só os itens com esse
    // mesmo estado (reaproveita o mecanismo dos cartões de filtro do topo:
    // VIEW_PREDICATE/VIEW_META + a delegação de clique em #tab-conformidade).
    function iconBtnHtml(viewKey, estado, title, iconClass) {
        const active = state.viewFilter === viewKey;
        return `<button type="button" data-view="${viewKey}" title="${esc(title)}"
            class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${ICON_COLOR_CLASS[estado]} ${active ? 'ring-2 ring-current' : ''}"><i class="fa-solid ${iconClass}"></i></button>`;
    }
    // Ícone do RSC: verde (marcado), âmbar (elegível, dentro do período de uso,
    // ainda não marcado) ou cinza (fora do período de uso). Some quando o
    // módulo está desligado ou o tipo não é elegível ao RSC.
    function rscIconHtml(item) {
        const estado = rscEstado(item);
        if (!estado) return '';
        const title = estado === 'green' ? 'Marcado para uso no RSC'
            : estado === 'amber' ? 'Dentro do período de uso do RSC — ainda não marcado'
            : 'Fora do período de uso do RSC';
        const key = estado === 'green' ? 'rscMarcado' : estado === 'amber' ? 'rscElegivel' : 'rscForaPeriodo';
        return iconBtnHtml(key, estado, title, 'fa-award');
    }
    // Estado do item em relação ao Lattes: 'red' (ainda não enviado), 'amber'
    // (enviado, mas modificado localmente depois), 'green' (enviado, sem
    // edições) ou null (item Não-Lattes — nunca vai pro XML).
    function lattesEstado(item) {
        if (!item.lattesItem) return null;
        if (!item.lattesRef) return 'red';
        if (item.updatedAt && item.createdAt && item.updatedAt !== item.createdAt) return 'amber';
        return 'green';
    }
    // Ícone Lattes: vermelho (ainda não está no Lattes), âmbar (está no Lattes
    // mas foi modificado localmente) ou verde (já está no Lattes, sem edições
    // desde a importação/adoção). Some para itens Não-Lattes (nunca exportados).
    function lattesIconHtml(item) {
        const estado = lattesEstado(item);
        if (!estado) return '';
        const title = estado === 'red' ? 'Ainda não está no Lattes'
            : estado === 'amber' ? 'Está no Lattes, mas sofreu modificação local'
            : 'Já está no Lattes';
        const key = estado === 'red' ? 'lattesPendente' : estado === 'amber' ? 'lattesModificado' : 'lattesEnviado';
        return iconBtnHtml(key, estado, title, 'fa-graduation-cap');
    }
    // Estado da carga horária do item: 'green' (tem), 'red' (falta), 'gray'
    // (não se aplica — campo desabilitado por outra condição do próprio
    // tipo, ex. Formação Acadêmica fora de Aperfeiçoamento/Especialização,
    // ou marcado "N/A") ou null (tipo sem campo "cargaHoraria").
    function cargaHorariaEstado(item) {
        const def = LattesTypes.getType(item.typeKey);
        const f = def && def.fields && def.fields.find(fld => fld.key === 'cargaHoraria');
        if (!f) return null;
        const vals = item.fields || {};
        const v = String(vals.cargaHoraria || '').trim();
        if (isFieldDisabled(f, vals) || v === NA_VALUE) return 'gray';
        return v ? 'green' : 'red';
    }
    // Ícone de carga horária: verde (tem carga horária), vermelho (não tem)
    // ou cinza (não se aplica). Some para tipos sem campo "cargaHoraria".
    function cargaHorariaIconHtml(item) {
        const estado = cargaHorariaEstado(item);
        if (!estado) return '';
        const v = String((item.fields || {}).cargaHoraria || '').trim();
        const title = estado === 'gray' ? 'Carga horária: não se aplica' : estado === 'green' ? 'Tem carga horária: ' + v : 'Sem carga horária';
        const key = estado === 'green' ? 'chVerde' : estado === 'red' ? 'chVermelho' : 'chCinza';
        return iconBtnHtml(key, estado, title, 'fa-clock');
    }
    // Período com datas trocadas: o tipo tem campo "anoFim" (fim de um
    // intervalo início/fim), ambos preenchidos, e fim < início — um erro de
    // digitação/lógica, diferente de "campo em branco" (que descState() já
    // cobre). Ignora quando "anoFim" está desabilitado pela própria condição
    // do tipo (ex.: situação "Atual (não finalizado)" — o campo nem deveria
    // valer nesse caso, mesmo que guarde um valor antigo de antes da troca).
    function isPeriodoInvalido(item) {
        const def = LattesTypes.getType(item.typeKey);
        const fFim = def && def.fields && def.fields.find(fld => fld.key === 'anoFim');
        if (!fFim) return false;
        const vals = item.fields || {};
        if (isFieldDisabled(fFim, vals)) return false;
        const ini = anoDe(vals.anoInicio || ''), fim = anoDe(vals.anoFim || '');
        if (!ini || !fim) return false;
        return parseInt(fim, 10) < parseInt(ini, 10);
    }
    function periodoInvalidoIconHtml(item) {
        if (!isPeriodoInvalido(item)) return '';
        return iconBtnHtml('periodoInvalido', 'red', 'Data de fim antes da data de início', 'fa-calendar-xmark');
    }
    // Ano fora de um intervalo plausível (1950 até o ano que vem) — protege
    // contra erro de digitação (ex.: "2924" em vez de "2024") que hoje passa
    // batido e bagunça silenciosamente a ordenação por ano, a Linha do tempo
    // e a nuvem de palavras. Olha os 3 campos de ano possíveis (um tipo tem
    // no máximo um deles), não só o "ano representativo" de itemYear().
    const ANO_MIN_PLAUSIVEL = 1950;
    function isAnoImplausivel(item) {
        const vals = item.fields || {};
        const anoMax = new Date().getFullYear() + 1;
        return ['ano', 'anoInicio', 'anoFim'].some((k) => {
            const v = anoDe(vals[k] || '');
            if (!v) return false;
            const n = parseInt(v, 10);
            return n < ANO_MIN_PLAUSIVEL || n > anoMax;
        });
    }
    function anoImplausivelIconHtml(item) {
        if (!isAnoImplausivel(item)) return '';
        return iconBtnHtml('anoImplausivel', 'red', 'Ano fora do intervalo esperado (possível erro de digitação)', 'fa-triangle-exclamation');
    }
    // Sem instituição informada: o tipo tem campo "instituicao" (Atuação,
    // Formação, Projetos, Bancas...), mas está em branco. A própria lista de
    // Conformidade já agrupa Atuação sem instituição num bloco à parte — este
    // filtro só dá um atalho direto pra achar esses itens em qualquer categoria.
    function isSemInstituicao(item) {
        const def = LattesTypes.getType(item.typeKey);
        const fInst = def && def.fields && def.fields.find(fld => fld.key === 'instituicao');
        if (!fInst) return false;
        const vals = item.fields || {};
        if (isFieldDisabled(fInst, vals)) return false;
        return !String(vals.instituicao || '').trim();
    }
    function semInstituicaoIconHtml(item) {
        if (!isSemInstituicao(item)) return '';
        return iconBtnHtml('semInstituicao', 'red', 'Instituição não informada', 'fa-building-circle-xmark');
    }
    // Sem ISSN/ISBN: o tipo tem campo "issn" ou "isbn" (produção
    // bibliográfica), mas está em branco — identificador cada vez mais
    // cobrado em avaliação (CAPES/Qualis). Menos crítico que data errada ou
    // instituição ausente (é metadado bibliográfico, não um erro de fato),
    // por isso fica em âmbar, não vermelho.
    function isSemIdentificador(item) {
        const def = LattesTypes.getType(item.typeKey);
        const fIds = (def && def.fields || []).filter(fld => fld.key === 'issn' || fld.key === 'isbn');
        if (!fIds.length) return false;
        const vals = item.fields || {};
        return fIds.every((fld) => !String(vals[fld.key] || '').trim());
    }
    function semIdentificadorIconHtml(item) {
        if (!isSemIdentificador(item)) return '';
        return iconBtnHtml('semIdentificador', 'amber', 'Sem ISSN/ISBN', 'fa-barcode');
    }
    // Sem autores: o tipo tem campo "autores" (textarea) ou "autoresLista"
    // (repeater), mas está em branco/sem nenhuma linha. Campo não obrigatório,
    // mas cada vez mais cobrado em prestação de contas (CAPES/Sucupira) — por
    // isso vale um filtro dedicado, mesmo sem ser um erro em si (âmbar).
    // "orientando" (Orientações) fica de fora de propósito: já é campo
    // obrigatório do tipo, então "em branco" já cai em descObrig — um filtro
    // aqui só duplicaria o que a Descrição obrigatória já cobre.
    function isSemAutores(item) {
        const def = LattesTypes.getType(item.typeKey);
        const fAut = (def && def.fields || []).find(fld => fld.key === 'autores' || fld.key === 'autoresLista');
        if (!fAut) return false;
        const vals = item.fields || {};
        if (isFieldDisabled(fAut, vals)) return false;
        const v = vals[fAut.key];
        return Array.isArray(v) ? v.length === 0 : !String(v || '').trim();
    }
    function semAutoresIconHtml(item) {
        if (!isSemAutores(item)) return '';
        return iconBtnHtml('semAutores', 'amber', 'Sem autores preenchidos', 'fa-user-slash');
    }
    // Possível duplicata: mesmo tipo + título (normalizado, ignora acento/
    // caixa) + ano aparecendo em mais de um item — pode vir de reimportação
    // do XML ou de "Duplicar" sem editar depois. Diferente dos demais
    // detectores acima (todos puros por item), este depende dos OUTROS itens
    // do catálogo — por isso é recalculado uma vez por renderItemList()
    // (recalcularDuplicatas()), não item a item.
    let duplicataIds = new Set();
    function recalcularDuplicatas() {
        const grupos = new Map();
        state.items.forEach((i) => {
            const titulo = normNome(LattesTypes.itemTitle(i) || '');
            if (!titulo) return;
            const chave = `${i.typeKey}|${itemYear(i)}|${titulo}`;
            if (!grupos.has(chave)) grupos.set(chave, []);
            grupos.get(chave).push(i.id);
        });
        duplicataIds = new Set();
        for (const ids of grupos.values()) { if (ids.length > 1) ids.forEach((id) => duplicataIds.add(id)); }
    }
    function isPossivelDuplicata(item) { return duplicataIds.has(item.id); }
    function duplicataIconHtml(item) {
        if (!isPossivelDuplicata(item)) return '';
        return iconBtnHtml('possivelDuplicata', 'amber', 'Possível duplicata (mesmo tipo, título e ano de outro item)', 'fa-copy');
    }
    // Ícone "Exportar para Lattes": verde (entra no XML), cinza (desmarcado
    // no item — fica de fora mesmo sendo de tipo/categoria exportável). Some
    // para tipos/categorias que não vão pro Lattes de jeito nenhum (categorias
    // 12+/"Além do Lattes", tipos marcados naoLattes) — nada a mostrar ali.
    function exportarLattesIconHtml(item) {
        if (!elegivelAoLattes(item.typeKey, item.categoryKey)) return '';
        const on = !(item.visibilidade && item.visibilidade.exportarLattes === false);
        const title = on ? 'Exportado para o Lattes (XML)' : 'Fora da exportação para o Lattes (XML)';
        return iconBtnHtml(on ? 'exportLattesSim' : 'exportLattesNao', on ? 'green' : 'gray', title, 'fa-file-export');
    }
    // Ícone "Publicar na Web": verde (entra na página HTML própria), cinza
    // (desmarcado no item). Some para tipos de perfil (não são itens da
    // página pública). Independente do Lattes — não usa elegivelAoLattes.
    function publicarWebIconHtml(item) {
        if (LattesTypes.isPerfilType(item.typeKey)) return '';
        const on = publicarWebOk(item);
        const title = on ? 'Publicado na página Web' : 'Fora da página Web (Publicar na Web)';
        return iconBtnHtml(on ? 'pubWebSim' : 'pubWebNao', on ? 'green' : 'gray', title, 'fa-globe');
    }
    // Ícone de descrição: reaproveita o estado de completude (descState).
    function descIconHtml(item) {
        const estado = descState(item);
        const title = estado === 'green' ? 'Descrição completa' : estado === 'amber' ? 'Descrição incompleta (falta campo opcional)' : 'Sem descrição (falta campo obrigatório)';
        const key = estado === 'green' ? 'descCompleta' : estado === 'amber' ? 'descOpcional' : 'descObrig';
        return iconBtnHtml(key, estado, title, 'fa-align-left');
    }

    function itemCardHtml(i) {
        const anoNum = itemYear(i);
        const ano = anoNum != null ? String(anoNum) : '—';
        const titulo = esc(LattesTypes.itemTitle(i));
        const tipo = esc(LattesTypes.label(i.typeKey));
        const sep = `<span class="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0 mx-0.5"></span>`;
        return `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5">
                <div class="flex items-center gap-x-2 gap-y-1 flex-wrap">
                    <span class="text-xs font-mono text-gray-500 shrink-0 w-9 text-right tabular-nums">${ano}</span>
                    <span class="text-sm font-medium truncate flex-1 min-w-[8rem]" title="${tipo} · ${titulo}">${titulo}</span>
                    <div class="flex items-center gap-0.5 shrink-0 ml-auto">
                        ${evidenceIconsHtml(i)}
                        ${sep}
                        ${cargaHorariaIconHtml(i)}${periodoInvalidoIconHtml(i)}${anoImplausivelIconHtml(i)}${semInstituicaoIconHtml(i)}${semIdentificadorIconHtml(i)}${semAutoresIconHtml(i)}${duplicataIconHtml(i)}${rscIconHtml(i)}${lattesIconHtml(i)}${exportarLattesIconHtml(i)}${publicarWebIconHtml(i)}${descIconHtml(i)}
                        <span class="print:hidden contents">
                            ${sep}
                            <button data-act="edit" data-id="${i.id}" title="Abrir / Editar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                            ${LattesTypes.isSingleton(i.typeKey) ? '' : `<button data-act="dup" data-id="${i.id}" title="Duplicar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"><i class="fa-solid fa-clone"></i></button>`}
                            <button data-act="del" data-id="${i.id}" title="Excluir" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
                        </span>
                    </div>
                </div>
            </div>`;
    }

    // Monta o HTML segmentado em 2 níveis: categoria (01..11, 99) → tipo de item.
    // Só categorias/tipos com itens são exibidos. Reutilizado em Catálogo e Relatório.
    function buildGroupedHtml(items) {
        const order = LattesTypes.categories.map(c => c.key).concat('NAO_LATTES');
        const groups = {};
        items.forEach(i => { (groups[i.categoryKey] = groups[i.categoryKey] || []).push(i); });
        const typeOrderOf = (catKey) => {
            const c = LattesTypes.categoryByKey(catKey);
            if (!c) return [];
            return c.groups ? c.groups.flatMap(g => g.types) : (c.types || []);
        };
        // Monta as subdivisões por tipo de item (nível interno reutilizável)
        const typesHtmlFor = (arr, catKey) => {
            const byType = {};
            arr.forEach(i => { (byType[i.typeKey] = byType[i.typeKey] || []).push(i); });
            const seq = typeOrderOf(catKey);
            const typeKeys = Object.keys(byType).sort((a, b) => {
                const ia = seq.indexOf(a), ib = seq.indexOf(b);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });
            return typeKeys.map(tk => `
                <details open class="border border-gray-100 dark:border-gray-700/60 rounded">
                    <summary class="cursor-pointer select-none px-2 py-1.5 bg-gray-50 dark:bg-gray-800/60 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                        ${esc(LattesTypes.label(tk))}
                        <span class="text-xs font-normal text-gray-500">(${byType[tk].length})</span>
                    </summary>
                    <div class="p-1.5 space-y-1">${byType[tk].map(itemCardHtml).join('')}</div>
                </details>`).join('');
        };

        // Em "03 Atuação", agrupa por Instituição e, dentro dela, mantém as
        // subdivisões por tipo de item (Atuação profissional, atividades, etc.).
        const SEM_INST = ' ';
        const instHtmlFor = (arr, catKey) => {
            const byInst = {};
            const labelOf = {};
            arr.forEach(i => {
                const raw = ((i.fields && i.fields.instituicao) || '').trim();
                const ik = raw ? normNome(raw) : SEM_INST;
                if (!byInst[ik]) { byInst[ik] = []; labelOf[ik] = raw; }
                byInst[ik].push(i);
            });
            const instKeys = Object.keys(byInst).sort((a, b) => {
                if (a === SEM_INST) return 1;
                if (b === SEM_INST) return -1;
                return labelOf[a].localeCompare(labelOf[b], 'pt-BR', { sensitivity: 'base' });
            });
            return instKeys.map(ik => `
                <details open class="border border-gray-200 dark:border-gray-700/70 rounded-md">
                    <summary class="cursor-pointer select-none px-2.5 py-1.5 bg-gray-100/70 dark:bg-gray-800/80 text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-building text-govbr-600 dark:text-unifesp-400 text-xs"></i>
                        ${esc(ik === SEM_INST ? '(Sem instituição informada)' : labelOf[ik])}
                        <span class="text-xs font-normal text-gray-500">(${byInst[ik].length})</span>
                    </summary>
                    <div class="p-1.5 space-y-1.5">${typesHtmlFor(byInst[ik], catKey)}</div>
                </details>`).join('');
        };

        return order.filter(k => groups[k] && groups[k].length).map(k => {
            const g = groups[k];
            const bodyHtml = (k === 'ATUACAO') ? instHtmlFor(g, k) : typesHtmlFor(g, k);
            return `
            <details open class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <summary class="cursor-pointer select-none px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-sm flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid ${esc((LattesTypes.categoryByKey(k) || {}).icon || 'fa-folder')} text-govbr-600 dark:text-unifesp-400"></i>
                    ${esc(LattesTypes.categoryNumLabel(k))}
                    <span class="text-xs font-normal text-gray-500">(${g.length})</span>
                </summary>
                <div class="p-2 space-y-2">${bodyHtml}</div>
            </details>`;
        }).join('');
    }
    function renderItemList() {
        const list = $('#itemList');
        if (!list) return; // aba Conformidade não está montada
        recalcularDuplicatas();
        const q = ($('#filterBox') && $('#filterBox').value || '').toLowerCase();
        const asc = (state.sortOrder || 'desc') === 'asc';
        const view = state.viewFilter && VIEW_PREDICATE[state.viewFilter] ? state.viewFilter : 'todos';

        // Recorte (cartão) atualmente selecionado
        const chip = $('#viewChip');
        if (chip) {
            if (view === 'todos') { chip.classList.add('hidden'); chip.textContent = ''; }
            else {
                const m = VIEW_META[view];
                chip.className = `text-xs font-normal badge bg-${m.cor}-100 text-${m.cor}-800 dark:bg-${m.cor}-900/40 dark:text-${m.cor}-300`;
                chip.innerHTML = `<i class="fa-solid ${m.icone}"></i> ${m.titulo} · <button type="button" id="viewClear" class="underline">ver todos</button>`;
                const clr = $('#viewClear'); if (clr) clr.addEventListener('click', () => { state.viewFilter = 'todos'; render(); });
            }
        }

        // Tipos de perfil (Identificação, Foto, Endereço, Texto inicial,
        // Outras informações, Áreas de atuação, Documentos pessoais) são
        // editados em Configurações e não aparecem na lista de Conformidade.
        let items = state.items.filter(VIEW_PREDICATE[view])
            .filter(i => !LattesTypes.isPerfilType(i.typeKey));
        if (q) items = items.filter(i => (LattesTypes.itemTitle(i) + ' ' + LattesTypes.label(i.typeKey) + ' ' + LattesTypes.categoryLabel(i.categoryKey)).toLowerCase().includes(q));

        const cnt = $('#itemCount');
        if (cnt) cnt.textContent = (view === 'todos' && !q) ? `(${state.items.length})` : `(${items.length} de ${state.items.length})`;

        if (!items.length) {
            const vazio = !state.items.length
                ? 'Nenhum item ainda. Adicione pelo formulário ou importe o XML do Lattes.'
                : (view === 'todos' ? 'Nenhum item corresponde ao filtro.' : 'Nenhum item neste recorte.');
            list.innerHTML = `<p class="text-sm text-gray-500 italic py-6 text-center">${vazio}</p>`;
            return;
        }
        list.innerHTML = buildGroupedHtml(sortByYear(items, asc));
    }
    // Publicado em AppCore: Configurações (ainda em app.js) chama isso depois
    // de operações que alteram a lista (importar XML/ORCID/BibTeX, backup,
    // etc.) para atualizar a lista de itens sem recarregar a aba inteira.
    window.AppCore.renderItemList = renderItemList;

    // Chamada pela delegação de clique em #tab-conformidade (ver render acima)
    // — recebe o próprio botão [data-act], não o evento, já que não há mais
    // um listener direto por botão.
    async function onItemAction(btn) {
        const id = btn.dataset.id;
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        if (btn.dataset.act === 'edit' || btn.dataset.act === 'pdf') {
            // Itens de perfil (Identificação, Foto, Endereço, etc.) são editados em Configurações
            if (LattesTypes.isPerfilType(item.typeKey)) {
                window.AppCore.switchTab('config');
                const sec = $('#perfilSection');
                if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            // Abre o item na aba Catalogar
            window.AppCore.switchTab('catalogar');
            window.AppCore.buildForm(item);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (btn.dataset.act === 'dup') {
            await duplicateItem(id);
        } else if (btn.dataset.act === 'del') {
            if (!confirm(`Mover "${LattesTypes.itemTitle(item)}" para a lixeira? Pode ser restaurado depois em Configurações › Lixeira.`)) return;
            await window.AppCore.deleteItem(id);
            toast('Item movido para a lixeira.', 'ok');
            renderItemList();
        }
    }

    // Duplica um item: mesma categoria/tipo/campos, mas sem evidências (cada
    // uma comprova um documento real específico, não faz sentido copiá-las)
    // e sem lattesRef (evita colidir com a deduplicação de reimportação do
    // XML). O campo-título do tipo ganha o sufixo " (cópia)".
    async function duplicateItem(id) {
        const orig = state.items.find(i => i.id === id);
        if (!orig || LattesTypes.isSingleton(orig.typeKey)) return;
        const fields = Object.assign({}, orig.fields);
        const labelKey = ['titulo', 'orientando', 'candidato', 'especialidade', 'subarea', 'area', 'instituicao']
            .find(k => fields[k] && String(fields[k]).trim());
        if (labelKey) fields[labelKey] = `${fields[labelKey]} (cópia)`;
        const copy = {
            id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(), source: 'local',
            lattesItem: orig.lattesItem, typeKey: orig.typeKey, categoryKey: orig.categoryKey,
            fields, evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
        };
        await window.AppCore.persistItem(copy);
        toast('Item duplicado — revise os dados e anexe a evidência.', 'ok');
        renderItemList();
    }

    return { render };
})();
