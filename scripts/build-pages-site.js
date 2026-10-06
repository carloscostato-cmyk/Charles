#!/usr/bin/env node
/**
 * build-pages-site.js — Fase 2 do Famps (Route A+)
 *
 * Gera o pacote estático do demo "Data Center SD + Charles" para o
 * GitHub Pages, a partir das mesmas fontes usadas pelo servidor Express:
 *
 *   index-datacenter.html     -> index.html (caminhos relativos + mock injetado)
 *   frontend/css/             -> css/
 *   frontend/js/              -> js/  (inclui pages-mock.js)
 *   assets/ + frontend/assets/ -> assets/ (merge)
 *   FQ_DATA_CENTER.xls        -> data/faqs.js  (embed client-side)
 *                                data/faqs.json (canônico, inspeção)
 *   (arquivo vazio)           -> .nojekyll
 *
 * O HTML original NUNCA é alterado — o Express continua servindo
 * /sharepoint com caminhos absolutos exatamente como antes.
 *
 * Uso:
 *   node scripts/build-pages-site.js               # gera ./pages-site
 *   node scripts/build-pages-site.js --out /tmp/x  # destino alternativo
 *   node scripts/build-pages-site.js --quiet       # sem resumo
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'pages-site');
const FAQ_ESPERADA = 159;

/** Copia um diretório inteiro de forma recursiva. */
function copiarDiretorio(origem, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const entry of fs.readdirSync(origem, { withFileTypes: true })) {
    const de = path.join(origem, entry.name);
    const para = path.join(destino, entry.name);
    if (entry.isDirectory()) copiarDiretorio(de, para);
    else fs.copyFileSync(de, para);
  }
}

/** Lista todos os arquivos da árvore (relativos, ordenados, p/ resumo). */
function listarArquivos(dir, base = dir) {
  const arquivos = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) arquivos.push(...listarArquivos(abs, base));
    else arquivos.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return arquivos.sort();
}

/**
 * Constrói o pacote estático.
 * @param {{out?: string, quiet?: boolean}} [opcoes]
 * @returns {{out: string, totalFaq: number, arquivos: string[]}}
 */
