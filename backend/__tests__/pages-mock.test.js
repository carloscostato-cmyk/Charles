/**
 * pages-mock.test.js — Fase 2 do Famps (Route A+)
 *
 * Cobre duas coisas:
 *   1. O núcleo puro de frontend/js/pages-mock.js (contrato com os
 *      endpoints que o app consome: status, faq, sugestoes, welcome e SSE);
 *   2. A integração de scripts/build-pages-site.js (estrutura do pacote,
 *      caminhos relativos, mock injetado e 159 FAQs embutidas).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const mock = require('../../frontend/js/pages-mock');
const { lerFAQ } = require('../faq-reader');
const { buildPagesSite } = require('../../scripts/build-pages-site');

const faq = lerFAQ();

describe('Pages mock — contrato da FAQ', () => {
  test('FQ_DATA_CENTER.xls tem exatamente 159 FAQs', () => {
    expect(faq.length).toBe(159);
  });

  test('montarStatus expõe o shape consumido por app.js', () => {
    const status = mock.montarStatus(faq);
    expect(status).toMatchObject({
      servidor: 'online',
      chatbot: 'Charles',
      demo: true,
      faq: { total: 159, carregada: true }
    });
    // disponivel: false -> a UI mostra "Online · 159 perguntas (FAQ)"
    expect(status.llm.disponivel).toBe(false);
    expect(typeof status.llm.provider).toBe('string');
    expect(typeof status.llm.modelo).toBe('string');
  });

  test('montarFaqPublica segue o shape de GET /api/faq', () => {
    const r = mock.montarFaqPublica(faq);
    expect(r.total).toBe(159);
    expect(r.dados[0]).toEqual({ id: 1, pergunta: faq[0].pergunta, resposta: faq[0].resposta });
  });

  test('sugestoes respeitam teto 10 e devolvem strings', () => {
    const r = mock.montarSugestoes(faq, 99);
    expect(r.total).toBe(10);
    expect(r.sugestoes).toHaveLength(10);
    r.sugestoes.forEach(s => expect(typeof s).toBe('string'));

    const padrao = mock.montarSugestoes(faq, undefined);
    expect(padrao.total).toBe(4);
  });
});

describe('Pages mock — busca na FAQ (porte de faq-search.js)', () => {
  test('pergunta conhecida casa com score > 0.2', () => {
    const r = mock.buscarNaFAQ(faq[0].pergunta, faq, 3);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].score).toBeGreaterThan(0.2);
    expect(r[0].resposta).toBeTruthy();
  });

  test('texto sem sentido não casa -> fonte fallback', () => {
    expect(mock.buscarNaFAQ('xyzzy blorp quentzelvania', faq, 3)).toHaveLength(0);

    const resp = mock.montarResposta('xyzzy blorp quentzelvania', faq);
    expect(resp.fonte).toBe('fallback');
    expect(resp.resposta).toBe(mock.MENSAGEM_LACUNA);
  });

  test('pergunta conhecida -> fonte faq com pontuação', () => {
    const resp = mock.montarResposta(faq[0].pergunta, faq);
    expect(resp.fonte).toBe('faq');
    expect(resp.pontuacao).toBeGreaterThan(0.2);
    expect(resp.resposta).toBe(faq[0].resposta);
  });
});

describe('Pages mock — welcome por horário (espelho do welcome-agent)', () => {
  test('períodos nas fronteiras 5h/12h/18h', () => {
    expect(mock.detectarPeriodo(6)).toBe('manha');
    expect(mock.detectarPeriodo(13)).toBe('tarde');
    expect(mock.detectarPeriodo(20)).toBe('noite');
  });

  test('mensagem começa com a saudação e cita o Charles', () => {
    const w = mock.montarWelcome(6);
    expect(w.saudacao).toBe('Bom dia!');
    expect(w.mensagem.startsWith('Bom dia! ')).toBe(true);
    expect(w.mensagem).toContain('Charles');
    expect(w.comNome).toBe(false);
    expect(w.periodo).toBe('manha');
  });
});

describe('Pages mock — SSE (formato de streaming/sse-handler.js)', () => {
  /**
   * Parser idêntico ao consumidor de postStream em api-client.js
   * (linhas "event: X" + "data: {json}" separadas por \n).
   */
  function parserSse(texto) {
    const eventos = [];
    let atual = null;
    for (const linha of texto.split('\n')) {
      if (linha.startsWith('event: ')) {
        atual = linha.slice(7).trim();
      } else if (linha.startsWith('data: ')) {
        eventos.push({ evento: atual, dados: JSON.parse(linha.slice(6)) });
      }
    }
    return eventos;
  }

  test('sequência metadata -> token* -> done com JSON válido', () => {
    const esperado = mock.montarResposta(faq[0].pergunta, faq);
    const sse = mock.montarSse(faq[0].pergunta, faq);
    expect(sse.endsWith('\n\n')).toBe(true);

    const eventos = parserSse(sse);
    expect(eventos.length).toBeGreaterThan(3);
    expect(eventos[0].evento).toBe('metadata');
    expect(eventos[0].dados.fonte).toBe('faq');
    expect(eventos[0].dados.demo).toBe(true);

    const tokens = eventos.filter(e => e.evento === 'token').map(e => e.dados.token).join('');
    expect(tokens).toBe(esperado.resposta);

    const fim = eventos[eventos.length - 1];
    expect(fim.evento).toBe('done');
    expect(fim.dados.fonte).toBe('faq');
    expect(fim.dados.totalTokens).toBeGreaterThan(0);
  });

  test('pergunta sem match termina com fonte fallback', () => {
    const eventos = parserSse(mock.montarSse('xyzzy blorp quentzelvania', faq));
    expect(eventos[0].dados.fonte).toBe('fallback');
    expect(eventos[eventos.length - 1].dados.fonte).toBe('fallback');
  });
});

