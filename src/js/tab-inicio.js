/* ==========================================================================
   lattesZen — Aba Início (tela de apresentação/onboarding)
   --------------------------------------------------------------------------
   Segunda aba extraída de app.js para seu próprio módulo (ver issue de
   refatoração) — mesmo padrão de tab-publicar.js. `AppCore.switchTab` é lido
   em tempo de clique (nunca desestruturado no topo do arquivo): quem
   define switchTab de fato é app.js, que carrega DEPOIS deste módulo — na
   hora em que o usuário clica, porém, app.js já rodou e publicou a função.
   ========================================================================== */
window.TabInicio = (function () {
    const { $ } = window.AppCore;

    // Ícone "enso" (círculo zen desenhado à mão, com uma abertura) — puramente
    // vetorial/inline para manter a página leve (sem depender de imagem externa).
    function ensoSvg(cls) {
        return `
            <svg viewBox="0 0 200 200" class="${cls}" aria-hidden="true">
                <circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" stroke-width="11"
                        stroke-linecap="round" stroke-dasharray="440 46" transform="rotate(-100 100 100)" opacity="0.9"/>
            </svg>`;
    }
    function irParaConfigSecao(id) {
        window.AppCore.switchTab('config');
        const sec = $('#' + id);
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function render() {
        const panel = $('#tab-inicio');
        panel.innerHTML = `
            <div class="space-y-6 max-w-4xl">
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col md:flex-row items-center gap-6">
                    ${ensoSvg('w-32 h-32 md:w-44 md:h-44 shrink-0 text-govbr-600 dark:text-unifesp-400')}
                    <div class="text-center md:text-left">
                        <h2 class="text-2xl font-bold mb-1">lattesZen</h2>
                        <p class="text-govbr-700 dark:text-unifesp-400 font-semibold mb-3">descomplicando a vida acadêmica.</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            O lattesZen organiza seu currículo acadêmico — formação, produções, atuação, projetos, eventos e muito mais —
                            num só lugar, no seu computador, com as evidências (PDFs) já guardadas junto de cada item. A partir dessa base
                            você verifica o que falta para ficar em conformidade com o Lattes, monta o dossiê de RSC-PCCTAE
                            e publica uma página do currículo na web — tudo sem depender de servidor.
                        </p>
                    </div>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-3 flex items-center gap-2"><i class="fa-solid fa-heart-pulse text-govbr-600 dark:text-unifesp-400"></i> Que dores o lattesZen busca resolver</h2>
                    <div class="grid sm:grid-cols-2 gap-3 text-sm">
                        <div class="flex gap-2"><i class="fa-solid fa-rotate text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>Chega de retrabalho:</strong> cadastre uma vez e reaproveite — gere a página pública do currículo a partir da mesma base usada em tudo o mais.</span></div>
                        <div class="flex gap-2"><i class="fa-solid fa-paperclip text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>Evidências organizadas:</strong> cada item guarda seu comprovante (PDF) já na pasta certa — nada de procurar arquivo solto na hora de comprovar algo.</span></div>
                        <div class="flex gap-2"><i class="fa-solid fa-clipboard-check text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>Conformidade visível:</strong> ícones mostram, item a item, o que falta (carga horária, descrição, prazos) — sem caçar campo por campo.</span></div>
                        <div class="flex gap-2"><i class="fa-solid fa-award text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>RSC sem planilha:</strong> simulador de pontuação e memorial descritivo do RSC-PCCTAE prontos a partir dos itens já cadastrados.</span></div>
                        <div class="flex gap-2"><i class="fa-solid fa-lock text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>Foco na privacidade:</strong> todo processamento ocorre localmente, no seu navegador — seus dados não saem do seu computador.</span></div>
                    </div>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-scale-balanced text-govbr-600 dark:text-unifesp-400"></i> Software livre e em desenvolvimento</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        O lattesZen é <strong>software livre</strong> (licença <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener" class="underline">AGPLv3</a>) —
                        o código é aberto: qualquer pessoa pode ler, usar, modificar e redistribuir. Ele ainda está <strong>em desenvolvimento</strong>: pode ter
                        erros, mudar de comportamento, ganhar e perder funcionalidades de uma hora para outra. Faça backups com frequência
                        (Configurações &rarr; Backup) e não deixe de <strong>reportar</strong> o que encontrar.
                    </p>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-3 flex items-center gap-2"><i class="fa-solid fa-quote-left text-govbr-600 dark:text-unifesp-400"></i> Como citar</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Se o lattesZen te ajudou numa pesquisa ou trabalho acadêmico, considere citá-lo:</p>
                    <blockquote class="text-sm border-l-4 border-govbr-300 dark:border-unifesp-700 pl-3 py-1.5 bg-white dark:bg-gray-900 rounded-r">
                        CARVALHO, Alexsandro Cardoso. <em>LattesZen: descomplicando o currículo Acadêmico</em>. Versão 0.7.02. Santos: Github, 2016. DOI: <a href="https://zenodo.org/records/22346453" target="_blank" rel="noopener" class="underline">https://zenodo.org/records/22346453</a>.
                    </blockquote>
                    <button type="button" id="btnCopiarCitacao" class="mt-2 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs hover:border-govbr-500 dark:hover:border-unifesp-400">
                        <i aria-hidden="true" class="fa-solid fa-copy mr-1"></i> Copiar citação
                    </button>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-3 flex items-center gap-2"><i class="fa-solid fa-hands-holding-circle text-govbr-600 dark:text-unifesp-400"></i> Como colaborar</h2>
                    <div class="grid sm:grid-cols-2 gap-3 text-sm">
                        <a href="https://github.com/alexsandroccarv/lattesZen/issues" target="_blank" rel="noopener" class="flex gap-2 hover:text-govbr-700 dark:hover:text-unifesp-400">
                            <i class="fa-solid fa-bug text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>Reportando bugs:</strong> abra uma issue no repositório contando o que aconteceu.</span>
                        </a>
                        <a href="https://github.com/alexsandroccarv/lattesZen/issues" target="_blank" rel="noopener" class="flex gap-2 hover:text-govbr-700 dark:hover:text-unifesp-400">
                            <i class="fa-solid fa-lightbulb text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>Solicitando funcionalidades:</strong> sugestões e ideias também entram como issue.</span>
                        </a>
                        <a href="doe-um-cafe.html" class="flex gap-2 hover:text-govbr-700 dark:hover:text-unifesp-400">
                            <i class="fa-solid fa-mug-hot text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>Doe um café:</strong> ajude com as despesas de infraestrutura do projeto.</span>
                        </a>
                        <div class="flex gap-2">
                            <i class="fa-solid fa-bullhorn text-govbr-600 dark:text-unifesp-400 mt-1"></i><span><strong>E, principalmente: use e comente que usa</strong> — espalhar a palavra é a colaboração mais simples de todas :-)</span>
                        </div>
                    </div>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-3 flex items-center gap-2"><i class="fa-solid fa-shoe-prints text-govbr-600 dark:text-unifesp-400"></i> Primeiros passos</h2>
                    <ol class="space-y-4 text-sm">
                        <li class="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span><strong>1.</strong> Defina o diretório (pasta) onde tudo vai ficar salvo.</span>
                            <button type="button" id="btnInicioDir" class="sm:ml-auto px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm whitespace-nowrap"><i class="fa-solid fa-folder mr-1"></i> Ir para Configurações</button>
                        </li>
                        <li class="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span><strong>2.</strong> Use <strong>Catalogar</strong> para incluir itens, ou importe o XML do Lattes.</span>
                            <div class="sm:ml-auto flex gap-2 flex-wrap">
                                <button type="button" id="btnInicioCatalogar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm whitespace-nowrap"><i class="fa-solid fa-file-circle-plus mr-1"></i> Ir para Catalogar</button>
                                <button type="button" id="btnInicioImportar" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm whitespace-nowrap"><i class="fa-solid fa-file-import mr-1"></i> Importar XML do Lattes</button>
                            </div>
                        </li>
                    </ol>
                </section>
            </div>`;
        $('#btnInicioDir').addEventListener('click', () => irParaConfigSecao('dirSection'));
        $('#btnInicioCatalogar').addEventListener('click', () => window.AppCore.switchTab('catalogar'));
        $('#btnInicioImportar').addEventListener('click', () => irParaConfigSecao('importXmlSection'));

        const btnCitacao = $('#btnCopiarCitacao');
        if (btnCitacao) btnCitacao.addEventListener('click', () => {
            const texto = 'CARVALHO, Alexsandro Cardoso. LattesZen: descomplicando o currículo Acadêmico. Versão 0.7.02. Santos: Github, 2016. DOI: https://zenodo.org/records/22346453.';
            navigator.clipboard.writeText(texto).then(() => {
                const original = btnCitacao.innerHTML;
                btnCitacao.innerHTML = '<i aria-hidden="true" class="fa-solid fa-check mr-1"></i> Copiado!';
                setTimeout(() => { btnCitacao.innerHTML = original; }, 1800);
            });
        });
    }

    return { render };
})();
