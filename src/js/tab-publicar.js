/* ==========================================================================
   lattesZen — Aba PUBLICAR (página pública do currículo — 1 arquivo HTML)
   --------------------------------------------------------------------------
   Primeira aba extraída de app.js para seu próprio módulo (ver issue de
   refatoração) — usa o mesmo padrão dos módulos de domínio (window.X),
   lendo estado e utilidades compartilhadas de window.AppCore.
   ========================================================================== */
window.TabPublicar = (function () {
    const { state, $, esc, toast, anoDe, isImageExt, itemYear, sortByYear, publicarWebOk } = window.AppCore;

    function fileToDataUrl(file) {
        return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(file); });
    }
    // Linha-resumo (subtítulo) de um item, a partir de campos-chave
    function itemLinha(it) {
        const f = it.fields || {}, title = LattesTypes.itemTitle(it), parts = [];
        const add = v => { v = String(v || '').trim(); if (v && v !== title && !parts.includes(v)) parts.push(v); };
        ['periodico', 'evento', 'instituicao', 'orgao', 'entidade', 'editora', 'cargo', 'tipo', 'financiador', 'autores'].forEach(k => add(f[k]));
        return parts.slice(0, 4).join(' · ');
    }
    // "ano - ano" quando o item tem início/fim diferentes (ex.: Atuação,
    // Formação); um único ano (ou o fallback ano/anoFim/anoInicio de
    // itemYear) quando não há período.
    function itemAnoRange(it) {
        const f = it.fields || {};
        const ini = anoDe(f.anoInicio || ''), fim = anoDe(f.anoFim || '');
        if (ini && fim && ini !== fim) return `${ini}–${fim}`;
        if (ini && !fim) return ini;
        const y = itemYear(it);
        return y != null ? String(y) : '';
    }
    // Subpasta (dentro de "Publicação para Web") onde as imagens ficam como
    // arquivos à parte, na versão "external" (salva na pasta).
    const PUB_IMG_SUBDIR = 'img';
    const PUB_CSS_FILE = 'estilo.css';
    // Evidências públicas de um item, prontas para o modelo da página pública.
    // Por padrão embute em base64 (arquivo único, autossuficiente — usado na
    // prévia e no HTML baixado). Com `opts.external: true`, imagens (jpg/png/
    // gif/webp) viram arquivo à parte em "Publicação para Web/img" e entram
    // no modelo como link relativo, não base64 (demais tipos, ex. PDF,
    // continuam embutidos — só "imagens" precisam ser arquivo separado).
    // Links (kind 'link') sempre entram como estão, nos dois modos. Com
    // `opts.collect` (array), também empilha {path, content} de cada imagem
    // externa nela — usado pela publicação direta (GitHub/Netlify), que
    // precisa dos bytes em memória, não só do link relativo gravado na pasta.
    async function itemAnexos(it, opts) {
        opts = opts || {};
        const { external, collect } = opts;
        const anexos = [];
        if (Array.isArray(it.evidencias)) {
            for (const ev of it.evidencias) {
                if (!ev.publica) continue;
                if (ev.kind === 'link') { anexos.push({ name: ev.name || ev.url, ext: 'url', url: ev.url }); continue; }
                if (!Storage.hasDirectory()) continue;
                try {
                    const f = await Storage.readAttachmentFile(ev.basename, LattesTypes.categoryFolder(it.categoryKey), ev.ext);
                    if (!f) continue;
                    const nome = ev.name || `${ev.basename}.${ev.ext}`;
                    if (external && isImageExt(ev.ext)) {
                        const relPath = `${PUB_IMG_SUBDIR}/${ev.basename}.${ev.ext}`;
                        await Storage.writeFile(`${ev.basename}.${ev.ext}`, f, `${LattesTypes.publicacaoFolder()}/${PUB_IMG_SUBDIR}`);
                        if (collect) collect.push({ path: relPath, content: f });
                        anexos.push({ name: nome, ext: ev.ext, url: relPath });
                    } else {
                        const du = await fileToDataUrl(f);
                        if (du) anexos.push({ name: nome, ext: ev.ext, dataUri: du });
                    }
                } catch (_) {}
            }
        }
        return anexos;
    }
    const PUB_ICON = { DADOS_GERAIS: '🪪', FORMACAO: '🎓', ATUACAO: '💼', PROJETOS: '🧩', PRODUCOES: '📚', PATENTES_REGISTROS: '📜', INOVACAO: '💡', EDUCACAO_CT: '📢', EVENTOS: '📅', ORIENTACOES: '👥', BANCAS: '⚖️',
        AL_DESENVOLVIMENTO: '🌱', AL_ENGAJAMENTO: '🤝', AL_SAUDE_ESPORTE: '🏃', AL_INTERESSES: '🎨', AL_CERTIFICACAO_CAT: '📜', AL_FILIACAO_CAT: '🪪', AL_CONCURSO_CAT: '📋', AL_IMPRENSA_CAT: '📰' };
    const PUB_EXCLUDE_TYPES = new Set(['IDENTIFICACAO', 'FOTO_PERFIL', 'ENDERECO', 'RESUMO_CV', 'OUTRAS_INFO', 'DOCUMENTO_PESSOAL']);
    // Categorias 12–19 ("Além do Lattes": Desenvolvimento Pessoal, Engajamento,
    // Saúde/Esporte, Interesses, Certificações, Filiações, Concursos, Imprensa)
    // viram uma única seção mesclada na página pública. Fora do intervalo: a
    // 97 (RSC — administrativo, tema à parte) e 20/21 (perfil: foto/documentos).
    const PUB_MERGE_LABEL = 'Além do Currículo Lattes';
    const PUB_MERGE_ID = 'sec-extras';

    // opts.external: grava as imagens (foto + evidências) como arquivos à
    // parte em "Publicação para Web/img" (em vez de embutir em base64) — só
    // faz sentido quando o HTML gerado vai ficar salvo NA MESMA pasta (senão
    // os links relativos quebram). Usado só pelo "Salvar na pasta"; a prévia
    // e o "Baixar" continuam sempre autossuficientes (embed).
    async function buildPublicModel(opts) {
        const external = !!(opts && opts.external);
        const collect = opts && opts.collect;
        const anexosOpts = { external, collect };
        const items = state.items;
        const first = tk => items.find(i => i.typeKey === tk);
        const byType = tk => items.filter(i => i.typeKey === tk);
        const ident = first('IDENTIFICACAO'), resumo = first('RESUMO_CV'), endereco = first('ENDERECO'), outrasI = first('OUTRAS_INFO'), fotoItem = first('FOTO_PERFIL');
        const nome = (ident && ident.fields.titulo) ? ident.fields.titulo : 'Currículo';
        const iniciais = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
        const orcid = (ident && ident.fields.orcid || '').trim();
        const lattesUrl = (ident && ident.fields.url || '').trim();
        const local = endereco ? [endereco.fields.cidade, endereco.fields.uf].filter(Boolean).join(' / ') : '';
        // Áreas de atuação: editadas em Configurações (perfil), não passam
        // mais pelo laço de categorias abaixo — entram direto no cabeçalho.
        const areasAtuacao = byType('AREA_ATUACAO').map(it => LattesTypes.itemTitle(it)).filter(Boolean);

        let foto = null;
        if (fotoItem && Storage.hasDirectory()) {
            const ev = (Array.isArray(fotoItem.evidencias) && fotoItem.evidencias[0]) || (fotoItem.hasPdf ? { basename: fotoItem.id, ext: fotoItem.fileExt || 'jpg' } : null);
            if (ev) {
                try {
                    const f = await Storage.readAttachmentFile(ev.basename, LattesTypes.categoryFolder('PERFIL_FOTOS'), ev.ext);
                    if (f) {
                        if (external) {
                            await Storage.writeFile(`foto.${ev.ext}`, f, `${LattesTypes.publicacaoFolder()}/${PUB_IMG_SUBDIR}`);
                            foto = `${PUB_IMG_SUBDIR}/foto.${ev.ext}`;
                            if (collect) collect.push({ path: foto, content: f });
                        } else foto = await fileToDataUrl(f);
                    }
                } catch (_) {}
            }
        }

        const contatos = [];
        if (orcid) contatos.push({ grupo: 'Acadêmicas', plataforma: 'ORCID', url: /^https?:/i.test(orcid) ? orcid : 'https://orcid.org/' + orcid, usuario: orcid });
        if (lattesUrl) contatos.push({ grupo: 'Acadêmicas', plataforma: 'Lattes', url: lattesUrl, usuario: '' });
        ['CONEXAO_ACADEMICA', 'CONEXAO_PROFISSIONAL', 'CONEXAO_SOCIAL'].forEach(tk => byType(tk).forEach(i => {
            const u = (i.fields.url || '').trim(); if (!u) return;
            const url = (/@/.test(u) && !/^https?:|^mailto:/i.test(u)) ? 'mailto:' + u : u;
            contatos.push({ grupo: LattesTypes.label(tk), plataforma: i.fields.titulo || LattesTypes.label(tk), url, usuario: i.fields.usuario || '' });
        }));

        const secoes = [];
        const extrasTipos = []; // categorias 12–19, mescladas numa única seção
        // Espelha exatamente os itens que entram nas seções abaixo (mesmo
        // filtro publicarWebOk) — base para a nuvem de palavras e a linha do
        // tempo da página pública, pra nunca vazar nada que não esteja
        // visível no currículo público.
        const publicItemsFlat = [];
        for (const cat of LattesTypes.categories) {
            if (cat.key === 'CONEXOES') continue;
            const typeKeys = cat.groups ? cat.groups.flatMap(g => g.types) : (cat.types || []);

            // Atuação: agrupa todos os tipos (vínculo, direção, pesquisa,
            // ensino...) por nome da instituição, em vez de um bloco por tipo
            // — assim toda a trajetória numa mesma instituição fica junta,
            // como no Currículo Lattes real. Itens sem instituição (raro:
            // corpo editorial/revisor de periódico não têm esse campo) caem
            // num grupo "Outras atuações" ao final.
            if (cat.key === 'ATUACAO') {
                const seus = typeKeys.filter(tk => !PUB_EXCLUDE_TYPES.has(tk));
                const porInstituicao = new Map();
                for (const it of items.filter(i => seus.includes(i.typeKey) && i.categoryKey === cat.key && publicarWebOk(i))) {
                    const inst = String((it.fields && it.fields.instituicao) || '').trim() || '\0outras';
                    if (!porInstituicao.has(inst)) porInstituicao.set(inst, []);
                    porInstituicao.get(inst).push(it);
                }
                const gruposAtu = [];
                for (const [inst, its] of porInstituicao) {
                    const ordenados = sortByYear(its, false);
                    const itens = [];
                    let maxAno = -Infinity;
                    for (const it of ordenados) {
                        const y = itemYear(it); if (y != null && y > maxAno) maxAno = y;
                        const tipoLabel = LattesTypes.label(it.typeKey);
                        const linha = [tipoLabel, (it.fields && it.fields.orgao) || ''].map(s => String(s || '').trim()).filter(Boolean).join(' · ');
                        itens.push({ titulo: LattesTypes.itemTitle(it), ano: itemAnoRange(it), linha, anexos: await itemAnexos(it, anexosOpts) });
                        publicItemsFlat.push(it);
                    }
                    gruposAtu.push({ label: inst === '\0outras' ? 'Outras atuações' : inst, itens, _maxAno: maxAno });
                }
                gruposAtu.sort((a, b) => (b.label === 'Outras atuações' ? -1 : a.label === 'Outras atuações' ? 1 : b._maxAno - a._maxAno));
                gruposAtu.forEach(g => delete g._maxAno);
                if (gruposAtu.length) secoes.push({ id: 'sec-' + cat.key.toLowerCase(), num: cat.num, label: cat.label, icon: PUB_ICON[cat.key] || '▣', tipos: gruposAtu });
                continue;
            }

            const tipos = [];
            for (const tk of typeKeys) {
                if (PUB_EXCLUDE_TYPES.has(tk)) continue;
                // Casa tipo E categoria do item (um tipo pode figurar em mais de
                // uma categoria; o item pertence só à sua categoria de origem)
                const its = sortByYear(items.filter(i => i.typeKey === tk && i.categoryKey === cat.key && publicarWebOk(i)), false);
                if (!its.length) continue;
                const itens = [];
                for (const it of its) { itens.push({ titulo: LattesTypes.itemTitle(it), ano: itemAnoRange(it), linha: itemLinha(it), anexos: await itemAnexos(it, anexosOpts) }); publicItemsFlat.push(it); }
                tipos.push({ label: LattesTypes.label(tk), itens });
            }
            const catNum = parseInt(cat.num, 10);
            if (catNum >= 12 && catNum <= 19) extrasTipos.push(...tipos);
            else if (tipos.length) secoes.push({ id: 'sec-' + cat.key.toLowerCase(), num: cat.num, label: cat.label, icon: PUB_ICON[cat.key] || '▣', tipos });
        }
        if (extrasTipos.length) secoes.push({ id: PUB_MERGE_ID, num: null, label: PUB_MERGE_LABEL, icon: '✦', tipos: extrasTipos });
        // Nome em citações agora é uma lista (repeater); junta as variações
        // para exibir como subtítulo. Aceita também o formato antigo (string)
        // para itens salvos antes da mudança.
        const citacoes = ident && ident.fields.citacoes;
        const tagline = Array.isArray(citacoes) ? citacoes.map(r => r && r.nome).filter(Boolean).join(' / ') : (citacoes || '');

        // Nuvem de palavras e linha do tempo (mesma lógica da aba Linha do
        // tempo do app — ver tab-linha-tempo.js), só com publicItemsFlat (os
        // mesmos itens que aparecem nas seções acima).
        const nuvemPalavras = TabLinhaTempo.contarPalavras(50, publicItemsFlat);
        const { porCategoria, anoMin, anoMax } = TabLinhaTempo.contarPorCategoriaEAno(publicItemsFlat);
        const catKeysTempo = Object.keys(porCategoria).sort((a, b) => {
            const ca = LattesTypes.categoryByKey(a), cb = LattesTypes.categoryByKey(b);
            return String(ca ? ca.num : '99').localeCompare(String(cb ? cb.num : '99'));
        });
        const linhaTempo = catKeysTempo.length
            ? { anoMin, anoMax, categorias: catKeysTempo.map(k => ({ label: LattesTypes.categoryLabel(k), porAno: porCategoria[k] })) }
            : null;

        return {
            nome, iniciais, tagline, bio: (resumo && resumo.fields.descricao) || '',
            foto, local, areasAtuacao, orcid, lattesUrl, contatos, outras: (outrasI && outrasI.fields.descricao) || '',
            nuvemPalavras, linhaTempo,
            secoes, geradoEm: new Date().toLocaleString('pt-BR'), totalItens: items.length,
        };
    }
    // Tema (paleta de cores) da página pública — escolhido em Publicar na
    // Web, persiste entre sessões. 'elegante' é o padrão (e o único que
    // existia antes desta preferência).
    function pubStyle() {
        const s = Storage.loadSettings();
        return (s.pubStyle && LzPublish.styles.includes(s.pubStyle)) ? s.pubStyle : 'elegante';
    }
    function setPubStyle(style) {
        const s = Storage.loadSettings(); s.pubStyle = style; Storage.saveSettings(s);
    }

    // external: gera a versão com CSS/imagens como arquivo à parte (grava as
    // imagens como efeito colateral de buildPublicModel) — usar só junto da
    // gravação do css/estilo.css na mesma pasta (ver btnPubSave/btnPubDownload).
    async function generatePublicHtml(external) {
        const model = await buildPublicModel({ external });
        return LzPublish.renderHtml(model, pubStyle(), external ? { externalCss: `css/${PUB_CSS_FILE}` } : null);
    }

    // Grava a versão pronta para hospedar (index.html + css/estilo.css +
    // img/*) em "Publicação para Web" — usada pelo Salvar e, quando há
    // diretório configurado, também pelo Baixar (além de baixar o arquivo).
    async function savePublicBundle() {
        const folder = LattesTypes.publicacaoFolder();
        await Storage.writeFile(PUB_CSS_FILE, LzPublish.css(pubStyle()), `${folder}/css`);
        const html = await generatePublicHtml(true);
        await Storage.writeFile('index.html', html, folder);
        return { folder, html };
    }

    /* ------------------- Publicação direta (GitHub/Netlify) -------------- */
    // Monta os mesmos arquivos da versão "pronta para hospedar" (índice +
    // css/estilo.css + img/*), mas devolvidos em memória — não depende de
    // reler do diretório configurado depois de gravar (o GitHub/Netlify não
    // enxergam a pasta local/Drive do usuário; os bytes têm que vir daqui).
    async function buildDeployFiles() {
        const collect = [];
        const model = await buildPublicModel({ external: true, collect });
        const html = LzPublish.renderHtml(model, pubStyle(), { externalCss: `css/${PUB_CSS_FILE}` });
        const css = LzPublish.css(pubStyle());
        return [{ path: 'index.html', content: html }, { path: `css/${PUB_CSS_FILE}`, content: css }, ...collect];
    }
    function deployConfig(provider) {
        const s = Storage.loadSettings();
        return Object.assign({ token: Storage.loadDeployToken(provider) }, s['deploy_' + provider] || {});
    }
    function saveDeployConfig(provider, cfg) {
        const { token, ...resto } = cfg;
        Storage.saveDeployToken(provider, token || '');
        const s = Storage.loadSettings();
        s['deploy_' + provider] = resto;
        Storage.saveSettings(s);
    }
    function render() {
        const panel = $('#tab-publicar');
        panel.innerHTML = `
            <div class="space-y-4 max-w-4xl">
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-globe text-govbr-600 dark:text-unifesp-400"></i> Página pública do currículo</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Foto e contatos vêm do perfil e das Conexões. Apenas as evidências marcadas como <strong>“pública”</strong> ficam acessíveis na página. Ao <strong>salvar na pasta</strong>, a página vai pronta para hospedar: <code>index.html</code> + <code>css/</code> + <code>img/</code> em “${esc(LattesTypes.publicacaoFolder())}”. O <strong>arquivo baixado</strong> é sempre um único HTML autossuficiente (CSS e imagens embutidos), para abrir/enviar sem depender de mais nada.</p>
                    <label class="flex items-center gap-2 text-sm mb-3">
                        <span class="font-medium">Tema:</span>
                        <select id="pubStyleSelect" class="rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm px-2 py-1">
                            ${LzPublish.styles.map(k => `<option value="${esc(k)}">${esc(LzPublish.styleLabel(k))}</option>`).join('')}
                        </select>
                    </label>
                    <div class="flex gap-2 flex-wrap">
                        <button id="btnPubPreview" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-eye mr-1"></i> Gerar prévia</button>
                        <button id="btnPubSave" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-folder-open mr-1"></i> Salvar na pasta (${esc(LattesTypes.publicacaoFolder())})</button>
                        <button id="btnPubDownload" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar HTML</button>
                    </div>
                    <p id="pubStatus" class="text-xs text-gray-500 mt-2"></p>
                </section>

                <details class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <summary class="text-lg font-bold cursor-pointer flex items-center gap-2"><i class="fa-solid fa-cloud-arrow-up text-govbr-600 dark:text-unifesp-400"></i> Publicar direto num site</summary>
                    <p class="text-sm text-gray-600 dark:text-gray-400 my-3">Envia a página (a mesma versão de “Salvar na pasta”) direto para o GitHub Pages e/ou o Netlify, sem precisar baixar e enviar manualmente. Cada token fica guardado só neste navegador (não entra no backup de Configurações → Exportar catálogo) — use um token com o menor escopo possível.</p>

                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                            <h3 class="font-semibold text-sm flex items-center gap-2"><i class="fa-brands fa-github"></i> GitHub Pages</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Crie um <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" class="underline">token de acesso restrito a um repositório</a>, com permissão “Contents: Read and write” (e “Pages: Read and write”, opcional, para habilitar o Pages automaticamente).</p>
                            <label class="block text-xs">Token
                                <input id="ghToken" type="password" autocomplete="off" class="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm px-2 py-1 mt-0.5" placeholder="github_pat_…">
                            </label>
                            <div class="flex gap-2">
                                <label class="block text-xs flex-1">Dono
                                    <input id="ghOwner" type="text" class="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm px-2 py-1 mt-0.5" placeholder="usuario">
                                </label>
                                <label class="block text-xs flex-1">Repositório
                                    <input id="ghRepo" type="text" class="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm px-2 py-1 mt-0.5" placeholder="usuario.github.io">
                                </label>
                            </div>
                            <label class="block text-xs">Branch
                                <input id="ghBranch" type="text" class="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm px-2 py-1 mt-0.5" placeholder="gh-pages">
                            </label>
                            <div class="flex gap-2 flex-wrap pt-1">
                                <button id="btnGhSave" type="button" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs">Salvar configuração</button>
                                <button id="btnGhDeploy" type="button" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-xs"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Publicar no GitHub Pages</button>
                            </div>
                            <p id="ghDeployStatus" class="text-xs text-gray-500"></p>
                        </div>

                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                            <h3 class="font-semibold text-sm flex items-center gap-2"><i class="fa-solid fa-bolt"></i> Netlify</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Crie um <a href="https://app.netlify.com/user/applications#personal-access-tokens" target="_blank" rel="noopener" class="underline">token de acesso pessoal</a> em User settings → Applications. Se ainda não tem um site, use “Criar site novo”.</p>
                            <label class="block text-xs">Token
                                <input id="netlifyToken" type="password" autocomplete="off" class="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm px-2 py-1 mt-0.5" placeholder="nfp_…">
                            </label>
                            <label class="block text-xs">ID do site
                                <input id="netlifySiteId" type="text" class="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm px-2 py-1 mt-0.5" placeholder="ex.: a1b2c3d4-…">
                            </label>
                            <div class="flex gap-2 flex-wrap pt-1">
                                <button id="btnNetlifyCreateSite" type="button" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs">Criar site novo</button>
                                <button id="btnNetlifySave" type="button" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs">Salvar configuração</button>
                                <button id="btnNetlifyDeploy" type="button" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-xs"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Publicar no Netlify</button>
                            </div>
                            <p id="netlifyDeployStatus" class="text-xs text-gray-500"></p>
                        </div>
                    </div>
                </details>

                <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white" style="height:75vh">
                    <iframe id="pubPreview" class="w-full h-full" title="Prévia da página pública"></iframe>
                </div>
            </div>`;
        const status = (t) => { const el = $('#pubStatus'); if (el) el.textContent = t; };
        $('#pubStyleSelect').value = pubStyle();
        $('#pubStyleSelect').addEventListener('change', async (e) => {
            setPubStyle(e.target.value);
            status('Gerando prévia…');
            try { $('#pubPreview').srcdoc = await generatePublicHtml(); status('Prévia atualizada.'); }
            catch (err) { status(''); toast('Falha ao gerar: ' + err.message, 'erro'); }
        });
        $('#btnPubPreview').addEventListener('click', async () => {
            status('Gerando prévia…');
            try { $('#pubPreview').srcdoc = await generatePublicHtml(); status('Prévia atualizada.'); }
            catch (e) { status(''); toast('Falha ao gerar: ' + e.message, 'erro'); }
        });
        $('#btnPubSave').addEventListener('click', async () => {
            if (!Storage.hasDirectory()) { toast('Configure um diretório em Configurações para salvar na pasta.', 'aviso'); return; }
            status('Gerando e salvando…');
            try {
                const { folder, html } = await savePublicBundle();
                $('#pubPreview').srcdoc = html;
                status(`Salvo em “${folder}/” (index.html + css/ + img/).`);
                toast(`Página salva em “${folder}/” — pronta para publicar.`, 'ok');
            } catch (e) { status(''); toast('Falha ao salvar: ' + e.message, 'erro'); }
        });
        $('#btnPubDownload').addEventListener('click', async () => {
            status('Gerando arquivo…');
            try {
                // Com diretório configurado, também deixa a versão pronta para
                // hospedar salva em "Publicação para Web" — o download em si
                // continua sendo sempre o HTML autossuficiente (para poder
                // sair da pasta sem quebrar link nenhum).
                let folder = null;
                if (Storage.hasDirectory()) { ({ folder } = await savePublicBundle()); }
                const html = await generatePublicHtml();
                $('#pubPreview').srcdoc = html;
                const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
                const safe = (nome && nome.titulo ? nome.titulo : 'curriculo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').toLowerCase();
                const blob = new Blob([html], { type: 'text/html' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `curriculo-${safe}.html`; a.click(); URL.revokeObjectURL(a.href);
                status(folder ? `Arquivo baixado — também salvo em “${folder}/”.` : 'Arquivo baixado.');
            } catch (e) { status(''); toast('Falha ao gerar: ' + e.message, 'erro'); }
        });

        // Publicação direta (GitHub/Netlify) — prefill com o que já estiver
        // salvo (o token fica numa chave à parte, nunca no backup — ver
        // deployConfig/saveDeployConfig acima).
        const ghCfg = deployConfig('github');
        $('#ghToken').value = ghCfg.token || '';
        $('#ghOwner').value = ghCfg.owner || '';
        $('#ghRepo').value = ghCfg.repo || '';
        $('#ghBranch').value = ghCfg.branch || '';
        const netlifyCfg = deployConfig('netlify');
        $('#netlifyToken').value = netlifyCfg.token || '';
        $('#netlifySiteId').value = netlifyCfg.siteId || '';

        $('#btnGhSave').addEventListener('click', () => {
            saveDeployConfig('github', {
                token: $('#ghToken').value.trim(), owner: $('#ghOwner').value.trim(),
                repo: $('#ghRepo').value.trim(), branch: $('#ghBranch').value.trim(),
            });
            toast('Configuração do GitHub salva neste navegador.', 'ok');
        });
        $('#btnGhDeploy').addEventListener('click', async () => {
            const ghStatus = (t) => { const el = $('#ghDeployStatus'); if (el) el.textContent = t; };
            const cfg = { token: $('#ghToken').value.trim(), owner: $('#ghOwner').value.trim(), repo: $('#ghRepo').value.trim(), branch: $('#ghBranch').value.trim() };
            saveDeployConfig('github', cfg);
            ghStatus('Gerando página…');
            try {
                const files = await buildDeployFiles();
                ghStatus('Publicando no GitHub…');
                const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
                const titulo = (nome && nome.titulo) ? nome.titulo : 'currículo';
                const { commitUrl, pagesUrl } = await DeployGithub.publish(Object.assign({}, cfg, { files, message: `Publicar ${titulo} — lattesZen` }));
                ghStatus(pagesUrl ? `Publicado — ${pagesUrl}` : `Publicado (commit) — ${commitUrl}`);
                toast('Página publicada no GitHub Pages.', 'ok');
            } catch (e) { ghStatus(''); toast('Falha ao publicar no GitHub: ' + e.message, 'erro'); }
        });

        $('#btnNetlifySave').addEventListener('click', () => {
            saveDeployConfig('netlify', { token: $('#netlifyToken').value.trim(), siteId: $('#netlifySiteId').value.trim() });
            toast('Configuração do Netlify salva neste navegador.', 'ok');
        });
        $('#btnNetlifyCreateSite').addEventListener('click', async () => {
            const netStatus = (t) => { const el = $('#netlifyDeployStatus'); if (el) el.textContent = t; };
            const token = $('#netlifyToken').value.trim();
            if (!token) { toast('Informe o token do Netlify antes de criar o site.', 'aviso'); return; }
            netStatus('Criando site…');
            try {
                const site = await DeployNetlify.createSite(token);
                $('#netlifySiteId').value = site.id;
                saveDeployConfig('netlify', { token, siteId: site.id });
                netStatus(`Site criado — ${site.ssl_url || site.url}`);
                toast('Site do Netlify criado.', 'ok');
            } catch (e) { netStatus(''); toast('Falha ao criar site: ' + e.message, 'erro'); }
        });
        $('#btnNetlifyDeploy').addEventListener('click', async () => {
            const netStatus = (t) => { const el = $('#netlifyDeployStatus'); if (el) el.textContent = t; };
            const cfg = { token: $('#netlifyToken').value.trim(), siteId: $('#netlifySiteId').value.trim() };
            saveDeployConfig('netlify', cfg);
            netStatus('Gerando página…');
            try {
                const files = await buildDeployFiles();
                netStatus('Publicando no Netlify…');
                const { siteUrl } = await DeployNetlify.publish(Object.assign({}, cfg, { files }));
                netStatus(siteUrl ? `Publicado — ${siteUrl}` : 'Publicado.');
                toast('Página publicada no Netlify.', 'ok');
            } catch (e) { netStatus(''); toast('Falha ao publicar no Netlify: ' + e.message, 'erro'); }
        });
    }

    return { render };
})();
