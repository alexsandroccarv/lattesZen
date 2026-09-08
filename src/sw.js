/* ==========================================================================
   lattesZen — Service Worker
   --------------------------------------------------------------------------
   Objetivo: o app funcionar 100% offline depois da primeira visita — tanto
   os arquivos próprios (HTML/CSS/JS) quanto as bibliotecas externas
   (Tailwind, Font Awesome, fonte Rawline), que hoje são sempre buscadas da
   internet e, sem elas, a interface fica sem estilo algum.

   Estratégias:
   - App shell (mesma origem): cache-first, atualizando em segundo plano.
   - CDNs conhecidos: stale-while-revalidate — usa o que já está em cache
     imediatamente e atualiza por trás, assim que a rede responder.

   Aumente CACHE_VERSION sempre que a lista PRECACHE_URLS mudar (arquivo novo
   ou removido) — isso descarta os caches antigos na próxima ativação. TAMBÉM
   aumente quando o CONTEÚDO de um arquivo já precacheado mudar (ex.: um
   arquivo de aba): só um sw.js com bytes diferentes dispara um novo
   install/activate, que é o que faz pwa.js recarregar a aba automaticamente
   (ver js/pwa.js). Sem isso, uma aba já aberta pode continuar servindo JS
   antigo por tempo indefinido mesmo depois de um conserto já publicado.
   ========================================================================== */
const CACHE_VERSION = 'v15';
const PRECACHE = `lattesZen-precache-${CACHE_VERSION}`;
const RUNTIME = `lattesZen-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
    './index.html',
    './doe-um-cafe.html',
    './ajuda.html',
    './ajuda-lattes.html',
    './ajuda-rsc.html',
    './relacionando-lattes-rsc.html',
    './notas-de-versao.html',
    './privacidade.html',
    './termodeuso.html',
    './manifest.json',
    './favicon.svg',
    './css/styles.css',
    './js/config.js',
    './js/analytics.js',
    './js/cookie-consent.js',
    './js/encoding.js',
    './js/areas-conhecimento.js',
    './js/cnae.js',
    './js/paises.js',
    './js/idiomas.js',
    './js/lattes-types.js',
    './js/storage.js',
    './js/lattes-xml.js',
    './js/lattes-xml-export.js',
    './js/bibtex-ris.js',
    './js/publish.js',
    './js/rsc.js',
    './js/docx-export.js',
    './js/gdrive-client.js',
    './js/app-core.js',
    './js/tab-publicar.js',
    './js/tab-inicio.js',
    './js/tab-rsc.js',
    './js/tab-conformidade.js',
    './js/tab-linha-tempo.js',
    './js/tab-catalogar.js',
    './js/tab-config.js',
    './js/app.js',
    './js/pwa.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(PRECACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// CDNs externos usados pelo app (Tailwind, Font Awesome + fontes, Rawline).
// Requisições de <script>/<link>/@font-face para esses hosts costumam vir
// como resposta "opaque" (status 0) por não terem `crossorigin` — por isso
// o cache aceita status 200 OU opaque, não só 200.
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'cdngovbr-ds.estaleiro.serpro.gov.br'];

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(
            caches.open(RUNTIME).then((cache) => cache.match(req).then((cached) => {
                const network = fetch(req).then((res) => {
                    if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
                    return res;
                }).catch(() => cached);
                return cached || network;
            }))
        );
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(req).then((cached) => {
                const network = fetch(req).then((res) => {
                    if (res && res.status === 200) caches.open(PRECACHE).then((cache) => cache.put(req, res.clone()));
                    return res;
                }).catch(() => cached);
                return cached || network;
            })
        );
    }
});
