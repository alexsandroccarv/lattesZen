/* ==========================================================================
   lattesZen — núcleo compartilhado entre app.js e os módulos de aba
   --------------------------------------------------------------------------
   Ainda embrionário (ver issue de refatoração de app.js): por enquanto só
   expõe o que o primeiro módulo de aba extraído (tab-publicar.js) precisa —
   o `state` (mutável, compartilhado por referência: qualquer alteração feita
   de um lado aparece do outro) e um punhado de utilidades sem estado próprio.
   Conforme mais abas forem extraídas de app.js, mais deve entrar aqui.
   ========================================================================== */
window.AppCore = (function () {
    /* ----------------------------- Estado ------------------------------- */
    const state = {
        items: [],          // catálogo
        trash: [],          // itens excluídos (lixeira), aguardando restauração ou purga
        editingId: null,    // item em edição
        evEditing: [],      // evidências do item em edição (array de trabalho)
        lattesParsed: null, // resultado do parse do XML
        orcidParsed: null,  // resultado da busca de publicações no ORCID
        bibParsed: null,    // resultado do parse de um arquivo BibTeX/RIS
        currentPdfUrl: null,// URL (blob) do PDF exibido no painel lateral
        sortOrder: 'desc',  // ordenação por ano na Conformidade
        viewFilter: 'todos',// recorte da lista (todos/comprovados/semPdf/naoLattes/descObrig)
        formDirty: false,   // há edições não salvas no formulário de Catalogar?
        saveAndNew: false,  // flag do botão "Salvar e novo"
        saveAndNext: false, // flag do botão "Salvar e próximo"
        activeTab: 'inicio',
        lastCat: '', lastType: '', // última categoria/tipo usados (agiliza cadastro em série)
        vocab: {},          // listas curadas de autocomplete (por chave de campo)
        idPrefix: 'lz',     // prefixo do ID dos arquivos (configurável, até 3 chars)
        rscEnabled: false,  // módulo RSC-PCCTAE habilitado?
        rscCfg: {},         // dados funcionais do servidor (cargo, escolaridade, etc.)
        rscMemorialTexto: '', // texto final do memorial (gerado por IA ou editado manualmente)
        nuvemExclusao: [],  // Linha do tempo: palavras que nunca devem aparecer na nuvem
        nuvemCompostas: [], // Linha do tempo: termos de mais de uma palavra tratados como um só (ex.: "tech talks")
        dirHealth: null,    // último resultado de Storage.checkHealth() (null = sem pasta/não verificado)
    };

    /* --------------------------- Utilidades ----------------------------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function toast(msg, type = 'info') {
        const colors = {
            info: 'bg-govbr-600 dark:bg-unifesp-700',
            ok: 'bg-green-600', erro: 'bg-red-600', aviso: 'bg-amber-600',
        };
        const el = document.createElement('div');
        el.className = `${colors[type] || colors.info} text-white text-sm px-4 py-2 rounded shadow-lg max-w-xs`;
        el.textContent = msg;
        $('#toasts').appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 3200);
        setTimeout(() => el.remove(), 3700);
    }

    // Abre, numa nova aba, a pasta do Google Drive correspondente a um
    // subdiretório do armazenamento (usado pelos botões "Abrir no Google
    // Drive" nos locais onde é possível enviar arquivos). Avisa por toast se
    // a pasta ainda não existir (nada foi enviado ali ainda).
    async function openGDriveFolder(subdir) {
        const url = await window.Storage.gdriveFolderUrl(subdir);
        if (url) window.open(url, '_blank', 'noopener');
        else toast('Pasta ainda não existe no Google Drive — envie um arquivo primeiro.', 'aviso');
    }

    // Extrai o ANO de um campo de data completa (dd/mm/aaaa, mm/aaaa ou aaaa).
    // Usado em toda parte que precisa só do ano (dedup, ordenação, RSC) — o
    // valor guardado pode ter dia/mês, mas eles nunca vão para o XML Lattes.
    function anoDe(v) { const m = String(v == null ? '' : v).match(/\d{4}/); return m ? m[0] : ''; }
    function isImageExt(ext) { return /^(jpe?g|png|gif|webp)$/i.test(ext || ''); }
    function isVideoExt(ext) { return /^(mp4|webm|mov|avi|mkv)$/i.test(ext || ''); }
    function isArchiveExt(ext) { return /^(zip|tar|gz|tgz)$/i.test(ext || ''); }
    // Valor sentinela "Não se aplica" (campos URL): conta como preenchido na
    // conformidade, mas na futura exportação XML do Lattes deve ir EM BRANCO.
    const NA_VALUE = 'Não se aplica';
    function itemYear(i) {
        const y = (i.fields && (i.fields.ano || i.fields.anoFim || i.fields.anoInicio)) || '';
        const n = parseInt(anoDe(y), 10);
        return isNaN(n) ? null : n;
    }
    function sortByYear(items, asc) {
        return items.slice().sort((a, b) => {
            const ya = itemYear(a), yb = itemYear(b);
            if (ya !== yb) {
                if (ya == null) return 1;              // sem ano vai para o fim
                if (yb == null) return -1;
                return asc ? ya - yb : yb - ya;
            }
            return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        });
    }
    // "Publicar na Web" desmarcado no item: item some da página pública,
    // independente das opções de Lattes (Exportar/Visibilidade) — usado tanto
    // pelos filtros da Conformidade quanto pela geração da página pública.
    const publicarWebOk = (it) => !(it.visibilidade && it.visibilidade.publicarWeb === false);

    // Categorias 12–19 ("Além do Lattes") e tipos/categorias não-Lattes nunca
    // entram na exportação XML do Lattes — usado tanto pelo formulário
    // (bloco de Visibilidade) quanto pelos filtros da Conformidade.
    function elegivelAoLattes(typeKey, catKey) {
        if (!typeKey) return false;
        if (LattesTypes.isNaoLattesType(typeKey) || LattesTypes.isNaoLattesCategory(catKey)) return false;
        const cat = LattesTypes.categoryByKey(catKey);
        const catNum = cat ? parseInt(cat.num, 10) : NaN;
        if (catNum >= 12 && catNum <= 19) return false;
        return true;
    }
    // Itens do catálogo que usam exatamente `value` no campo `key`.
    function itemsUsingValue(key, value) {
        const v = String(value == null ? '' : value).trim();
        if (!v) return [];
        if (key === 'evidenciaTag') return state.items.filter(i => (i.evidencias || []).some(e => String(e.tag == null ? '' : e.tag).trim() === v));
        return state.items.filter(i => i.fields && String(i.fields[key] == null ? '' : i.fields[key]).trim() === v);
    }

    // Normaliza um nome para comparação (sem acentos, maiúsculas, espaços)
    function normNome(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
    }

    /* --------- Validação de ISSN / ISBN (com dígito verificador) --------- */
    // Retorna { ok, value?, msg? }. Vazio é considerado válido (campos opcionais).
    function validateISSN(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.toUpperCase().replace(/[\s-]/g, '');
        if (!/^\d{7}[\dX]$/.test(d)) return { ok: false, msg: 'ISSN inválido — use 8 dígitos no formato NNNN-NNNC (ex.: 0378-5955).' };
        let sum = 0; for (let i = 0; i < 7; i++) sum += (8 - i) * Number(d[i]);
        const chk = d[7] === 'X' ? 10 : Number(d[7]);
        if (((11 - (sum % 11)) % 11) !== chk) return { ok: false, msg: 'ISSN inválido — dígito verificador não confere.' };
        return { ok: true, value: d.slice(0, 4) + '-' + d.slice(4) };
    }
    function validateISBN(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.toUpperCase().replace(/[\s-]/g, '');
        if (/^\d{9}[\dX]$/.test(d)) { // ISBN-10
            let sum = 0; for (let i = 0; i < 10; i++) sum += (d[i] === 'X' ? 10 : Number(d[i])) * (10 - i);
            if (sum % 11 !== 0) return { ok: false, msg: 'ISBN-10 inválido — dígito verificador não confere.' };
            return { ok: true, value: s }; // preserva a hifenização do usuário
        }
        if (/^\d{13}$/.test(d)) { // ISBN-13 (EAN)
            let sum = 0; for (let i = 0; i < 13; i++) sum += Number(d[i]) * (i % 2 ? 3 : 1);
            if (sum % 10 !== 0) return { ok: false, msg: 'ISBN-13 inválido — dígito verificador não confere.' };
            return { ok: true, value: s }; // preserva a hifenização do usuário
        }
        return { ok: false, msg: 'ISBN inválido — informe 10 ou 13 dígitos.' };
    }
    // Anais de eventos: aceita ISBN (10/13 dígitos) OU ISSN (8 dígitos) no mesmo campo.
    function validateISBNorISSN(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.toUpperCase().replace(/[\s-]/g, '');
        if (/^\d{7}[\dX]$/.test(d)) return validateISSN(v);
        return validateISBN(v);
    }
    // DOI: aceita o identificador puro ou colado como URL do resolver; normaliza p/ puro.
    function validateDOI(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.replace(/^\s*(https?:\/\/)?(dx\.)?doi\.org\//i, '').trim();
        if (/^10\.\d{4,9}\/\S+$/.test(d)) return { ok: true, value: d };
        return { ok: false, msg: 'DOI inválido — formato esperado 10.xxxx/sufixo (ex.: 10.1000/xyz123).' };
    }
    // URL: adiciona o esquema https:// quando ausente; se o usuário já
    // escreveu um esquema (http://, ftp://, magnet:, mailto:, etc.), respeita
    // como está — não força https:// por cima nem restringe a http(s). Um
    // "esquema" de 1-2 letras (ex.: "C:\...") quase sempre é um caminho de
    // arquivo do Windows colado por engano, não uma URL de verdade — nesse
    // caso também assume https://, pra não aceitar isso como se fosse válido.
    function validateURL(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const temEsquema = /^[a-z][a-z0-9+.-]{2,}:/i.test(s);
        const u = temEsquema ? s : 'https://' + s;
        try { new URL(u); return { ok: true, value: u }; }
        catch (_) { return { ok: false, msg: 'URL inválida.' }; }
    }
    // E-mail: regex simples (não valida entrega, só o formato).
    function validateEmail(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, msg: 'E-mail inválido.' };
        return { ok: true, value: s };
    }
    // Data dd/mm/aaaa completa e existente no calendário (usa LzRSC.parseBR).
    // Usado só nos campos de data do módulo RSC que exigem data exata (não
    // aceita mês/ano soltos nem dias inexistentes).
    function validateDataCompleta(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return { ok: false, msg: 'Data incompleta — use o formato dd/mm/aaaa.' };
        if (!window.LzRSC || !window.LzRSC.parseBR(s)) return { ok: false, msg: 'Data inválida.' };
        return { ok: true, value: s };
    }
    // Telefone: exige DDD (2 dígitos), permite DDI opcional na frente (+55, 55...).
    function validateTelefoneDDD(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const re = /^(\+\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}-?\d{4}$/;
        if (!re.test(s)) return { ok: false, msg: 'Telefone inválido — informe com DDD, ex.: (11) 91234-5678 (DDI opcional, ex.: +55).' };
        return { ok: true, value: s };
    }
    function validateField(kind, value) {
        if (kind === 'issn') return validateISSN(value);
        if (kind === 'isbn') return validateISBN(value);
        if (kind === 'isbnIssn') return validateISBNorISSN(value);
        if (kind === 'doi') return validateDOI(value);
        if (kind === 'email') return validateEmail(value);
        if (kind === 'dataCompleta') return validateDataCompleta(value);
        if (kind === 'telefoneDDD') return validateTelefoneDDD(value);
        if (kind === 'url') return validateURL(value);
        return { ok: true, value: value };
    }
    // Feedback visual (borda vermelha + mensagem + aria-invalid)
    function setFieldError(el, msg) {
        el.classList.toggle('border-red-500', !!msg);
        el.classList.toggle('ring-1', !!msg);
        el.classList.toggle('ring-red-500', !!msg);
        el.setAttribute('aria-invalid', msg ? 'true' : 'false');
        let p = el.parentElement.querySelector('.validate-msg');
        if (msg) {
            if (!p) { p = document.createElement('p'); p.className = 'validate-msg text-xs text-red-600 dark:text-red-400 mt-0.5'; el.parentElement.appendChild(p); }
            p.textContent = msg;
        } else if (p) p.remove();
    }
    // Associa <label> aos controles (for/id) e marca aria-required — a11y.
    // Campos agrupados na mesma linha (dynFieldsHtml/`f.row`) ficam num
    // wrapper flex sem <label> próprio — desce um nível para achar cada
    // [data-field] real dentro dele.
    function associateLabels(container) {
        let n = 0;
        const wireOne = (wrap) => {
            const label = wrap.querySelector(':scope > label');
            const ctrl = wrap.querySelector('input, select, textarea');
            if (!label || !ctrl) return;
            if (!ctrl.id) ctrl.id = `fld-${++n}-${ctrl.name || 'x'}`;
            label.setAttribute('for', ctrl.id);
            if (ctrl.required) ctrl.setAttribute('aria-required', 'true');
        };
        container.querySelectorAll(':scope > div').forEach(wrap => {
            if (wrap.hasAttribute('data-field')) { wireOne(wrap); return; }
            wrap.querySelectorAll(':scope > [data-field]').forEach(wireOne);
        });
    }
    // Campo condicionalmente desabilitado (ex.: Título da apresentação some se
    // "Ouvinte"; UF só habilita com País = Brasil) — QUALQUER condição bater
    // já desabilita.
    function isFieldDisabled(f, fields) {
        const c = f && f.disabledWhen;
        if (!c) return false;
        const conds = Array.isArray(c) ? c : [c];
        return conds.some(cond => {
            const v = (fields || {})[cond.field];
            if (cond.equals != null) return v === cond.equals;
            if (Array.isArray(cond.in)) return cond.in.indexOf(v) >= 0;
            if (cond.notEquals != null) return normNome(v) !== normNome(cond.notEquals);
            return false;
        });
    }
    // Número de evidências do item (considera formato legado hasPdf)
    function evCount(item) {
        return Array.isArray(item.evidencias) ? item.evidencias.length : (item.hasPdf ? 1 : 0);
    }
    // Estado de preenchimento da descrição de um item:
    //   'red'   — falta ao menos um campo OBRIGATÓRIO
    //   'amber' — obrigatórios ok, mas falta algum campo OPCIONAL
    //   'green' — todos os campos preenchidos
    function descState(item) {
        const def = LattesTypes.get(item.typeKey);
        if (!def || !def.fields || !def.fields.length) return 'green'; // tipo sem campos
        const vals = item.fields || {};
        const campos = def.fields.filter(f => !isFieldDisabled(f, vals));
        const filled = f => { const v = vals[f.key]; return v != null && String(v).trim() !== ''; };
        if (campos.some(f => f.required && !filled(f))) return 'red';
        if (campos.some(f => !filled(f))) return 'amber';
        return 'green';
    }

    return {
        state, $, $$, esc, toast, openGDriveFolder, anoDe, isImageExt, isVideoExt, isArchiveExt, NA_VALUE, itemYear, sortByYear, publicarWebOk,
        elegivelAoLattes, itemsUsingValue, normNome,
        validateISSN, validateISBN, validateISBNorISSN, validateDOI, validateURL, validateField,
        setFieldError, associateLabels, isFieldDisabled, evCount, descState,
    };
})();
