#!/usr/bin/env node
/**
 * serve-pages.js — preview local do pacote do GitHub Pages (Fase 2).
 *
 * Serve o diretório pages-site montado sob um prefixo (padrão /Charles/),
 * reproduzindo como o GitHub Pages serve uma *project page* em
 * https://<usuario>.github.io/Charles/. Assim os caminhos relativos do
 * pacote são validados na mesma topologia da publicação real.
 *
 * Sem dependências externas (só módulos nativos do Node).
 *
 * Uso:
 *   node scripts/serve-pages.js                     # http://localhost:4173/Charles/
 *   node scripts/serve-pages.js --port 8080
 *   node scripts/serve-pages.js --base /            # monta na raiz
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR_PAGINA = path.join(ROOT, 'pages-site');

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function lerArgs() {
  const args = process.argv.slice(2);
  const portIdx = args.indexOf('--port');
  const baseIdx = args.indexOf('--base');
  return {
    porta: portIdx !== -1 && args[portIdx + 1] ? Number(args[portIdx + 1]) : 4173,
    base: baseIdx !== -1 && args[baseIdx + 1] ? String(args[baseIdx + 1]) : '/Charles'
  };
}

function criarServidor(base) {
  return http.createServer((req, res) => {
    let caminho;
    try {
      caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('400 Bad Request');
      return;
    }

    // Montagem sob o prefixo (como o github.io/Charles/)
    if (base !== '/' && (caminho === base || caminho === `${base}/`)) {
      caminho = `${base}/index.html`;
    }
    if (base !== '/' && !caminho.startsWith(`${base}/`)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 — o pacote Pages está montado em "${base}/". Tente ${base}/\n`);
      return;
    }

    const relativo = (base === '/' ? caminho : caminho.slice(base.length + 1)) || 'index.html';
    if (relativo.includes('..')) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('400 Bad Request');
      return;
    }

    const arquivo = path.join(DIR_PAGINA, relativo);
    if (!arquivo.startsWith(DIR_PAGINA) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 — ${relativo} não existe no pacote. Rode: node scripts/build-pages-site.js\n`);
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIMES[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(arquivo).pipe(res);
  });
}

function main() {
  const { porta, base } = lerArgs();
  const baseNormalizada = base === '/' ? '/' : base.replace(/\/+$/, '');

  if (!fs.existsSync(path.join(DIR_PAGINA, 'index.html'))) {
    console.error('❌ pages-site/index.html não encontrado. Rode primeiro: node scripts/build-pages-site.js');
    process.exit(1);
  }

  criarServidor(baseNormalizada).listen(porta, () => {
    console.log('==============================================');
    console.log('  Preview do pacote GitHub Pages (Fase 2)');
    console.log('==============================================');
    console.log(`  Diretório: ${DIR_PAGINA}`);
    console.log(`  Prefixo:   ${baseNormalizada === '/' ? '(raiz)' : baseNormalizada + '/'}`);
    console.log(`  URL:       http://localhost:${porta}${baseNormalizada === '/' ? '/' : baseNormalizada + '/'}`);
    console.log('  Ctrl+C para parar.');
  });
}

main();
