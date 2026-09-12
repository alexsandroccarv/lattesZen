/* ==========================================================================
   lattesZen — Aviso de cookies (consentimento obrigatório para o Google
   Analytics)
   --------------------------------------------------------------------------
   Só aparece quando js/analytics.js reporta um ID de mensuração real
   configurado e o usuário ainda não aceitou. Enquanto não aceitar, um
   overlay cobre a página inteira e bloqueia qualquer interação com o app —
   não existe botão "Recusar": ou aceita, ou fica travado (o Analytics só
   é opcional para quem administra a instância, apagando o ID de
   config.js — não para quem já está usando uma instância com ID
   configurado). Estilo em linha (não depende do Tailwind CDN) pra
   funcionar mesmo se aquele recurso de terceiros não carregar.
   ========================================================================== */
(function () {
    function montar() {
        if (!window.LzAnalytics || !window.LzAnalytics.idConfigurado()) return;
        if (window.LzAnalytics.consentimentoAtual() === 'accepted') return;

        const overlay = document.createElement('div');
        overlay.id = 'lzCookieOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(7,29,65,.6)';

        const barra = document.createElement('div');
        barra.id = 'lzCookieBanner';
        barra.setAttribute('role', 'alertdialog');
        barra.setAttribute('aria-modal', 'true');
        barra.setAttribute('aria-label', 'Aviso de cookies');
        barra.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#071D41;'
            + 'color:#fff;padding:16px 20px;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;'
            + 'justify-content:center;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
            + 'box-shadow:0 -2px 10px rgba(0,0,0,.25)';

        const texto = document.createElement('p');
        texto.style.cssText = 'margin:0;max-width:640px;flex:1 1 320px';
        texto.innerHTML = 'Usamos o Google Analytics para entender o acesso a este site (não inclui o conteúdo '
            + 'do seu currículo, que fica só no seu navegador). '
            + '<a href="privacidade.html" style="color:#ADCDFF;text-decoration:underline" target="_blank" rel="noopener">'
            + 'Saiba mais na Política de Privacidade</a>.';

        const btnAceitar = document.createElement('button');
        btnAceitar.type = 'button';
        btnAceitar.id = 'lzCookieAceitar';
        btnAceitar.textContent = 'Aceitar';
        btnAceitar.style.cssText = 'background:#1351B4;color:#fff;border:1px solid #1351B4;border-radius:6px;'
            + 'padding:8px 18px;cursor:pointer;font:inherit;font-weight:600;flex:0 0 auto';

        // Trava o scroll do documento por trás do overlay enquanto a decisão
        // não é tomada — sem isto, roda do mouse ainda passaria por baixo.
        const overflowAnterior = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';

        btnAceitar.addEventListener('click', () => {
            window.LzAnalytics.aceitar();
            document.documentElement.style.overflow = overflowAnterior;
            overlay.remove();
            barra.remove();
        });

        barra.appendChild(texto);
        barra.appendChild(btnAceitar);
        document.body.appendChild(overlay);
        document.body.appendChild(barra);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', montar);
    } else {
        montar();
    }
})();
