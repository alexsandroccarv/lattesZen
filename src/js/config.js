/* ==========================================================================
   lattesZen — Configuração global da aplicação
   ========================================================================== */
window.APP_CONFIG = {
    name: 'lattesZen',
    // Versionamento: <versão>.<marco do projeto>.<contador de issues fechadas>.
    // Os dois primeiros números são atualizados manualmente; o terceiro (2
    // dígitos) é incrementado a cada issue fechada no GitHub — ver política
    // completa em CLAUDE.md e o histórico em notas-de-versao.html.
    version: 'v0.7.05',
    lastModified: '07/09/2026',
    author: {
        nome: 'Alexsandro Cardoso Carvalho',
        github: 'https://github.com/alexsandroccarv',
    },
    repo: 'https://github.com/alexsandroccarv/lattesZen',
    license: {
        nome: 'AGPLv3',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
    },
    // Chaves de armazenamento local
    storageKeys: {
        catalog: 'lz_catalog',       // índice de itens (backup em localStorage)
        trash: 'lz_trash',           // itens excluídos, aguardando restauração ou purga
        settings: 'lz_settings',     // preferências gerais
        theme: 'tema',
        highContrast: 'altoContraste',
    },
    // Google Drive (armazenamento remoto opcional, alternativo à pasta local).
    // Client ID OAuth do Google Cloud Console — não é segredo, pode ficar aqui
    // (é assim que funciona OAuth para apps sem backend). Passo a passo pra
    // gerar o seu:
    //   1. https://console.cloud.google.com/ → crie um projeto (ou reaproveite um).
    //   2. "APIs e serviços" → "Biblioteca" → habilite a "Google Drive API".
    //   3. "APIs e serviços" → "Tela de consentimento OAuth" → tipo "Externo";
    //      preencha nome do app e e-mail de suporte; em "Escopos", adicione
    //      https://www.googleapis.com/auth/drive.file (escopo não-sensível —
    //      só exige verificação básica do Google se passar de 100 usuários de
    //      teste, não a avaliação de segurança pesada dos escopos restritos).
    //   4. "Credenciais" → "Criar credenciais" → "ID do cliente OAuth" → tipo
    //      "Aplicativo da Web"; em "Origens JavaScript autorizadas", adicione
    //      o domínio onde o lattesZen está publicado (ex.: https://seusite.com)
    //      e, se for testar localmente, http://localhost:PORTA.
    //   5. Copie o "Client ID" gerado (algo como "123...-abc....apps.googleusercontent.com")
    //      e cole abaixo. Não precisa do "Client Secret" — este app não usa
    //      backend, a autenticação é toda feita do navegador direto pro Google.
    // Enquanto ficar vazio, a seção "Google Drive" em Configurações aparece
    // desabilitada com um aviso, em vez de quebrar.
    googleDriveClientId: (typeof window !== 'undefined' && window.__LZ_TEST_GDRIVE_CLIENT_ID) || '653369043379-2mrkj5f2le78r11v5np9eev9i0k5hm5v.apps.googleusercontent.com',
    // Google Analytics (GA4) — opcional, desligado por padrão. Passo a passo
    // pra gerar o seu ID de mensuração:
    //   1. https://analytics.google.com/ → Administrador → "Criar propriedade".
    //   2. Preencha nome da propriedade, fuso horário e moeda; em "Detalhes do
    //      negócio", categoria e tamanho não importam muito pra um site pessoal.
    //   3. Em "Fluxo de dados" → "Web", informe a URL onde o lattesZen está
    //      publicado (ex.: https://seusite.com) e um nome pro fluxo.
    //   4. O painel do fluxo mostra o "ID de mensuração" no formato
    //      "G-XXXXXXXXXX" — copie e cole abaixo.
    // Enquanto ficar com o valor de exemplo "G-XXXXXXXXXX" (ou vazio),
    // js/analytics.js não carrega nada — nenhum tráfego é enviado ao Google
    // até você colar o ID real da sua propriedade. Com um ID real configurado
    // (como abaixo), o carregamento ainda depende do aviso de cookies (ver
    // js/cookie-consent.js): só roda se o visitante clicar em "Aceitar".
    analyticsId: (typeof window !== 'undefined' && window.__LZ_TEST_ANALYTICS_ID) || 'G-M4MZYCQEQK',
};
