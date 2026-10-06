/**
 * pages-mock.js
 *
 * Camada de mock da API do Charles para o demo estático (GitHub Pages).
 *
 * Contexto (Fase 2 do Famps - Route A+):
 *   O site no GitHub Pages não tem backend. Este arquivo intercepta o
 *   fetch global e responde os endpoints que a página /sharepoint usa,
 *   usando as 159 FAQs embutidas (data/faqs.js -> window.CHARLES_FAQS).
 *
 * Trava dupla de ativação:
 *   1. O arquivo só é incluído no HTML pelo build (scripts/build-pages-site.js);
 *   2. O interceptador só instala se window.__CHARLES_PAGES__ === true
 *      (flag igualmente injetada pelo build).
 *   O servidor Express (index-datacenter.html original) não injeta nada,
 *   portanto este arquivo NÃO altera o comportamento do ambiente completo.
 *
 * Paridade de contrato com o backend:
 *   - GET  /api/status         -> shape de backend/server.js
 *   - GET  /api/faq            -> { total, dados: [{id, pergunta, resposta}] }
 *   - GET  /api/sugestoes?q=N  -> { sugestoes: [strings], total } (teto 10)
 *   - GET  /api/chat/welcome   -> espelho de agents/welcome-agent.js
 *   - POST /api/chat/stream    -> SSE "event: X\ndata: {...}\n\n"
 *                                 (formato de streaming/sse-handler.js)
 *   - POST /api/chat           -> { resposta, fonte, sugestoes, tipoResposta }
 *   - Demais /api/*            -> 404/405 JSON (ex.: /api/tts, onde o voice.js
 *                                 já aciona sozinho o fallback Web Speech)
 *
 * A busca na FAQ é um porte de backend/faq-search.js (mesmos pesos e
 * threshold de 0.2) para o demo responder igual ao ambiente completo.
 *
 * O núcleo puro (sem DOM) é exportado via module.exports para os testes
 * Jest; em Node não existe window/document, então o wiring nunca roda.
 */
