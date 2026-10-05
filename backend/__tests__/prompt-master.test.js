/**
 * prompt-master.test.js
 *
 * Teste de fumaça do PROMPT MESTRE (fonte única).
 * Protege contra regressões já vividas: seções fora da template string,
 * ordem trocada, seções duplicadas/perdidas.
 * Também valida as 5 perguntas-âncora contra a FAQ real (retrieval).
 */

const fs = require('fs');
const path = require('path');
const { MASTER_SYSTEM_PROMPT, PROMPT_VERSION } = require('../prompts/prompt-master');
const { lerFAQ } = require('../faq-reader');
const { buscarNaFAQ } = require('../faq-search');
const { gerarPromptNaturalizado } = require('../agents/prompt-naturalizer-agent');

describe('Prompt Mestre - integridade estrutural', () => {
  const secoes = (MASTER_SYSTEM_PROMPT.match(/^## \d+\. .+$/gm) || []);

  it('exporta MASTER_SYSTEM_PROMPT e PROMPT_VERSION', () => {
    expect(typeof MASTER_SYSTEM_PROMPT).toBe('string');
    expect(MASTER_SYSTEM_PROMPT.length).toBeGreaterThan(10000);
    expect(PROMPT_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it('possui exatamente 26 seções numeradas', () => {
    expect(secoes).toHaveLength(26);
  });

  it('as seções estão em ordem crescente 1..26, sem duplicatas', () => {
    const numeros = secoes.map((s) => parseInt(s.match(/^## (\d+)/)[1], 10));
    expect(numeros).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });

  it('mantém os trechos críticos de segurança e operação', () => {
    const trechosCriticos = [
      '## 12. POLÍTICA ANTI-ALUCINAÇÃO',
      'Não encontrei evidência documental suficiente',
      '## 10. SEGURANÇA OPERACIONAL',
      '## 4. HIERARQUIA DAS FONTES',
      'Contexto técnico geral, não confirmado pela documentação interna',
      '## 9. CLASSIFICAÇÃO DE INCIDENTES',
      '## 14. NÍVEL DE CONFIANÇA',
      '## 26. REGRA FINAL'
    ];
    for (const trecho of trechosCriticos) {
      expect(MASTER_SYSTEM_PROMPT).toContain(trecho);
    }
  });

  it('termina com a Regra Final (sem conteúdo órfão após o fechamento)', () => {
    const ultimo = MASTER_SYSTEM_PROMPT.trim().split('\n').pop();
    expect(ultimo).toMatch(/identificação de lacuna documental/i);
  });

  it('o arquivo fonte não tem seção fora da template string', () => {
    const conteudo = fs.readFileSync(
      path.join(__dirname, '..', 'prompts', 'prompt-master.js'),
      'utf8'
    );
    const linhas = conteudo.split(/\r?\n/);
    const idxExport = linhas.findIndex((l) => l.startsWith('module.exports'));
    expect(idxExport).toBeGreaterThan(0);
    // Nada de "## N." pode existir após o module.exports
    const aposExport = linhas.slice(idxExport).join('\n');
    expect(aposExport).not.toMatch(/^## \d+\./m);
  });
});

describe('Prompt Mestre - adaptação por sentimento (naturalizer)', () => {
  it('usa o MASTER_SYSTEM_PROMPT como base', () => {
    const prompt = gerarPromptNaturalizado({ sentimento: 'neutro' });
    expect(prompt).toContain(MASTER_SYSTEM_PROMPT.substring(0, 200));
  });

  it('acrescenta contexto de urgência quando aplicável', () => {
    const prompt = gerarPromptNaturalizado({ sentimento: 'urgencia' });
    expect(prompt).toContain('CONTEXTO ATUAL');
    expect(prompt).toContain('urgência');
  });
});

describe('Perguntas-âncora - retrieval na FAQ real', () => {
  let faq;

  beforeAll(() => {
    faq = lerFAQ();
  });

  const ancortas = [
    'como dar acesso a novas pessoas no portal',
    'Qual o principal objetivo do modelo ITSM no Data Center?',
    'Como evitar falhas de governança no processo de mudança?',
    'O que fazer em caso de indisponibilidade do sistema de chamados (Znuny)?',
    'Qual o impacto de não registrar corretamente um incidente?'
  ];

  it('a FAQ real carrega pelo menos 100 itens', () => {
    expect(faq.length).toBeGreaterThanOrEqual(100);
  });

  it.each(ancortas)('encontra fonte documental para: "%s"', (pergunta) => {
    const resultados = buscarNaFAQ(pergunta, faq, 3);
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0].score).toBeGreaterThan(0.2);
    expect(resultados[0].resposta).toBeTruthy();
  });

  it('pergunta fora de escopo NÃO retorna falso positivo de fonte', () => {
    const resultados = buscarNaFAQ('Qual a receita do bolo de cenoura da vovó?', faq, 3);
    const forte = resultados.filter((r) => r.score > 0.5);
    expect(forte).toHaveLength(0);
  });
});