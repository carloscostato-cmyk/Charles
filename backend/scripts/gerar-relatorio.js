/**
 * gerar-relatorio.js
 *
 * Gera o relatorio HTML visual da ultima avaliacao do Quality Improvement Agent.
 * Pagina com a identidade do Charles: nota atual, metricas, problemas detectados,
 * acoes executadas pelo agente e historico recente.
 *
 * Uso:
 *   node scripts/gerar-relatorio.js
 *
 * Saida:
 *   data/quality-report.html  (o agente.bat abre essa pagina no navegador)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HISTORY_FILE = path.join(ROOT, 'data', 'quality-history.json');
const CONFIG_FILE = path.join(ROOT, 'quality-config.json');
const OUTPUT_FILE = path.join(ROOT, 'data', 'quality-report.html');
const IMAGE_CANDIDATES = [
  path.join(ROOT, 'charles-removebg-preview.png'),
  path.join(ROOT, 'charles.jpg')
];

const DEFAULT_THRESHOLDS = {
  retrievalPrecision: 0.85,
  citationRate: 0.9,
  hallucinationRate: 0.05,
  coverageRate: 0.8,
  avgQualityScore: 0.85,
  faqFreshness: 0.5
};

// ------------------------------------------------------------------ utils

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pct(value, digits) {
  return (100 * (value || 0)).toFixed(digits || 0).replace('.', ',') + '%';
}

function nota(valor) {
  return (valor || 0).toFixed(1).replace('.', ',');
}

function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.warn('[Relatorio] Falha ao ler ' + path.basename(file) + ': ' + error.message);
  }
  return fallback;
}

function loadCharlesImage() {
  for (const file of IMAGE_CANDIDATES) {
    try {
      if (fs.existsSync(file)) {
        const mime = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
        return 'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
      }
    } catch (e) { /* tenta a proxima imagem */ }
  }
  return null;
}

function formatarData(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return String(iso);
  }
}

function formatarDia(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit'
    });
  } catch (e) {
    return String(iso);
  }
}

// ---------------------------------------------------- dados do relatorio

const STATUS_ACOES = {
  success: { rotulo: 'Executado', icone: '✅' },
  pending_manual: { rotulo: 'Ação manual pendente', icone: '⏳' },
  no_action: { rotulo: 'Sem ação necessária', icone: '➖' },
  recommendation: { rotulo: 'Recomendação', icone: '💡' },
  failed: { rotulo: 'Falhou', icone: '❌' }
};

const SEVERIDADES = {
  critical: { rotulo: 'CRÍTICO', classe: 'critico' },
  high: { rotulo: 'ALTO', classe: 'critico' },
  medium: { rotulo: 'MÉDIO', classe: 'atencao' },
  low: { rotulo: 'BAIXO', classe: 'info' }
};

function montarMetricas(metrics, thresholds) {
  const lista = [
    { nome: 'Precisão do Retrieval', icone: '🎯', raw: metrics.retrievalPrecision, alvo: thresholds.retrievalPrecision, direcao: 'alta', dica: 'meta min. ' + pct(thresholds.retrievalPrecision) },
    { nome: 'Taxa de Citação', icone: '📚', raw: metrics.citationRate, alvo: thresholds.citationRate, direcao: 'alta', dica: 'meta min. ' + pct(thresholds.citationRate) },
    { nome: 'Taxa de Alucinação', icone: '🌀', raw: metrics.hallucinationRate, alvo: thresholds.hallucinationRate, direcao: 'baixa', dica: 'meta max. ' + pct(thresholds.hallucinationRate) },
    { nome: 'Cobertura de Lacunas', icone: '🧩', raw: metrics.coverageRate, alvo: thresholds.coverageRate, direcao: 'alta', dica: 'meta min. ' + pct(thresholds.coverageRate) },
    { nome: 'Nota de Qualidade', icone: '⭐', raw: metrics.avgQualityScore, alvo: thresholds.avgQualityScore, direcao: 'alta', dica: 'meta min. ' + Math.round(100 * thresholds.avgQualityScore), exibir: String(Math.round(100 * (metrics.avgQualityScore || 0))) },
    { nome: 'FAQ Atualizada', icone: '🔄', raw: metrics.faqFreshness, alvo: thresholds.faqFreshness, direcao: 'alta', dica: 'objetivo: 100%' }
  ];

  return lista.map(function (m) {
    const ok = m.direcao === 'alta' ? m.raw >= m.alvo : m.raw <= m.alvo;
    return {
      nome: m.nome,
      icone: m.icone,
      valor: m.exibir != null ? m.exibir : pct(m.raw),
      largura: Math.min(100, Math.round(100 * (m.raw || 0))),
      dica: m.dica,
      chip: ok ? 'OK' : (m.direcao === 'baixa' ? 'CRÍTICO' : 'ATENÇÃO'),
      classe: ok ? 'ok' : (m.direcao === 'baixa' ? 'critico' : 'atencao')
    };
  });
}

