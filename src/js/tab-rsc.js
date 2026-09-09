/* ==========================================================================
   lattesZen — Aba RSC-PCCTAE (simulador + memorial/formulário)
   --------------------------------------------------------------------------
   Terceira aba extraída de app.js (ver issue de refatoração), mesmo padrão
   das anteriores — lê estado/utilidades de window.AppCore.
   ========================================================================== */
window.TabRsc = (function () {
    const { state, $, $$, esc, toast, itemYear } = window.AppCore;

    // Itens que contam para o RSC (elegíveis, marcados, com critério e não usados)
    function rscItensContados() {
        return state.items.filter(i => i.rsc && i.rsc.conta && i.rsc.criterio && !i.rsc.jaUsado);
    }

    // Dados funcionais do servidor (cargo, SIAPE, contatos etc.) — antes em
    // Configurações › RSC, movidos pra cá (issue de usabilidade): fica tudo
    // num só lugar, junto do simulador que os usa. Em Configurações só resta
    // o "Habilitar módulo RSC-PCCTAE".
    function rscCfgSectionHtml(cfg) {
        const c = cfg || {};
        // Compatibilidade: valor antigo (campo único "Telefone/E-mail") migra
        // pra exibição nos 2 campos novos, na primeira vez que a tela abre
        // depois da separação — só grava de fato quando "Salvar configuração" é clicado.
        if (c.telefone == null && c.email == null && c.telefoneEmail) {
            const partes = c.telefoneEmail.split('/');
            if (partes.length >= 2) { c.telefone = partes[0].trim(); c.email = partes.slice(1).join('/').trim(); }
            else if (/@/.test(c.telefoneEmail)) { c.email = c.telefoneEmail.trim(); }
            else { c.telefone = c.telefoneEmail.trim(); }
        }
        // O ícone de ajuda também funciona por clique (não só por hover no
        // "title") — clicar mostra um toast com o texto completo, pra
        // funcionar em telas de toque e não depender do delay do tooltip
        // nativo do navegador.
        const labelHtml = (forId, lbl, help) => `<label class="block text-xs font-semibold mb-1" for="${forId}">${esc(lbl)}${help ? ` <button type="button" class="rsc-help-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" title="${esc(help)}" data-help="${esc(help)}" aria-label="Ajuda"><i class="fa-solid fa-circle-question"></i></button>` : ''}</label>`;
        const inp = (k, lbl, ph, validateKind, help) => `<div>${labelHtml('rsc-' + k, lbl, help)}
            <input id="rsc-${k}" type="text" value="${esc(c[k] || '')}" placeholder="${esc(ph || '')}" ${validateKind ? `data-validate="${validateKind}"` : ''} class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>`;
        const escOpts = LzRSC.ESCOLARIDADE.map(e => `<option value="${e.key}" ${c.escolaridade === e.key ? 'selected' : ''}>${esc(e.label)} (nível ${e.maxN}, IQ ${e.iq}%)</option>`).join('');
        const nivelClassOpts = ['A', 'B', 'C', 'D', 'E'].map(n => `<option value="${n}" ${c.nivelClassificacao === n ? 'selected' : ''}>${n}</option>`).join('');
        return `<section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <h3 class="font-bold text-sm mb-2 flex items-center gap-2"><i class="fa-solid fa-id-card text-govbr-600 dark:text-unifesp-400"></i> RSC: Dados pessoais</h3>
            <div class="grid grid-cols-2 gap-2">
                ${inp('cargo', 'Cargo', 'ex.: Assistente em Administração')}
                ${inp('siape', 'SIAPE', '(opcional)')}
                ${inp('lotacao', 'Lotação / unidade', '')}
                ${inp('matriculaFuncional', 'Matrícula ou Funcional', '')}
                <div>
                    ${labelHtml('rsc-nivelClassificacao', 'Nível de Classificação')}
                    <select id="rsc-nivelClassificacao" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"><option value="">—</option>${nivelClassOpts}</select>
                </div>
                <div>
                    ${labelHtml('rsc-escolaridade', 'Escolaridade atual (limita o nível máximo)')}
                    <select id="rsc-escolaridade" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"><option value="">—</option>${escOpts}</select>
                </div>
                ${inp('ingresso', 'Data de ingresso no cargo', '25/12/2026', 'dataCompleta')}
                ${inp('funcaoEncargo', 'Direção ou Função', '')}
                ${inp('dataInicioContagem', 'Início da contagem (RSC)', '25/12/2026', 'dataCompleta')}
                ${inp('dataAbrangenciaFinal', 'Final da contagem (RSC)', '25/12/2026', 'dataCompleta', 'Data de corte do memorial/requerimento. Usada como fim do período em itens ainda em exercício (situação "Atual", sem data de fim própria) — sem ela, esses itens não têm o tempo decorrido contado.')}
                ${inp('telefone', 'Telefone', '(11) 1234-5678', 'telefoneDDD')}
                ${inp('email', 'E-mail', 'fulano@instituicao.br', 'email')}
                <div class="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-2 mt-1 grid grid-cols-2 gap-2">
                    ${inp('saldoAnterior', 'Saldo de pontuação de concessão anterior', '')}
                    ${inp('processoAnterior', 'Nº do processo da concessão anterior (se houver)', '')}
                </div>
            </div>
            <div class="flex gap-2 mt-3">
                <button id="btnSaveRscCfg" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar</button>
            </div>
        </section>`;
    }
    function wireRscCfgSection() {
        window.AppCore.wireValidators($('#tab-rsc'));
        // O "title" cobre o hover; o clique garante que a ajuda também
        // apareça em telas de toque (sem hover) e sem depender do delay do
        // tooltip nativo do navegador.
        $$('.rsc-help-btn', $('#tab-rsc')).forEach(btn => {
            btn.addEventListener('click', () => toast(btn.dataset.help, 'info'));
        });
        const btn = $('#btnSaveRscCfg'); if (!btn) return;
        btn.addEventListener('click', () => {
            const keys = ['cargo', 'siape', 'matriculaFuncional', 'lotacao', 'ingresso', 'dataInicioContagem', 'dataAbrangenciaFinal',
                'nivelClassificacao', 'funcaoEncargo', 'telefone', 'email', 'saldoAnterior', 'processoAnterior'];
            const cfg = {};
            let temErro = false;
            keys.forEach(k => {
                const el = $('#rsc-' + k); if (!el) return;
                const v = el.value.trim();
                if (el.dataset.validate) {
                    const res = window.AppCore.validateField(el.dataset.validate, v);
                    if (v && !res.ok) { window.AppCore.setFieldError(el, res.msg); temErro = true; return; }
                    window.AppCore.setFieldError(el, '');
                }
                cfg[k] = v;
            });
            if (temErro) { toast('Corrija os campos destacados antes de salvar.', 'erro'); return; }
            cfg.escolaridade = $('#rsc-escolaridade').value;
            state.rscCfg = cfg;
            const s = Storage.loadSettings(); s.rsc = cfg; Storage.saveSettings(s);
            toast('Configuração do RSC salva.', 'ok');
            render();
        });
    }
    function render() {
        const panel = $('#tab-rsc');
        if (!state.rscEnabled) {
            panel.innerHTML = `<p class="text-sm text-gray-500 italic py-8 text-center">Módulo RSC desabilitado. Habilite em <strong>Configurações › RSC-PCCTAE</strong>.</p>`;
            return;
        }
        const cfg = state.rscCfg || {};
        const itens = rscItensContados();
        const rscList = itens.map(i => i.rsc);
        const sim = LzRSC.simular(rscList, cfg.escolaridade);

        // Lista de itens contados (conformidade RSC), em 3 níveis: Requisito
        // (I–VI, com Itens/Critérios/Pontos no cabeçalho — antes numa tabela
        // "Pontos por requisito" à parte, redundante) > Critério > itens.
        const grupos = {};
        itens.forEach(i => { const c = LzRSC.criterio(i.rsc.criterio); const r = c ? c.req : 0; (grupos[r] = grupos[r] || []).push(i); });
        const listaHtml = Object.keys(grupos).sort().map(r => {
            const pr = sim.porRequisito[r] || { itens: grupos[r].length, criterios: new Set(), pontos: 0 };
            const porCriterio = {};
            grupos[r].forEach(i => { (porCriterio[i.rsc.criterio] = porCriterio[i.rsc.criterio] || []).push(i); });
            const critKeysOrdenados = Object.keys(porCriterio).sort((a, b) => {
                const ca = LzRSC.criterio(a), cb = LzRSC.criterio(b);
                return (ca ? ca.item : 0) - (cb ? cb.item : 0);
            });
            const criteriosHtml = critKeysOrdenados.map(critKey => {
                const c = LzRSC.criterio(critKey);
                const itensHtml = porCriterio[critKey].map(i => {
                    const pi = LzRSC.pontosItem(i.rsc);
                    const ano = itemYear(i);
                    return `<div class="flex items-center justify-between gap-2 text-sm border border-gray-100 dark:border-gray-700/60 rounded px-2 py-1">
                        <span class="min-w-0 font-medium">${ano ? esc(ano) + ' - ' : ''}${esc(LattesTypes.itemTitle(i))}</span>
                        <span class="shrink-0 font-semibold text-amber-700 dark:text-amber-400 tabular-nums">${String(pi.pontos).replace('.', ',')}</span></div>`;
                }).join('');
                return `<div class="mb-2 last:mb-0">
                    <p class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">${c ? esc(c.item + '. ' + c.desc) : esc(critKey)}</p>
                    <div class="space-y-1">${itensHtml}</div>
                </div>`;
            }).join('');
            return `
            <details class="border border-gray-200 dark:border-gray-700 rounded mb-2">
                <summary class="cursor-pointer px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-sm font-medium">${esc(LzRSC.REQUISITOS[r] || 'Sem requisito')} <span class="text-xs text-gray-500">— ${pr.itens} ${pr.itens === 1 ? 'item' : 'itens'} · ${pr.criterios.size} ${pr.criterios.size === 1 ? 'critério' : 'critérios'} · <strong class="text-amber-700 dark:text-amber-400 tabular-nums">${String(pr.pontos).replace('.', ',')} pts</strong></span></summary>
                <div class="p-2">${criteriosHtml}</div>
            </details>`;
        }).join('') || `<p class="text-sm text-gray-500 italic">Nenhum item marcado para o RSC ainda. Em Catalogar, marque “usar para RSC” na linha “Publicar”.</p>`;

        panel.innerHTML = `
            ${rscCfgSectionHtml(cfg)}

            <div class="bg-gradient-to-br from-govbr-600 to-govbr-800 dark:from-unifesp-700 dark:to-unifesp-900 text-white rounded-lg p-4 mb-4">
                <p class="text-sm opacity-90">Nível alcançável</p>
                <p class="text-3xl font-bold">${esc(sim.nivelNome)}</p>
                <p class="text-sm mt-1">Incentivo à Qualificação: <strong>${sim.iq}%</strong></p>
                <p class="text-xs opacity-80 mt-2">${sim.total.toString().replace('.', ',')} pontos · ${sim.criteriosDistintos} critérios distintos</p>
                ${cfg.escolaridade ? `<p class="text-xs opacity-80">Escolaridade limita a nível ${sim.capNivel}.</p>` : `<p class="text-xs opacity-90">⚠ Informe a escolaridade acima.</p>`}
            </div>

            <h3 class="font-bold mb-2">Itens contabilizados</h3>
            ${listaHtml}

            <div class="flex gap-2 flex-wrap mb-4 mt-4">
                <button id="btnRscPromptIA" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Gerar prompt (IA)</button>
            </div>

            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <h3 class="font-bold text-sm">Memorial (texto final)</h3>
                    <button id="btnRscMemorialPadrao" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs"><i class="fa-solid fa-arrows-rotate mr-1"></i> Preencher com modelo automático</button>
                </div>
                <p class="text-xs text-gray-500 mb-2">Cole aqui o texto devolvido por uma IA externa (a partir do <strong>Gerar prompt (IA)</strong> acima) ou escreva/edite manualmente. <strong>Gerar memorial</strong> exporta exatamente o que estiver neste campo — se deixar em branco, usa o modelo automático.</p>
                <textarea id="rscMemorialTexto" rows="16" placeholder="Cole aqui o memorial gerado pela IA, ou escreva o seu…" class="w-full text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono leading-relaxed">${esc(state.rscMemorialTexto || '')}</textarea>
                <p id="rscMemorialSalvo" class="text-xs text-gray-400 mt-1 h-4"></p>
            </div>

            <div class="flex gap-2 flex-wrap mt-4">
                <button id="btnRscExportar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-file-export mr-1"></i> Gerar memorial, formulário e anexos</button>
            </div>`;

        wireRscCfgSection();
        $('#btnRscExportar').addEventListener('click', () => exportarRsc(itens, sim, cfg));
        $('#btnRscPromptIA').addEventListener('click', () => downloadText(rscPromptIA(itens, sim, cfg), 'prompt-trajetoria-profissional.md', 'text/markdown'));

        const memArea = $('#rscMemorialTexto');
        const memInfo = $('#rscMemorialSalvo');
        let memSaveTimer = null;
        const salvarMemorialTexto = () => {
            state.rscMemorialTexto = memArea.value;
            const s = Storage.loadSettings(); s.rscMemorialTexto = state.rscMemorialTexto; Storage.saveSettings(s);
            if (memInfo) { memInfo.textContent = 'Salvo.'; clearTimeout(memInfo._t); memInfo._t = setTimeout(() => { memInfo.textContent = ''; }, 1500); }
        };
        memArea.addEventListener('input', () => { clearTimeout(memSaveTimer); memSaveTimer = setTimeout(salvarMemorialTexto, 500); });
        memArea.addEventListener('blur', () => { clearTimeout(memSaveTimer); salvarMemorialTexto(); });
        $('#btnRscMemorialPadrao').addEventListener('click', () => {
            if (memArea.value.trim() && !confirm('Isso substitui o texto atual do memorial pelo modelo automático. Continuar?')) return;
            memArea.value = rscMemorial(itens, sim, cfg);
            salvarMemorialTexto();
            toast('Memorial preenchido com o modelo automático.', 'ok');
        });
    }
    function downloadText(txt, nome, mime) {
        const blob = new Blob([txt], { type: (mime || 'text/plain') + ';charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); URL.revokeObjectURL(a.href);
    }
    function rscMemorial(itens, sim, cfg) {
        const L = [];
        L.push('MEMORIAL — RSC-PCCTAE'); L.push('='.repeat(40));
        L.push(`Cargo: ${cfg.cargo || '—'}   Lotação: ${cfg.lotacao || '—'}   SIAPE: ${cfg.siape || '—'}`);
        L.push(`Ingresso no cargo: ${cfg.ingresso || '—'}   Escolaridade: ${(LzRSC.escInfo(cfg.escolaridade) || {}).label || '—'}`);
        L.push(`Nível pleiteável (simulado): ${sim.nivelNome} — ${sim.total.toString().replace('.', ',')} pontos, ${sim.criteriosDistintos} critérios.`);
        L.push('');
        for (let r = 1; r <= 6; r++) {
            const grp = itens.filter(i => { const c = LzRSC.criterio(i.rsc.criterio); return c && c.req === r; });
            if (!grp.length) continue;
            L.push(`REQUISITO ${LzRSC.REQUISITOS[r]}`); L.push('-'.repeat(40));
            grp.forEach(i => {
                const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                L.push(`• ${LattesTypes.itemTitle(i)}`);
                L.push(`  Critério ${c.id}: ${c.desc}`);
                const per = (i.rsc.dataInicio || i.rsc.dataFim) ? `  Período: ${i.rsc.dataInicio || '?'} a ${i.rsc.dataFim || '?'}.` : '';
                L.push(`  ${per}  Pontos: ${String(pi.pontos).replace('.', ',')} (${pi.quantidade} × ${String(pi.unitario).replace('.', ',')}).`);
                if (i.rsc.justificativa) L.push(`  Justificativa: ${i.rsc.justificativa}`);
                L.push('');
            });
        }
        return L.join('\n');
    }
    // Requisitos do RSC com a redação oficial do Anexo da Portaria MEC nº
    // 608/2026 (modelo padrão do formulário de requerimento) — ligeiramente
    // diferente do texto usado no simulador (LzRSC.REQUISITOS).
    const REQUISITOS_FORM = {
        1: 'I - Participação em grupos de trabalho, comissões, comitês, núcleos, representações ou similares',
        2: 'II - Projetos institucionais, gestão, ensino, pesquisa, extensão, inovação ou assistência',
        3: 'III - Premiações e reconhecimentos públicos',
        4: 'IV - Responsabilidades técnico-administrativas e/ou especializadas',
        5: 'V - Funções ou cargos de direção e assessoramento institucional',
        6: 'VI - Produção, prospecção e difusão de conhecimento',
    };
    const NUM_PT = n => String(n).replace('.', ',');

    // Prompt master + dados categorizados (markdown) para gerar, com uma IA
    // externa (Claude, ChatGPT etc.), o texto de "Trajetória Profissional"
    // exigido pelo Art. 13 do Decreto nº 13.048/2026 no Memorial Descritivo.
    // Deliberadamente NÃO inclui nome, SIAPE, telefone/e-mail, saldo ou nº de
    // processo anterior — só contexto profissional/institucional, para minimizar
    // dados pessoais enviados a uma ferramenta externa.
    function rscPromptIA(itens, sim, cfg) {
        const L = [];
        L.push('# Prompt — Trajetória Profissional (Memorial Descritivo RSC-PCCTAE)');
        L.push('');
        L.push('Você é um assistente de escrita técnica. Redija, em primeira pessoa, o texto de **"Trajetória Profissional"** que fará parte do Memorial Descritivo do Reconhecimento de Saberes e Competências (RSC-PCCTAE), conforme o Art. 13 do Decreto nº 13.048/2026, usando como base os dados categorizados no final deste arquivo.');
        L.push('');
        L.push('## O que escrever');
        L.push('Descreva de forma sucinta a trajetória profissional e as principais atividades exercidas, explicando como esse trabalho gerou os saberes e os resultados institucionais que justificam o nível de RSC pleiteado. É uma narrativa autoral, em prosa corrida — contando a história de aprendizado, conquistas e participação na instituição — e não um resumo burocrático, item a item, dos dados fornecidos.');
        L.push('');
        L.push('## Regras obrigatórias');
        L.push('- Texto objetivo, entre **4.000 e 10.000 caracteres** (contando espaços).');
        L.push('- Primeira pessoa, tom profissional e narrativo — parágrafos corridos, sem bullet points nem cabeçalhos dentro do texto final.');
        L.push('- **Não inclua dados pessoais sensíveis**: nome completo, endereço, CPF, SIAPE, telefone, e-mail ou qualquer informação sobre terceiros. Escreva apenas sobre a trajetória profissional.');
        L.push('- Baseie-se somente nos dados fornecidos abaixo — não invente atividades, datas ou resultados que não estejam neles.');
        L.push('- Organize a narrativa como fizer mais sentido para contar a história (cronologicamente, por eixos temáticos, pelos requisitos do RSC…) — não precisa seguir a ordem em que os dados aparecem.');
        L.push('');
        L.push('## Formato da resposta');
        L.push('Devolva apenas o texto final da Trajetória Profissional, pronto para colar no Memorial. Sem comentários, explicações ou meta-texto antes ou depois.');
        L.push('');
        L.push('---');
        L.push('');
        L.push('# Dados de entrada (documentos categorizados)');
        L.push('');
        L.push('## Contexto profissional');
        if (cfg.cargo) L.push(`- Cargo: ${cfg.cargo}`);
        if (cfg.nivelClassificacao) L.push(`- Nível de classificação: ${cfg.nivelClassificacao}`);
        if (cfg.funcaoEncargo) L.push(`- Função/encargo: ${cfg.funcaoEncargo}`);
        if (cfg.lotacao) L.push(`- Lotação: ${cfg.lotacao}`);
        if (cfg.ingresso) L.push(`- Data de ingresso na instituição: ${cfg.ingresso}`);
        const escLabel = (LzRSC.escInfo(cfg.escolaridade) || {}).label;
        if (escLabel) L.push(`- Escolaridade: ${escLabel}`);
        const nivelAlvo = sim.nivelAlcancavel || 0;
        if (nivelAlvo) L.push(`- Nível de RSC pleiteado (simulado): RSC-${['I', 'II', 'III', 'IV', 'V', 'VI'][nivelAlvo - 1]} (${sim.nivelNome})`);
        L.push('');

        const grupos = {};
        itens.forEach(i => { const c = LzRSC.criterio(i.rsc.criterio); const r = c ? c.req : 0; (grupos[r] = grupos[r] || []).push(i); });
        L.push('## Atividades por requisito');
        for (let r = 1; r <= 6; r++) {
            const grp = grupos[r] || [];
            if (!grp.length) continue;
            L.push('');
            L.push(`### Requisito ${REQUISITOS_FORM[r]}`);
            grp.forEach(i => {
                const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                L.push('');
                L.push(`- **Item**: ${LattesTypes.itemTitle(i)}`);
                if (c) L.push(`  - Critério: ${c.desc}`);
                const per = (i.rsc.dataInicio || i.rsc.dataFim) ? `${i.rsc.dataInicio || '?'} a ${i.rsc.dataFim || '?'}` : '';
                if (per) L.push(`  - Período: ${per}`);
                if (i.rsc.papel) L.push(`  - Papel/função: ${i.rsc.papel}`);
                if (i.rsc.justificativa) L.push(`  - Justificativa: ${i.rsc.justificativa}`);
            });
        }
        return L.join('\n');
    }

    // Nome do servidor cadastrado em "Identificação" (aba Perfil) — usado no
    // corpo do formulário e no nome do arquivo gerado.
    function nomeServidorAtual() {
        const item = state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
        return (item && item.fields.titulo) || '';
    }

    // "RSC_NomeCompleto_ddmmyyyy.docx" — nome do servidor sem caracteres
    // inválidos em nome de arquivo, data de hoje no formato ddmmyyyy.
    function nomeArquivoFormulario() {
        const safe = (nomeServidorAtual() || 'Servidor').replace(/[\\/:*?"<>|]/g, '').trim() || 'Servidor';
        const hoje = new Date();
        const dd = String(hoje.getDate()).padStart(2, '0');
        const mm = String(hoje.getMonth() + 1).padStart(2, '0');
        const yyyy = hoje.getFullYear();
        return `RSC_${safe}_${dd}${mm}${yyyy}.docx`;
    }

    // Monta o corpo (XML OOXML) do formulário padrão RSC-PCCTAE (Anexo da
    // Portaria MEC nº 608/2026), a partir dos dados de configuração, dos
    // itens marcados e da simulação já calculada. `anexos` (de
    // listarAnexosNumerados()) alimenta a coluna "Documentos comprobatórios"
    // com os mesmos identificadores (3 dígitos + nome) dos PDFs exportados
    // junto, pra dar pra cruzar um documento com o outro.
    function rscFormularioBody(itens, sim, cfg, anexos) {
        const D = window.LzDocx;
        const nomeServidor = nomeServidorAtual();
        const parts = [];
        const nomesPorItem = {};
        anexos.forEach(a => { (nomesPorItem[a.it.id] = nomesPorItem[a.it.id] || []).push(nomeArquivoAnexo(a)); });

        parts.push(D.heading('Requerimento de Reconhecimento de Saberes e Competências (RSC-PCCTAE)', 1));
        parts.push(D.para('Modelo padrão conforme Anexo da Portaria MEC nº 608, de 7 de julho de 2026.', { italic: true, size: 18 }));

        // ---- 1. Identificação do Servidor ----
        parts.push(D.heading('1. Identificação do Servidor', 2));
        const classeMarcada = n => cfg.nivelClassificacao === n ? `(X) ${n}` : `( ) ${n}`;
        parts.push(D.table([
            D.row([D.cell('Nome', { bold: true, width: 3000 }), D.cell(nomeServidor, { width: 6000 })]),
            D.row([D.cell('Siape', { bold: true }), D.cell(cfg.siape || '')]),
            D.row([D.cell('Cargo', { bold: true }), D.cell(cfg.cargo || '')]),
            D.row([D.cell('Data de ingresso em Instituição Federal de Ensino', { bold: true }), D.cell(cfg.ingresso || '')]),
            D.row([D.cell('Nível de Classificação', { bold: true }), D.cell(['A', 'B', 'C', 'D', 'E'].map(classeMarcada).join('   '))]),
            D.row([D.cell('Lotação', { bold: true }), D.cell(cfg.lotacao || '')]),
            D.row([D.cell('Função/Encargo (se houver)', { bold: true }), D.cell(cfg.funcaoEncargo || '')]),
            D.row([D.cell('Telefone', { bold: true }), D.cell(cfg.telefone || '')]),
            D.row([D.cell('E-mail', { bold: true }), D.cell(cfg.email || '')]),
        ], [3000, 6000]));

        // ---- 2. Informações do Requerimento ----
        parts.push(D.heading('2. Informações do Requerimento', 2));
        const nivelAlvo = sim.nivelAlcancavel || 0;
        const nivelMarcado = n => nivelAlvo === n ? `(X) RSC-${['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1]}` : `( ) RSC-${['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1]}`;
        const minPontos = nivelAlvo ? sim.niveis[nivelAlvo - 1].min.pontos : null;
        const excedente = minPontos != null ? Math.max(0, +(sim.total - minPontos).toFixed(2)) : 0;
        parts.push(D.table([
            D.row([D.cell('Nível de RSC pretendido', { bold: true, width: 3000 }), D.cell([1, 2, 3, 4, 5, 6].map(nivelMarcado).join('   '), { width: 6000 })]),
            D.row([D.cell('Pontuação mínima necessária', { bold: true }), D.cell(minPontos != null ? NUM_PT(minPontos) : '—')]),
            D.row([D.cell('Pontuação total apresentada', { bold: true }), D.cell(NUM_PT(sim.total))]),
            D.row([D.cell('Quantidade de critérios específicos utilizados', { bold: true }), D.cell(String(sim.criteriosDistintos))]),
            D.row([D.cell('Pontuação total excedente (banco de pontos)', { bold: true }), D.cell(NUM_PT(excedente))]),
            D.row([D.cell('Saldo de pontuação de concessão anterior', { bold: true }), D.cell(cfg.saldoAnterior || '')]),
            D.row([D.cell('Número do processo relativo à concessão anterior (se houver)', { bold: true }), D.cell(cfg.processoAnterior || '')]),
        ], [3000, 6000]));

        // ---- 3. Descrição das Atividades por Requisito Legal ----
        parts.push(D.heading('3. Descrição das Atividades por Requisito Legal', 2));
        parts.push(D.para('Itens organizados conforme os requisitos do art. 4º, incisos I a VI, do Decreto do RSC-PCCTAE, vinculando cada atividade ao critério específico correspondente.', { size: 18 }));

        const grupos = {};
        itens.forEach(i => { const c = LzRSC.criterio(i.rsc.criterio); const r = c ? c.req : 0; (grupos[r] = grupos[r] || []).push(i); });
        const colWidths = [900, 4300, 1600, 900, 1100, 1900];
        for (let r = 1; r <= 6; r++) {
            parts.push(D.heading(`Critério ${REQUISITOS_FORM[r]}`, 3));
            const head = D.row([
                D.cell('Nº do item', { bold: true, width: colWidths[0], shade: 'EEEEEE' }),
                D.cell('Critério específico', { bold: true, width: colWidths[1], shade: 'EEEEEE' }),
                D.cell('Unidade de medida', { bold: true, width: colWidths[2], shade: 'EEEEEE' }),
                D.cell('Pontuação', { bold: true, width: colWidths[3], shade: 'EEEEEE' }),
                D.cell('Pontuação obtida', { bold: true, width: colWidths[4], shade: 'EEEEEE' }),
                D.cell('Documentos comprobatórios (anexos)', { bold: true, width: colWidths[5], shade: 'EEEEEE' }),
            ]);
            const grp = grupos[r] || [];
            const rows = grp.length ? grp.map(i => {
                const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                return D.row([
                    D.cell(String(c.item), { width: colWidths[0] }),
                    D.cell(c.desc, { width: colWidths[1] }),
                    D.cell(c.unidade, { width: colWidths[2] }),
                    D.cell(NUM_PT(pi.unitario), { width: colWidths[3] }),
                    D.cell(NUM_PT(pi.pontos), { width: colWidths[4] }),
                    D.cell((nomesPorItem[i.id] || []).join('; ') || '—', { width: colWidths[5] }),
                ]);
            }) : [D.row([D.cell('—  nenhum item cadastrado neste critério  —', { width: colWidths.slice(0, 5).reduce((a, b) => a + b, 0) }), D.cell('', { width: colWidths[5] })])];
            const subtotal = D.row([D.cell('Subtotal', { bold: true, width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] }),
                D.cell(NUM_PT((sim.porRequisito[r] || { pontos: 0 }).pontos), { bold: true, width: colWidths[4] }),
                D.cell('', { width: colWidths[5] })]);
            parts.push(D.table([head, ...rows, subtotal], colWidths));
        }
        parts.push(D.para([D.run('(Critério I + Critério II + Critério III + Critério IV + Critério V + Critério VI) TOTAL: ', { bold: true }), D.run(NUM_PT(sim.total))]));
        parts.push(D.para(`À vista das informações apresentadas, totalizo ${NUM_PT(sim.total)} pontos e atendo aos critérios legais e regulamentares para o nível ${sim.nivelNome} do RSC-PCCTAE. Solicito a análise pela CRSC-PCCTAE.`));

        // ---- 4. Declaração de Conformidade Legal ----
        parts.push(D.heading('4. Declaração de Conformidade Legal', 2));
        parts.push(D.para('Declaro, para os fins previstos no Decreto regulamentador do RSC-PCCTAE, que:'));
        parts.push(D.para('I - Todos os fatos apresentados ocorreram no exercício do cargo;'));
        parts.push(D.para('II - Nenhuma atividade aqui declarada foi utilizada em requerimentos anteriores;'));
        parts.push(D.para('III - Toda a documentação anexada é autêntica e comprova integralmente as atividades apresentadas; e'));
        parts.push(D.para('IV - Tenho ciência de que informações falsas implicam responsabilidade administrativa, civil e penal.'));
        parts.push(D.para(' '));
        parts.push(D.para('Assinatura: _______________________________________     Data: ____/____/________'));

        return parts.join('');
    }

    // Pasta datada (uma por dia) dentro de Exportação/RSC-PCCTAE — reexportar
    // no mesmo dia sobrescreve os arquivos daquele dia (mesmo padrão de
    // nomeArquivoFormulario()); dias diferentes não se sobrescrevem. Memorial,
    // formulário e anexos vão todos juntos aqui.
    function pastaExportacaoHoje() {
        const hoje = new Date();
        const dd = String(hoje.getDate()).padStart(2, '0');
        const mm = String(hoje.getMonth() + 1).padStart(2, '0');
        const yyyy = hoje.getFullYear();
        return `${LattesTypes.rscFolder()}/${dd}${mm}${yyyy}`;
    }
    function sanitizeArquivo(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim(); }

    // Ordena os itens contabilizados por Requisito (1-6) e, dentro dele, por
    // critério — a MESMA ordem usada tanto no memorial quanto no formulário,
    // pra que o primeiro documento citado em qualquer um dos dois seja
    // sempre o 001, o segundo o 002, e assim por diante (facilita conferir a
    // correspondência entre os PDFs, o memorial e o formulário).
    function itensOrdenadosParaExportacao(itens) {
        return itens.slice().sort((a, b) => {
            const ca = LzRSC.criterio(a.rsc.criterio), cb = LzRSC.criterio(b.rsc.criterio);
            const ra = ca ? ca.req : 99, rb = cb ? cb.req : 99;
            if (ra !== rb) return ra - rb;
            return String(a.rsc.criterio).localeCompare(String(b.rsc.criterio));
        });
    }

    // Lista, na mesma ordem de leitura do memorial/formulário (ver
    // itensOrdenadosParaExportacao), todos os anexos-arquivo (evidências que
    // não são links) dos itens contabilizados, com um número sequencial
    // ÚNICO (001, 002…) atribuído de uma vez só — esse é o mesmo número
    // usado no nome do PDF exportado, no início do item correspondente no
    // memorial, e na coluna "Documentos comprobatórios" do formulário, pra
    // dar pra cruzar um com o outro sem ambiguidade.
    function listarAnexosNumerados(itens) {
        const lista = [];
        itens.forEach(it => {
            const evs = Array.isArray(it.evidencias) ? it.evidencias.filter(e => e.kind !== 'link' && e.basename && e.ext) : [];
            evs.forEach(ev => lista.push({ it, ev }));
        });
        lista.forEach((a, i) => { a.num = i + 1; });
        return lista;
    }
    const numAnexo = (n) => String(n).padStart(3, '0');
    // Nome do arquivo do PDF exportado — 3 dígitos + espaço (sem hífen, nome
    // mais curto, evita estourar o tamanho máximo de caminho de arquivo do
    // SO) + título do item. O mesmo identificador aparece no formulário
    // (coluna "Documentos comprobatórios") e no memorial (início do item).
    function nomeArquivoAnexo(a) {
        const titulo = sanitizeArquivo(LattesTypes.itemTitle(a.it)).slice(0, 60) || 'anexo';
        return `${numAnexo(a.num)} ${titulo}.${a.ev.ext}`;
    }

    // Corpo (OOXML) do memorial em .docx: o texto do campo (livre — IA ou
    // manual), seguido dos itens contabilizados organizados na mesma
    // hierarquia do requerimento oficial — Requisito (Título 2) > Critério,
    // só os que têm item (Título 3) > itens, cada um já com o número do(s)
    // anexo(s) correspondente(s) no início (mesmo número do PDF exportado),
    // nome, período e carga horária, quando houver.
    function memorialDocxBody(texto, itens, anexos, cfg) {
        const D = window.LzDocx;
        const parts = [];
        parts.push(D.heading('Memorial — RSC-PCCTAE', 1));
        const subtitulo = [nomeServidorAtual(), cfg.cargo].filter(Boolean).join(' — ');
        if (subtitulo) parts.push(D.para(subtitulo, { italic: true, size: 18 }));
        parts.push(D.para(' '));
        String(texto || '').split('\n').forEach(linha => { parts.push(D.para(linha)); });

        const numerosPorItem = {};
        anexos.forEach(a => { (numerosPorItem[a.it.id] = numerosPorItem[a.it.id] || []).push(a.num); });

        const porRequisito = {};
        itens.forEach(it => { const c = LzRSC.criterio(it.rsc.criterio); const r = c ? c.req : 0; (porRequisito[r] = porRequisito[r] || []).push(it); });

        if (itens.length) parts.push(D.para(' '));
        for (let r = 1; r <= 6; r++) {
            const grp = porRequisito[r] || [];
            if (!grp.length) continue;
            parts.push(D.heading(`REQUISITO ${REQUISITOS_FORM[r]}`, 2));

            const porCriterio = {};
            grp.forEach(it => { (porCriterio[it.rsc.criterio] = porCriterio[it.rsc.criterio] || []).push(it); });
            Object.keys(porCriterio).forEach(critKey => {
                const c = LzRSC.criterio(critKey);
                parts.push(D.heading(c ? `${c.item}. ${c.desc}` : critKey, 3));
                porCriterio[critKey].forEach(it => {
                    const nums = (numerosPorItem[it.id] || []).map(numAnexo);
                    const prefixo = nums.length ? `${nums.join(', ')}: ` : '';
                    const periodo = (it.rsc.dataInicio || it.rsc.dataFim) ? ` (${it.rsc.dataInicio || '?'} a ${it.rsc.dataFim || '?'})` : '';
                    const ch = (it.fields && it.fields.cargaHoraria) ? ` | Carga horária: ${it.fields.cargaHoraria}h` : '';
                    parts.push(D.para(`${prefixo}${LattesTypes.itemTitle(it)}${periodo}${ch}`));
                });
            });
        }
        return parts.join('');
    }

    // Ação única: gera o memorial (o texto do campo, editado manualmente ou
    // colado de uma IA externa — ou o modelo automático, se o campo estiver
    // vazio) e o formulário oficial, ambos em .docx, e grava uma cópia de
    // todos os anexos-arquivo dos itens contabilizados — cada PDF numerado
    // sequencialmente (001, 002…), com o mesmo número no início do item
    // correspondente no memorial e na coluna "Documentos comprobatórios" do
    // formulário — tudo numa única pasta datada dentro de "Exportação/
    // RSC-PCCTAE", pronto pra juntar ao requerimento.
    async function exportarRsc(itens, sim, cfg) {
        if (!Storage.hasDirectory()) { toast('Configure um diretório em Configurações para exportar.', 'aviso'); return; }
        try {
            const folder = pastaExportacaoHoje();
            const nomeServidor = sanitizeArquivo(nomeServidorAtual()) || 'Servidor';
            const ordenados = itensOrdenadosParaExportacao(itens);
            const anexos = listarAnexosNumerados(ordenados);

            const textoMemorial = (state.rscMemorialTexto && state.rscMemorialTexto.trim()) ? state.rscMemorialTexto : rscMemorial(itens, sim, cfg);
            const memorialBytes = window.LzDocx.buildDocx(memorialDocxBody(textoMemorial, ordenados, anexos, cfg));
            await Storage.writeFile(`Memorial_${nomeServidor}.docx`, memorialBytes, folder);

            const formBytes = window.LzDocx.buildDocx(rscFormularioBody(ordenados, sim, cfg, anexos));
            await Storage.writeFile(nomeArquivoFormulario(), formBytes, folder);

            let nAnexos = 0;
            for (const a of anexos) {
                const f = await Storage.readAttachmentFile(a.ev.basename, LattesTypes.categoryFolder(a.it.categoryKey), a.ev.ext);
                if (!f) continue;
                await Storage.writeFile(nomeArquivoAnexo(a), f, `${folder}/Anexos`);
                nAnexos++;
            }
            toast(`Memorial e formulário exportados em "${folder}/"${nAnexos ? ` (+ ${nAnexos} anexo${nAnexos === 1 ? '' : 's'} numerado${nAnexos === 1 ? '' : 's'} em "Anexos/")` : ''}.`, 'ok');
        } catch (e) { toast('Falha ao exportar: ' + e.message, 'erro'); }
    }

    return { render };
})();