describe('Build do pacote Pages (integração)', () => {
  let dir;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-site-'));
    buildPagesSite({ out: dir, quiet: true });
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const ler = rel => fs.readFileSync(path.join(dir, rel), 'utf8');

  test('gera a estrutura essencial', () => {
    const esperados = [
      'index.html',
      '.nojekyll',
      'css/style.css',
      'css/response-types.css',
      'css/a11y.css',
      'js/api-client.js',
      'js/app.js',
      'js/pages-mock.js',
      'data/faqs.js',
      'data/faqs.json',
      'assets/Claro-logo.jpg',
      'assets/charles-removebg-preview.png',
      'assets/escrever.jpg'
    ];
    for (const rel of esperados) {
      expect(fs.existsSync(path.join(dir, rel))).toBe(true);
    }
  });

  test('index.html sem caminhos absolutos e com o mock ANTES do api-client', () => {
    const html = ler('index.html');
    expect(html).not.toMatch(/(?:href|src)="\//);
    expect(html).toContain('window.__CHARLES_PAGES__ = true');
    expect(html).toContain('./js/pages-mock.js');
    expect(html).toContain('./data/faqs.js');
    // ordem importa: faqs e mock precisam carregar antes do api-client
    expect(html.indexOf('./data/faqs.js')).toBeLessThan(html.indexOf('./js/api-client.js'));
    expect(html.indexOf('./js/pages-mock.js')).toBeLessThan(html.indexOf('./js/api-client.js'));
    expect(html.indexOf('window.__CHARLES_PAGES__')).toBeLessThan(html.indexOf('./js/pages-mock.js'));
  });

  test('159 FAQs embutidas em faqs.js e faqs.json', () => {
    const janela = {};
    new Function('window', ler('data/faqs.js'))(janela);
    expect(janela.CHARLES_FAQS).toHaveLength(159);
    expect(janela.CHARLES_FAQ_META.total).toBe(159);
    expect(janela.CHARLES_FAQ_META.origem).toBe('FQ_DATA_CENTER.xls');
    expect(janela.CHARLES_FAQS[0].pergunta).toBe(faq[0].pergunta);

    const json = JSON.parse(ler('data/faqs.json'));
    expect(json.total).toBe(159);
    expect(json.dados).toHaveLength(159);
    expect(json.dados[0].id).toBe(1);
  });
});