(function () {
  'use strict';

  // ============ NÚCLEO PURO (sem DOM) ============

  /**
   * Similaridade de Levenshtein normalizada (0-1).
   * Porte exato de backend/faq-search.js.
   */
  function similaridadeLevenshtein(a, b) {
    const aLower = a.toLowerCase().trim();
    const bLower = b.toLowerCase().trim();

    if (aLower === bLower) return 1.0;
    if (aLower.length === 0 || bLower.length === 0) return 0.0;

    const matrix = [];
    for (let i = 0; i <= bLower.length; i++) matrix[i] = [i];
    for (let j = 0; j <= aLower.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= bLower.length; i++) {
      for (let j = 1; j <= aLower.length; j++) {
        matrix[i][j] = bLower[i - 1] === aLower[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
      }
    }

    const distancia = matrix[bLower.length][aLower.length];
    const maxLen = Math.max(aLower.length, bLower.length);
    return 1 - distancia / maxLen;
  }

  /**
   * Similaridade por palavras-chave compartilhadas (palavras > 3 chars).
   * Porte exato de backend/faq-search.js.
   */
  function similaridadePalavrasChave(pergunta, textoBusca) {
    const palavrasPergunta = pergunta.toLowerCase().split(/\s+/).filter(p => p.length > 3);
    const palavrasBusca = textoBusca.toLowerCase().split(/\s+/).filter(p => p.length > 3);

    if (palavrasPergunta.length === 0 || palavrasBusca.length === 0) return 0;

    const palavrasComuns = palavrasPergunta.filter(p => palavrasBusca.includes(p));
    return palavrasComuns.length / Math.max(palavrasPergunta.length, palavrasBusca.length);
  }

  /**
   * Busca uma pergunta na FAQ com os mesmos pesos do backend.
   * @returns {Array<{pergunta: string, resposta: string, score: number, index: number}>}
   */
  function buscarNaFAQ(texto, faq, limite = 3) {
    if (!texto || !faq || faq.length === 0) return [];

    const textoBusca = texto.toLowerCase().trim();

    const resultados = faq.map((item, index) => {
      const perguntaLower = item.pergunta.toLowerCase();

      const scoreLevenshtein = similaridadeLevenshtein(textoBusca, perguntaLower);
      const scorePalavras = similaridadePalavrasChave(perguntaLower, textoBusca);
      const scoreSubstring = perguntaLower.includes(textoBusca) ? 0.8 : 0;
      const scoreInverso = similaridadePalavrasChave(textoBusca, perguntaLower);

      const scoreFinal = Math.max(
        scoreLevenshtein * 0.4,
        scorePalavras * 0.3,
        scoreSubstring * 0.5,
        scoreInverso * 0.3
      );

      return { pergunta: item.pergunta, resposta: item.resposta, score: scoreFinal, index };
    });

    return resultados
      .filter(r => r.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limite);
  }

  /**
   * Embaralha e retorna N perguntas da FAQ (teto 10, igual ao backend).
   */
  function getSugestoes(faq, quantidade = 4) {
    if (!faq || faq.length === 0) return [];
    const shuffled = [...faq].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, quantidade).map(item => item.pergunta);
  }

  // ============ RESPOSTAS PRONTAS (paridade com o backend) ============

  /** Mensagem usada quando nenhuma FAQ casa com a pergunta. */
  const MENSAGEM_LACUNA =
    'Não encontrei essa questão nas 159 FAQs deste demo. Tente reformular a pergunta '
    + 'ou clique numa sugestão — no ambiente completo, o Charles aciona a busca '
    + 'semântica (RAG) e o LLM. Todas as FAQs estão publicadas em data/faqs.json.';

  /**
   * Espelho de GET /api/status (backend/server.js).
   * llm.disponivel = false propositalmente: o app mostra
   * "Online · N perguntas (FAQ)", que é honesto para o demo.
   */
  function montarStatus(faq) {
    const total = faq.length;
    return {
      servidor: 'online',
      chatbot: 'Charles',
      versao: '4.1.0-pages',
      demo: true,
      faq: { total, carregada: total > 0 },
      llm: {
        provider: 'FAQ embutida (offline)',
        modelo: 'faq-search',
        disponivel: false,
        provedorAtivo: 'demo'
      }
    };
  }

  /**
   * Espelho de GET /api/faq.
   */
  function montarFaqPublica(faq) {
    return {
      total: faq.length,
      dados: faq.map((item, index) => ({
        id: index + 1,
        pergunta: item.pergunta,
        resposta: item.resposta
      }))
    };
  }

  /**
   * Período do dia — espelho de agents/humanizer.js (5h/12h/18h).
   * Aceita hora fixa para testes determinísticos.
   */
  function detectarPeriodo(hora) {
    const h = Number.isFinite(hora) ? hora : new Date().getHours();
    if (h >= 5 && h < 12) return 'manha';
    if (h >= 12 && h < 18) return 'tarde';
    return 'noite';
  }

  /**
   * Saudação por período — espelho de agents/humanizer.js.
   */
  function gerarSaudacao(periodo) {
    const saudacoes = { manha: 'Bom dia!', tarde: 'Boa tarde!', noite: 'Boa noite!' };
    return saudacoes[periodo] || saudacoes[detectarPeriodo()];
  }

  /**
   * Espelho de GET /api/chat/welcome (agents/welcome-agent.js).
   * Sem nome (não há Entra ID no demo estático) -> comNome: false.
   */
  function montarWelcome(hora) {
    const periodo = detectarPeriodo(hora);
    const saudacao = gerarSaudacao(periodo);
    const convite = 'Sou o Charles, especialista em Data Center e operações de NOC. '
      + 'Posso informar endereços e contatos das unidades, apoiar diagnósticos e orientar sobre procedimentos. '
      + 'O que você precisa hoje?';

    return {
      mensagem: `${saudacao} ${convite}`,
      saudacao,
      periodo,
      comNome: false,
      autenticado: false
    };
  }

  /**
   * Espelho de GET /api/sugestoes (teto 10, como o backend).
   */
  function montarSugestoes(faq, quantidade) {
    const q = Math.min(parseInt(quantidade, 10) || 4, 10);
    const sugestoes = getSugestoes(faq, q);
    return { sugestoes, total: sugestoes.length };
  }

  /**
   * Escolhe a resposta da FAQ (fonte 'faq') ou a mensagem de lacuna
   * (fonte 'fallback' -> badge "Não encontrado" no app).
   */
  function montarResposta(pergunta, faq) {
    const resultados = buscarNaFAQ(pergunta, faq, 1);
    if (resultados.length > 0) {
      return {
        resposta: resultados[0].resposta,
        fonte: 'faq',
        perguntaRelacionada: resultados[0].pergunta,
        pontuacao: Number(resultados[0].score.toFixed(4))
      };
    }
    return { resposta: MENSAGEM_LACUNA, fonte: 'fallback' };
  }

  /**
   * Monta um evento SSE no formato de streaming/sse-handler.js:
   * "event: <nome>\ndata: <json>\n\n"
   */
  function eventoSse(evento, dados) {
    return `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  }

  /**
   * Monta a resposta SSE completa de POST /api/chat/stream:
   * metadata -> token* -> done (mesmos eventos consumidos pelo api-client).
   */
  function montarSse(pergunta, faq) {
    const r = montarResposta(pergunta, faq);
    const tokens = r.resposta.match(/\S+\s*/g) || [r.resposta];

    let texto = eventoSse('metadata', {
      fonte: r.fonte,
      demo: true,
      base: 'faq-embutida',
      timestamp: Date.now()
    });
    for (const token of tokens) {
      texto += eventoSse('token', { token });
    }
    texto += eventoSse('done', { fonte: r.fonte, totalTokens: tokens.length });
    return texto;
  }

  // Núcleo puro exportado para os testes Jest (em Node não há window).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      similaridadeLevenshtein,
      similaridadePalavrasChave,
      buscarNaFAQ,
      getSugestoes,
      detectarPeriodo,
      gerarSaudacao,
      montarWelcome,
      montarStatus,
      montarFaqPublica,
      montarSugestoes,
      montarResposta,
      eventoSse,
      montarSse,
      MENSAGEM_LACUNA
    };
  }

  // __CHUNK_BUILDERS__

  // ============ WIRING NO NAVEGADOR ============

  // Sem DOM (Node/Jest) ou sem a flag do build de Pages → nada a interceptar.
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__CHARLES_PAGES__ !== true) return;
  if (window.__CHARLES_PAGES_MOCK__ === true) return;
  if (typeof window.fetch !== 'function') {
    console.warn('[PagesMock] fetch indisponível; mock não instalado.');
    return;
  }
  window.__CHARLES_PAGES_MOCK__ = true;

  const fetchOriginal = window.fetch.bind(window);

  function carregarFaq() {
    return Array.isArray(window.CHARLES_FAQS) ? window.CHARLES_FAQS : [];
  }

  function json(objeto, status = 200) {
    return new Response(JSON.stringify(objeto), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  /**
   * Resolve a requisição e devolve { rota, query, metodo } quando o
   * pathname contém /api/ (cobre URLs absolutas do api-client e
   * relativas como fetch('/api/tts')), ou null se não é nossa.
   */
  function detalharRequisicao(input, init) {
    let bruto;
    if (typeof input === 'string') bruto = input;
    else if (input instanceof URL) bruto = input.href;
    else if (input && typeof input.url === 'string') bruto = input.url;
    else return null;

    let resolvida;
    try {
      resolvida = new URL(bruto, window.location.href);
    } catch {
      return null;
    }

    const caminho = resolvida.pathname;
    const inicio = caminho.indexOf('/api/');
    if (inicio === -1) return null;

    return {
      rota: caminho.slice(inicio + 4) || '/',
      query: resolvida.searchParams,
      metodo: String((init && init.method) || (input && input.method) || 'GET').toUpperCase()
    };
  }

  function corpoJson(init) {
    if (init && typeof init.body === 'string') {
      try { return JSON.parse(init.body); } catch { return {}; }
    }
    return {};
  }

  /**
   * Resposta SSE em streaming (palavra a palavra, ~25ms) — simula o
   * token-by-token do backend. Sem ReadableStream, entrega tudo de uma vez
   * (o parser do api-client lê igual).
   */
  function respostaSse(texto) {
    const headers = { 'Content-Type': 'text/event-stream; charset=utf-8' };

    if (typeof ReadableStream === 'undefined' || typeof TextEncoder === 'undefined') {
      return new Response(texto, { status: 200, headers });
    }

    const encoder = new TextEncoder();
    const pedacos = texto.match(/\S+\s*/g) || [texto];
    let indice = 0;

    const fluxo = new ReadableStream({
      start(controller) {
        function proximo() {
          if (indice >= pedacos.length) {
            controller.close();
            return;
          }
          try {
            controller.enqueue(encoder.encode(pedacos[indice]));
          } catch {
            return;
          }
          indice += 1;
          setTimeout(proximo, 25);
        }
        proximo();
      }
    });

    return new Response(fluxo, { status: 200, headers });
  }

  /**
   * Roteador dos endpoints que a página /sharepoint usa.
   * Qualquer outro /api/* recebe 404/405 JSON.
   */
  function responder(det, corpo) {
    const { rota, query, metodo } = det;
    const faq = carregarFaq();

    if (metodo === 'GET') {
      if (rota === '/status') return json(montarStatus(faq));
      if (rota === '/faq') return json(montarFaqPublica(faq));
      if (rota === '/sugestoes') return json(montarSugestoes(faq, query.get('q')));
      if (rota === '/chat/welcome') return json(montarWelcome());
    } else if (metodo === 'POST') {
      const pergunta = String(corpo.mensagem || '').trim();

      if (rota === '/chat/stream') {
        if (!pergunta) return json({ erro: 'Mensagem é obrigatória' }, 400);
        return respostaSse(montarSse(pergunta, faq));
      }
      if (rota === '/chat') {
        if (!pergunta) {
          return json({
            resposta: 'Por favor, digite uma mensagem para que eu possa ajudar.',
            tipoResposta: { tipo: 'conversacao', deveSerFalado: true }
          }, 400);
        }
        const r = montarResposta(pergunta, faq);
        return json({
          resposta: r.resposta,
          fonte: r.fonte,
          sugestoes: getSugestoes(faq, 3),
          tipoResposta: { tipo: 'conversacao', deveSerFalado: true }
        });
      }
      if (rota === '/chat/reset') return json({ success: true });
    }

    const conhecida = ['/status', '/faq', '/sugestoes', '/chat/welcome', '/chat/stream', '/chat', '/chat/reset'];
    const status = conhecida.includes(rota) ? 405 : 404;
    return json({
      erro: `Endpoint ${metodo} ${rota} indisponível no demo estático (Fase 2 do Famps).`,
      demo: true
    }, status);
  }

  window.fetch = function pagesMockFetch(input, init) {
    try {
      const det = detalharRequisicao(input, init);
      if (!det) return fetchOriginal(input, init);

      console.info(`[PagesMock] ${det.metodo} ${det.rota} → resposta local (demo estático)`);
      return Promise.resolve(responder(det, corpoJson(init)));
    } catch (erro) {
      console.warn('[PagesMock] falha no mock, usando a rede:', erro.message);
      return fetchOriginal(input, init);
    }
  };

  console.info(`%c[PagesMock] ativo — ${carregarFaq().length} FAQs embutidas (demo GitHub Pages)`, 'color: #e3262e;');
})();
