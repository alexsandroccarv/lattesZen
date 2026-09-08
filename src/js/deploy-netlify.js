/* ==========================================================================
   lattesZen — Cliente Netlify (REST + "digest deploy", sem backend)
   --------------------------------------------------------------------------
   Mesmo racional do deploy-github.js: sem backend pra guardar um
   client_secret, não dá pra fazer OAuth "de verdade" com o Netlify — o
   usuário cola um token de acesso pessoal (Netlify → User settings →
   Applications → New access token) e o app publica direto pela API REST.

   Usa o método de "digest deploy" (hash SHA-1 de cada arquivo, só envia o
   conteúdo dos que o Netlify ainda não tem em cache) em vez de montar um
   .zip no navegador — mais simples e sem depender de nenhuma lib externa.
   ========================================================================== */
window.DeployNetlify = (function () {
    const BASE = 'https://api.netlify.com/api/v1';

    async function req(token, method, path, opts) {
        opts = opts || {};
        let resp;
        try {
            resp = await fetch(`${BASE}${path}`, {
                method,
                headers: Object.assign({ Authorization: `Bearer ${token}` }, opts.headers || {}),
                body: opts.body,
            });
        } catch (e) {
            const err = new Error('Não foi possível conectar ao Netlify — verifique sua conexão.');
            err.isNetworkError = true;
            throw err;
        }
        if (opts.okStatuses && opts.okStatuses.includes(resp.status)) return resp;
        if (!resp.ok) {
            let msg = `Netlify: HTTP ${resp.status}`;
            try { const j = await resp.json(); if (j && j.message) msg += ` — ${j.message}`; } catch (_) {}
            const err = new Error(msg);
            err.status = resp.status;
            throw err;
        }
        return resp;
    }

    async function toBytes(content) {
        if (typeof content === 'string') return new TextEncoder().encode(content);
        const buf = content instanceof ArrayBuffer ? content : await content.arrayBuffer();
        return new Uint8Array(buf);
    }
    async function sha1Hex(bytes) {
        const digest = await crypto.subtle.digest('SHA-1', bytes);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Caminho pro endpoint de upload — sem a barra inicial duplicada
    // ("/deploys/{id}/files" + "/index.html", não "//index.html").
    function uploadPath(path) {
        return String(path).replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
    }

    async function createSite(token, name) {
        const resp = await req(token, 'POST', '/sites', {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(name ? { name } : {}),
            okStatuses: [200, 201],
        });
        return resp.json(); // { id, name, url, ssl_url, ... }
    }

    async function getSite(token, siteId) {
        const resp = await req(token, 'GET', `/sites/${encodeURIComponent(siteId)}`, { okStatuses: [200, 404] });
        if (resp.status === 404) throw new Error('Site do Netlify não encontrado (ou o token não tem acesso a ele).');
        return resp.json();
    }

    // Publica `files` (array de {path, content}, content string ou Blob/File;
    // path com "/" inicial, ex.: "/index.html") como um novo deploy do site.
    async function publish({ token, siteId, files }) {
        if (!token) throw new Error('Informe um token de acesso do Netlify.');
        if (!siteId) throw new Error('Informe o ID do site do Netlify (ou crie um).');
        if (!files || !files.length) throw new Error('Nada para publicar.');

        const bytesByPath = new Map();
        const digestFiles = {};
        for (const f of files) {
            const path = f.path.indexOf('/') === 0 ? f.path : `/${f.path}`;
            const bytes = await toBytes(f.content);
            bytesByPath.set(path, bytes);
            digestFiles[path] = await sha1Hex(bytes);
        }

        const deployResp = await req(token, 'POST', `/sites/${encodeURIComponent(siteId)}/deploys`, {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: digestFiles }),
            okStatuses: [200, 201],
        });
        const deploy = await deployResp.json();

        const required = new Set(deploy.required || []);
        for (const [path, hash] of Object.entries(digestFiles)) {
            if (!required.has(hash)) continue; // já em cache no Netlify — não precisa reenviar
            await req(token, 'PUT', `/deploys/${deploy.id}/files/${uploadPath(path)}`, {
                headers: { 'Content-Type': 'application/octet-stream' },
                body: bytesByPath.get(path),
                okStatuses: [200],
            });
        }

        // Poll curto (melhor esforço) até o deploy processar — não é
        // essencial (o deploy já foi aceito), só deixa o status mais preciso.
        let final = deploy;
        for (let i = 0; i < 10 && final.state !== 'ready' && final.state !== 'current'; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            try {
                const st = await req(token, 'GET', `/deploys/${deploy.id}`, { okStatuses: [200] });
                final = await st.json();
            } catch (_) { break; }
        }

        return { deployId: deploy.id, deployUrl: final.deploy_ssl_url || final.deploy_url || null, siteUrl: final.ssl_url || final.url || null };
    }

    return { createSite, getSite, publish };
})();