function montarAcoes(actions) {
  return (actions || []).map(function (a) {
    const info = STATUS_ACOES[a.status] || { rotulo: a.status, icone: '•' };
    return {
      icone: info.icone,
      rotulo: info.rotulo,
      tipo: a.type,
      mensagem: a.message || '',
      status: a.status
    };
  });
}

function montarIssues(issues) {
  return (issues || []).map(function (i) {
    const sev = SEVERIDADES[i.severity] || { rotulo: String(i.severity || '').toUpperCase(), classe: 'info' };
    return { rotulo: sev.rotulo, classe: sev.classe, mensagem: i.message || '' };
  });
}

function montarHistorico(evaluations, limite) {
  return evaluations.slice(-(limite || 10)).map(function (e) {
    return { dia: formatarDia(e.timestamp), score: e.score, altura: Math.max(4, Math.round(10 * (e.score || 0))) };
  });
}

// -------------------------------------------------------------------- CSS

const CSS = `
:root {
  --vermelho: #e30613;
  --vermelho-2: #ff5a3c;
  --tinta: #20242e;
  --suave: #667085;
  --fundo: #f3f4f8;
  --card: #ffffff;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
  background: var(--fundo);
  color: var(--tinta);
  min-height: 100vh;
  background-image:
    radial-gradient(600px 300px at 8% -5%, rgba(227, 6, 19, .10), transparent 60%),
    radial-gradient(700px 320px at 96% 4%, rgba(255, 90, 60, .12), transparent 62%);
}
.pagina { max-width: 1040px; margin: 0 auto; padding: 26px 22px 34px; }
.card {
  background: var(--card);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(24, 28, 40, .08);
  border: 1px solid #eceef4;
  animation: surgir .6s ease both;
}
@keyframes surgir { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes flutua { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }

/* -------- HERO -------- */
.hero {
  position: relative;
  overflow: hidden;
  border-radius: 26px;
  padding: 30px 36px;
  color: #fff;
  background: linear-gradient(135deg, #a8000b 0%, #e30613 46%, #ff6a45 100%);
  box-shadow: 0 16px 40px rgba(227, 6, 19, .28);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  animation: surgir .6s ease both;
}
.hero::after {
  content: "";
  position: absolute; inset: -40% 55% auto auto; width: 420px; height: 420px;
  background: radial-gradient(circle, rgba(255,255,255,.25), transparent 65%);
  border-radius: 50%;
}
.hero-esq { display: flex; align-items: center; gap: 22px; position: relative; z-index: 1; }
.charles-img {
  width: 132px; height: 132px; object-fit: contain;
  filter: drop-shadow(0 12px 22px rgba(0, 0, 0, .32));
  animation: flutua 4.2s ease-in-out infinite;
}
.charles-emoji { font-size: 88px; line-height: 1; animation: flutua 4.2s ease-in-out infinite; }
.eyebrow { font-size: 12px; letter-spacing: 3px; font-weight: 700; opacity: .92; }
.hero h1 { font-size: 33px; line-height: 1.15; margin: 6px 0 8px; }
.hero .sub { font-size: 14px; opacity: .95; }
.hero .sub2 { font-size: 12.5px; opacity: .82; margin-top: 4px; }
.nota-box { position: relative; z-index: 1; text-align: center; }
.nota-circ {
  width: 158px; height: 158px; border-radius: 50%;
  background: rgba(255, 255, 255, .16);
  border: 4px solid rgba(255, 255, 255, .45);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.nota-circ b { font-size: 56px; line-height: 1; font-weight: 800; letter-spacing: -1px; }
.nota-circ small { font-size: 13px; opacity: .9; margin-top: 2px; }
.delta {
  margin-top: 10px; display: inline-block; padding: 5px 14px; border-radius: 999px;
  font-size: 13px; font-weight: 700;
  background: rgba(255, 255, 255, .2); border: 1px solid rgba(255, 255, 255, .35);
}

/* -------- MISSAO / PROGRESSO -------- */
.missao { margin-top: 18px; padding: 20px 26px 24px; animation-delay: .08s; }
.missao-linha { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.missao-linha b { font-size: 16.5px; }
.missao-linha span { color: var(--suave); font-size: 13.5px; }
.trilho { position: relative; height: 20px; margin-top: 14px; background: #edeff5; border-radius: 999px; }
.preenche {
  height: 100%; width: 0; border-radius: 999px;
  background: linear-gradient(90deg, #e30613, #ff7a4d);
  box-shadow: 0 4px 14px rgba(227, 6, 19, .35);
  transition: width 1.4s cubic-bezier(.22, .8, .3, 1);
}
.marcador { position: absolute; top: -9px; width: 4px; height: 38px; border-radius: 4px; background: #1f2b5b; }
.marcador::after {
  content: attr(data-rotulo); position: absolute; top: -22px; left: 50%; transform: translateX(-50%);
  font-size: 11px; font-weight: 700; color: #1f2b5b; white-space: nowrap;
  background: #eef1fa; padding: 2px 8px; border-radius: 999px;
}
.missao-rodape { margin-top: 12px; font-size: 13px; color: var(--suave); }

/* -------- SECOES -------- */
.secao { margin-top: 26px; }
.secao > h2 { font-size: 19px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.grid-metricas { display: grid; grid-template-columns: repeat(auto-fit, minmax(228px, 1fr)); gap: 14px; }
.metrica { padding: 16px 18px 15px; }
.metrica-topo { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.metrica-nome { font-size: 12px; letter-spacing: .6px; text-transform: uppercase; color: var(--suave); font-weight: 700; }
.metrica-icone { font-size: 18px; }
.metrica-valor { font-size: 30px; font-weight: 800; margin: 8px 0 10px; }
.barra { height: 8px; background: #edeff5; border-radius: 999px; overflow: hidden; }
.barra i { display: block; height: 100%; width: 0; border-radius: 999px; transition: width 1.2s ease; }
.ok .barra i { background: linear-gradient(90deg, #16a34a, #4ade80); }
.atencao .barra i { background: linear-gradient(90deg, #ea9f0f, #fbbf24); }
.critico .barra i { background: linear-gradient(90deg, #d90429, #ff6b6b); }
.metrica-rodape { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; color: var(--suave); }
.chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .4px; }
.chip.ok { background: #e8f7ee; color: #15803d; }
.chip.atencao { background: #fdf3e3; color: #b45309; }
.chip.critico { background: #fdeaec; color: #c21527; }
.chip.info { background: #e9effd; color: #2749a8; }

/* -------- PAINEIS -------- */
.dupla { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .dupla { grid-template-columns: 1fr; } .hero { padding: 24px; } }
.painel { padding: 20px 22px; animation-delay: .14s; }
.painel h2 { font-size: 17px; margin-bottom: 12px; }
.lista { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: #f8f9fc; border: 1px solid #eef0f6; }
.item .emoji { font-size: 16px; line-height: 1.5; }
.item .corpo { flex: 1; }
.item .titulo { font-size: 13.5px; font-weight: 700; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.item .tipo { font-family: Consolas, monospace; font-size: 11.5px; color: var(--suave); background: #eef0f6; padding: 1px 7px; border-radius: 6px; }
.item .msg { font-size: 13px; color: #475069; margin-top: 3px; }
.vazio { font-size: 13.5px; color: var(--suave); font-style: italic; }

/* -------- HISTORICO -------- */
.historico { padding: 20px 22px 16px; animation-delay: .2s; }
.hist-barras { display: flex; align-items: flex-end; gap: 12px; height: 150px; padding: 8px 6px 0; }
.hist-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 6px; }
.hist-nota { font-size: 13px; font-weight: 800; }
.hist-barra { width: 100%; max-width: 46px; height: 100px; background: #edeff5; border-radius: 10px; display: flex; align-items: flex-end; overflow: hidden; }
.hist-barra i { display: block; width: 100%; height: 0; border-radius: 10px; background: linear-gradient(180deg, #ff6a45, #e30613); transition: height 1.2s ease; }
.hist-dia { font-size: 11.5px; color: var(--suave); font-weight: 600; }

/* -------- RODAPE -------- */
.rodape { margin-top: 30px; text-align: center; font-size: 12.5px; color: var(--suave); line-height: 1.8; }
.rodape b { color: var(--vermelho); }
`;