function buildPagesSite(opcoes = {}) {
  const out = path.resolve(opcoes.out || DEFAULT_OUT);
  const quiet = Boolean(opcoes.quiet);

  const fontes = {
    html: path.join(ROOT, 'index-datacenter.html'),
    css: path.join(ROOT, 'frontend', 'css'),
    js: path.join(ROOT, 'frontend', 'js'),
    assets: [path.join(ROOT, 'assets'), path.join(ROOT, 'frontend', 'assets')],
    mock: path.join(ROOT, 'frontend', 'js', 'pages-mock.js'),
    faqReader: path.join(ROOT, 'backend', 'faq-reader.js')
  };

  const obrigatorias = [
    ['index-datacenter.html', fontes.html],
    ['frontend/css', fontes.css],
    ['frontend/js', fontes.js],
    ['frontend/js/pages-mock.js', fontes.mock]
  ];
  for (const [nome, caminho] of obrigatorias) {
    if (!fs.existsSync(caminho)) {
      throw new Error(`Fonte obrigatória ausente: ${nome}`);
    }
  }

  // 1. Limpa e cria o diretório de saída
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // 2. HTML: caminhos absolutos -> relativos + injeção da camada de mock
  let html = fs.readFileSync(fontes.html, 'utf8');
  html = html
    .replace(/href="\/css\//g, 'href="./css/')
    .replace(/src="\/js\//g, 'src="./js/')
    .replace(/src="\/assets\//g, 'src="./assets/');

  const restos = html.match(/(?:href|src)="\//g);
  if (restos) {
    throw new Error(`HTML ainda contém ${restos.length} caminho(s) absoluto(s): ${restos.join(', ')}`);
  }

  const ancora = '<script src="./js/api-client.js"></script>';
  const ocorrencias = html.split(ancora).length - 1;
  if (ocorrencias !== 1) {
    throw new Error(`Âncora de injeção esperada 1x, encontrada ${ocorrencias}x: ${ancora}`);
  }
  html = html.replace(ancora, [
    '  <!-- ===== Demo estático GitHub Pages (Fase 2 do Famps): FAQ embutida + mock da API ===== -->',
    '  <script src="./data/faqs.js"></script>',
    '  <script>window.__CHARLES_PAGES__ = true;</script>',
    '  <script src="./js/pages-mock.js"></script>',
    ancora
  ].join('\n  '));

  fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8');

  // 3. CSS / JS / assets
  copiarDiretorio(fontes.css, path.join(out, 'css'));
  copiarDiretorio(fontes.js, path.join(out, 'js'));
  for (const dir of fontes.assets) {
    if (fs.existsSync(dir)) copiarDiretorio(dir, path.join(out, 'assets'));
  }

  // 4. FAQ embutida (mesma leitura do backend -> paridade de contrato)
  const { lerFAQ } = require(fontes.faqReader);
  const faq = lerFAQ();
  if (faq.length === 0) {
    throw new Error('FQ_DATA_CENTER.xls devolveu 0 FAQs — verifique o arquivo na raiz do repo.');
  }
  if (faq.length !== FAQ_ESPERADA) {
    console.warn(`⚠️  Esperado ${FAQ_ESPERADA} FAQs, encontrado ${faq.length} — se a planilha mudou, atualize o contrato no teste.`);
  }

  const dados = faq.map((item, index) => ({
    id: index + 1,
    pergunta: item.pergunta,
    resposta: item.resposta
  }));
  const meta = {
    origem: 'FQ_DATA_CENTER.xls',
    total: dados.length,
    geradoEm: new Date().toISOString(),
    consumidoPor: 'frontend/js/pages-mock.js (window.CHARLES_FAQS)'
  };

  const dirData = path.join(out, 'data');
  fs.mkdirSync(dirData, { recursive: true });
  fs.writeFileSync(
    path.join(dirData, 'faqs.js'),
    '/* Gerado por scripts/build-pages-site.js — não edite manualmente. */\n'
      + `window.CHARLES_FAQ_META = ${JSON.stringify(meta)};\n`
      + `window.CHARLES_FAQS = ${JSON.stringify(dados)};\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(dirData, 'faqs.json'),
    `${JSON.stringify({ ...meta, dados }, null, 2)}\n`,
    'utf8'
  );

  // 5. Impede o Jekyll de ignorar arquivos no Pages
  fs.writeFileSync(path.join(out, '.nojekyll'), '', 'utf8');

  const arquivos = listarArquivos(out);
  if (!quiet) {
    console.log('==============================================');
    console.log('  Pacote GitHub Pages gerado (Fase 2 Famps)');
    console.log('==============================================');
    console.log(`  Destino:  ${out}`);
    console.log(`  Arquivos: ${arquivos.length}`);
    console.log(`  FAQs:     ${faq.length} embutidas em data/faqs.js e data/faqs.json`);
    console.log('  Estrutura:');
    const essenciais = ['index.html', '.nojekyll', 'css/style.css', 'js/pages-mock.js', 'js/api-client.js', 'data/faqs.js', 'data/faqs.json', 'assets/Claro-logo.jpg'];
    for (const nome of essenciais) {
      console.log(`    ${arquivos.includes(nome) ? '✅' : '❌'} ${nome}`);
    }
    console.log('\n  Preview: node scripts/serve-pages.js  ->  http://localhost:4173/Charles/');
  }

  return { out, totalFaq: faq.length, arquivos };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const outIdx = args.indexOf('--out');
    buildPagesSite({
      out: outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : undefined,
      quiet: args.includes('--quiet')
    });
  } catch (erro) {
    console.error(`❌ Build do pacote Pages falhou: ${erro.message}`);
    process.exit(1);
  }
}

module.exports = { buildPagesSite };
