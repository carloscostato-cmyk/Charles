/**
 * knowledge-gap.test.js
 *
 * Valida o ciclo de vida das lacunas de conhecimento (registrar → listar →
 * estatísticas → fechar) e o critério `semFonteDocumental` do llm-client,
 * que decide quando uma resposta é candidata a knowledge gap.
 *
 * Usa KNOWLEDGE_GAPS_FILE apontando para arquivo temporário (não toca
 * no knowledge-gaps.json de produção).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// Deve ser definido ANTES do require do módulo
const arquivoTemp = path.join(os.tmpdir(), `knowledge-gaps-test-${process.pid}.json`);
process.env.KNOWLEDGE_GAPS_FILE = arquivoTemp;
if (fs.existsSync(arquivoTemp)) fs.unlinkSync(arquivoTemp);

const knowledgeGap = require('../agents/knowledge-gap');
const { semFonteDocumental } = require('../llm-client');

afterAll(() => {
  delete process.env.KNOWLEDGE_GAPS_FILE;
  if (fs.existsSync(arquivoTemp)) fs.unlinkSync(arquivoTemp);
});

describe('knowledge-gap - ciclo de vida', () => {
  it('inicia vazio quando o arquivo não existe', () => {
    expect(knowledgeGap.getEstatisticas()).toEqual({ total: 0, pendentes: 0, respondidas: 0 });
  });

  it('registra nova lacuna com campos completos', () => {
    const gap = knowledgeGap.registrarGap('Como acionar o runbook de failover?', 'teste');
    expect(gap).toBeTruthy();
    expect(gap.id).toBe(1);
    expect(gap.vezesPerguntada).toBe(1);
    expect(gap.respondida).toBe(false);
    expect(gap.dataRegistro).toBeTruthy();
    expect(fs.existsSync(arquivoTemp)).toBe(true);
  });

  it('deduplica por pergunta (ignora caixa/espaços) e incrementa contagem', () => {
    const gap = knowledgeGap.registrarGap('  como acionar o RUNBOOK de failover? ', 'teste');
    expect(gap.id).toBe(1);
    expect(gap.vezesPerguntada).toBe(2);
    expect(knowledgeGap.getEstatisticas().total).toBe(1);
  });

  it('rejeita pergunta vazia', () => {
    expect(knowledgeGap.registrarGap('   ')).toBeNull();
    expect(knowledgeGap.getEstatisticas().total).toBe(1);
  });

  it('lista pendentes ordenadas por frequência', () => {
    knowledgeGap.registrarGap('pergunta rara sobre portas do firewall', 'teste');
    knowledgeGap.registrarGap('pergunta frequente sobre troca de disco', 'teste');
    knowledgeGap.registrarGap('pergunta frequente sobre troca de disco', 'teste');
    const pendentes = knowledgeGap.listarPerguntasPendentes(10);
    expect(pendentes[0].pergunta).toBe('pergunta frequente sobre troca de disco');
    expect(pendentes[0].vezesPerguntada).toBe(2);
    expect(pendentes.every((p) => !p.respondida)).toBe(true);
  });

  it('respeita o limite de itens listados', () => {
    expect(knowledgeGap.listarPerguntasPendentes(1)).toHaveLength(1);
  });

  it('fecha lacuna como respondida', () => {
    const pendente = knowledgeGap.listarPerguntasPendentes(1)[0];
    expect(knowledgeGap.marcarRespondida(pendente.id, 'resposta documental')).toBe(true);
    const stats = knowledgeGap.getEstatisticas();
    expect(stats.respondidas).toBe(1);
    expect(stats.pendentes).toBe(stats.total - 1);
    expect(knowledgeGap.listarPerguntasPendentes(50).some((g) => g.id === pendente.id)).toBe(false);
  });

  it('marcarRespondida retorna false para id inexistente', () => {
    expect(knowledgeGap.marcarRespondida(9999, 'x')).toBe(false);
  });
});

describe('registrarGap - filtro de conversa fiada', () => {
  const ruidos = [
    'tudo bem',
    'E aí tudo bem',
    'oi',
    'boa tarde',
    'obrigado',
    'teste',
    'me escuta',
    'Tensão de funk.',
    'Personagem do Santo ainda.',
    'não quero saber os documentos'
  ];

  it.each(ruidos)('ignora ruído de conversa: "%s"', (ruido) => {
    expect(knowledgeGap.registrarGap(ruido, 'teste')).toBeNull();
  });

  it('não conta o ruído ignorado nas estatísticas', () => {
    const antes = knowledgeGap.getEstatisticas().total;
    knowledgeGap.registrarGap('tudo bem', 'teste');
    knowledgeGap.registrarGap('oi', 'teste');
    expect(knowledgeGap.getEstatisticas().total).toBe(antes);
  });

  it('registra perguntas técnicas reais mesmo quando curtas', () => {
    const g1 = knowledgeGap.registrarGap('Qual é o procedimento para atualização do firmware?', 'teste');
    const g2 = knowledgeGap.registrarGap('me explica como reiniciar a switch core em caso de falha', 'teste');
    expect(g1).toBeTruthy();
    expect(g2).toBeTruthy();
  });
});

describe('semFonteDocumental - critério de gap', () => {
  const base = { contextoKB: '', ragResult: { hasContext: false }, resultadosFAQ: [] };

  it('fonte só-LLM sem nenhum lastro → candidata a gap', () => {
    expect(semFonteDocumental({ ...base, fonte: 'llm' })).toBe(true);
    expect(semFonteDocumental({ ...base, fonte: 'llm-cache' })).toBe(true);
    expect(semFonteDocumental({ ...base, fonte: 'llm-fallback' })).toBe(true);
    expect(semFonteDocumental({ ...base, fonte: 'llm-stream' })).toBe(true);
  });

  it('RAG com contexto → NÃO é gap', () => {
    expect(semFonteDocumental({ ...base, fonte: 'llm', ragResult: { hasContext: true } })).toBe(false);
  });

  it('KB com trecho específico (FAQ relevante) → NÃO é gap', () => {
    expect(semFonteDocumental({
      ...base,
      fonte: 'llm',
      contextoKB: '=== FAQ RELEVANTE ===\nQ: x\nA: y'
    })).toBe(false);
    expect(semFonteDocumental({
      ...base,
      fonte: 'llm',
      contextoKB: '\n=== DATA CENTERS RELEVANTES ===\nDC1'
    })).toBe(false);
  });

  it('FAQ fuzzy forte (>= 0.5) → NÃO é gap', () => {
    expect(semFonteDocumental({
      ...base,
      fonte: 'llm',
      resultadosFAQ: [{ pergunta: 'x', resposta: 'y', score: 0.7 }]
    })).toBe(false);
  });

  it('FAQ fuzzy fraca (< 0.5) → continua candidata a gap', () => {
    expect(semFonteDocumental({
      ...base,
      fonte: 'llm',
      resultadosFAQ: [{ pergunta: 'x', resposta: 'y', score: 0.25 }]
    })).toBe(true);
  });

  it('fontes documentais (faq, rag+llm, specialists, kb-fallback) → NUNCA são gap', () => {
    const fontesComLastro = [
      'faq', 'rag+llm', 'knowledge-base-fallback', 'knowledge-base-fallback-final',
      'specialist-locator', 'specialist-contact', 'specialist-directory',
      'specialist-region', 'specialist-availability', 'fallback', 'faq-literal'
    ];
    for (const fonte of fontesComLastro) {
      expect(semFonteDocumental({ ...base, fonte })).toBe(false);
    }
  });
});