// ------------------------------------------------------------------- HTML

function montarHtml(dados) {
  const itensMetricas = dados.metricas.map(function (m) {
    return '<article class="card metrica ' + m.classe + '">' +
      '<div class="metrica-topo"><span class="metrica-nome">' + esc(m.nome) + '</span><span class="metrica-icone">' + m.icone + '</span></div>' +
      '<div class="metrica-valor">' + m.valor + '</div>' +
      '<div class="barra"><i data-w="' + m.largura + '"></i></div>' +
      '<div class="metrica-rodape"><span>' + esc(m.dica) + '</span><span class="chip ' + m.classe + '">' + m.chip + '</span></div>' +
      '</article>';
  }).join('');

  const itensIssues = dados.issues.length
    ? dados.issues.map(function (i) {
        return '<li class="item"><span class="emoji">⚠️</span><div class="corpo">' +
          '<div class="titulo"><span class="chip ' + i.classe + '">' + i.rotulo + '</span></div>' +
          '<div class="msg">' + esc(i.mensagem) + '</div></div></li>';
      }).join('')
    : '<p class="vazio">Nenhum problema detectado neste ciclo. Excelente! 🎉</p>';

  const itensAcoes = dados.acoes.length
    ? dados.acoes.map(function (a) {
        return '<li class="item"><span class="emoji">' + a.icone + '</span><div class="corpo">' +
          '<div class="titulo"><span class="tipo">' + esc(a.tipo) + '</span><span class="chip info">' + esc(a.rotulo) + '</span></div>' +
          '<div class="msg">' + esc(a.mensagem) + '</div></div></li>';
      }).join('')
    : '<p class="vazio">Nenhuma ação registrada neste ciclo.</p>';

  const itensRecs = dados.recomendacoes.length
    ? dados.recomendacoes.map(function (r) {
        return '<li class="item"><span class="emoji">💡</span><div class="corpo"><div class="msg">' + esc(r) + '</div></div></li>';
      }).join('')
    : '<p class="vazio">Sem recomendações adicionais. 🚀</p>';

  const barrasHist = dados.historico.map(function (h) {
    return '<div class="hist-item"><span class="hist-nota">' + nota(h.score) + '</span>' +
      '<div class="hist-barra"><i data-h="' + h.altura + '"></i></div>' +
      '<span class="hist-dia">' + h.dia + '</span></div>';
  }).join('');

  const charlesHtml = dados.imagem
    ? '<img class="charles-img" src="' + dados.imagem + '" alt="Charles">'
    : '<span class="charles-emoji">🤖</span>';

  const deltaTxt = dados.delta == null
    ? '★ primeira avaliação registrada'
    : dados.delta > 0
      ? '▲ subiu ' + nota(Math.abs(dados.delta)) + ' vs. ciclo anterior'
      : dados.delta < 0
        ? '▼ caiu ' + nota(Math.abs(dados.delta)) + ' vs. ciclo anterior'
        : '• estável vs. ciclo anterior';

  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Charles • Nota ' + nota(dados.score) + '/10</title>' +
    '<style>' + CSS + '</style></head><body>' +

    '<div class="pagina">' +

    '<header class="hero">' +
      '<div class="hero-esq">' + charlesHtml +
        '<div>' +
          '<div class="eyebrow">CHARLES • ASSISTENTE VIRTUAL</div>' +
          '<h1>Relatório de Qualidade</h1>' +
          '<p class="sub">Ciclo de melhoria contínua concluído em <b>' + esc(dados.dataExecucao) + '</b></p>' +
          '<p class="sub2">Avaliação nº ' + dados.numero + ' • Quality Improvement Agent</p>' +
        '</div>' +
      '</div>' +
      '<div class="nota-box">' +
        '<div class="nota-circ"><b id="notaGrande">0,0</b><small>de 10</small></div>' +
        '<div class="delta">' + deltaTxt + '</div>' +
      '</div>' +
    '</header>' +

    '<section class="card missao">' +
      '<div class="missao-linha"><b>🚀 Missão: nota 10/10 — melhor que o ChatGPT</b>' +
      '<span>' + pct(dados.score / 10) + ' do caminho percorrido</span></div>' +
      '<div class="trilho"><div class="preenche" data-w="' + Math.round(dados.score * 10) + '"></div>' +
      '<div class="marcador" data-rotulo="meta ' + nota(dados.target) + '" style="left: ' + Math.min(98, dados.target * 10) + '%;"></div></div>' +
      '<div class="missao-rodape">Nota atual <b>' + nota(dados.score) + '/10</b> • Meta do agente: ' + nota(dados.target) + '/10 • O robô avalia o Charles sozinho 3x ao dia útil (11:00, 15:00 e 17:50).</div>' +
    '</section>' +

    '<section class="secao"><h2>📊 Métricas avaliadas</h2><div class="grid-metricas">' + itensMetricas + '</div></section>' +

    '<section class="secao dupla">' +
      '<article class="card painel"><h2>⚠️ Problemas detectados</h2><ul class="lista">' + itensIssues + '</ul></article>' +
      '<article class="card painel"><h2>🔧 O que o agente executou</h2><ul class="lista">' + itensAcoes + '</ul></article>' +
    '</section>' +

    '<section class="secao"><article class="card painel"><h2>💡 Próximos passos recomendados</h2><ul class="lista">' + itensRecs + '</ul></article></section>' +

    '<section class="secao"><article class="card historico"><h2>📈 Histórico das últimas avaliações</h2><div class="hist-barras">' + barrasHist + '</div></article></section>' +

    '<div class="rodape">Página gerada automaticamente pelo <b>Quality Improvement Agent</b> do Charles<br>' +
    'Charles Chatbot • ' + esc(dados.dataAgora) + '</div>' +

    '</div>' +

    '<script>' +
      'var alvo = ' + JSON.stringify(dados.score) + ';' +
      'var el = document.getElementById("notaGrande");' +
      'var passos = 30, i = 0;' +
      'var timer = setInterval(function () {' +
        'i++;' +
        'el.textContent = (alvo * i / passos).toFixed(1).replace(".", ",");' +
        'if (i >= passos) { clearInterval(timer); el.textContent = alvo.toFixed(1).replace(".", ","); }' +
      '}, 30);' +
      'window.addEventListener("load", function () {' +
        'document.querySelectorAll(".preenche").forEach(function (b) { b.style.width = b.dataset.w + "%"; });' +
        'document.querySelectorAll(".metrica .barra i").forEach(function (b) { b.style.width = b.dataset.w + "%"; });' +
        'document.querySelectorAll(".hist-barra i").forEach(function (b) { b.style.height = b.dataset.h + "%"; });' +
      '});' +
    '</script>' +

    '</body></html>';

  return html;
}

// -------------------------------------------------------------------- main

const historicoJson = loadJson(HISTORY_FILE, { evaluations: [] });
const config = loadJson(CONFIG_FILE, {});
const thresholds = Object.assign({}, DEFAULT_THRESHOLDS, config.thresholds || {});
const target = config.targetScore || 9.5;
const evaluations = historicoJson.evaluations || [];
const ultima = evaluations.length ? evaluations[evaluations.length - 1] : null;
const anterior = evaluations.length > 1 ? evaluations[evaluations.length - 2] : null;

const dados = {
  score: ultima ? ultima.score : 0,
  target: target,
  delta: ultima && anterior ? Math.round(10 * (ultima.score - anterior.score)) / 10 : null,
  numero: evaluations.length,
  dataExecucao: ultima ? formatarData(ultima.timestamp) : '—',
  dataAgora: formatarData(new Date().toISOString()),
  imagem: loadCharlesImage(),
  metricas: montarMetricas((ultima && ultima.metrics) || {}, thresholds),
  issues: montarIssues(ultima ? ultima.issues : []),
  acoes: montarAcoes(ultima ? ultima.actions : []),
  recomendacoes: (ultima && ultima.recommendations) || [],
  historico: montarHistorico(evaluations, 10)
};

try {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  const htmlFinal = montarHtml(dados).replace(/></g, '>\n<');
  fs.writeFileSync(OUTPUT_FILE, htmlFinal, 'utf8');
  console.log('[Relatorio] Pagina gerada: ' + OUTPUT_FILE);
  console.log('[Relatorio] Nota atual do Charles: ' + nota(dados.score) + '/10');
} catch (error) {
  console.error('[Relatorio] Falha ao gerar a pagina: ' + error.message);
  process.exit(1);
}