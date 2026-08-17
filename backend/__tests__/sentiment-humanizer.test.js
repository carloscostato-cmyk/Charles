/**
 * Testes para SentimentClassifier e Humanizer
 * Cobre: sentiment-classifier.js, humanizer.js
 */
const {
  classificar,
  calcularIntensidade,
  gerarPromptEmpatia,
  gerarAjusteTom
} = require('../agents/sentiment-classifier');

const {
  humanizar,
  gerarSaudacao,
  adicionarEncerramento,
  precisaEncerramento
} = require('../agents/humanizer');

describe('SentimentClassifier - Classificação de Sentimento', () => {
  test('retorna neutro para mensagem vazia', () => {
    const result = classificar('');
    expect(result.sentimento).toBe('neutro');
    expect(result.intensidade).toBe(0);
    expect(result.urgencia).toBe(false);
    expect(result.frustracao).toBe(false);
  });

  test('detecta frustração', () => {
    const result = classificar('Isso não funciona, está completamente quebrado e é muito urgente!');
    expect(result.frustracao).toBe(true);
    expect(result.sentimento).toBe('frustrado');
  });

  test('detecta urgência', () => {
    const result = classificar('Preciso disso urgente, é crítico!');
    expect(result.urgencia).toBe(true);
    expect(result.sentimento).toBe('urgente');
  });

  test('detecta confusão', () => {
    const result = classificar('Não entendi, pode explicar melhor?');
    expect(result.sentimento).toBe('confuso');
  });

  test('detecta positividade', () => {
    const result = classificar('Obrigado, funcionou perfeitamente!');
    expect(result.sentimento).toBe('positivo');
    expect(result.confianca).toBe(0.8);
  });

  test('detecta animação com exclamações', () => {
    const result = classificar('Isso é incrível!!!');
    expect(result.sentimento).toBe('animado');
  });

  test('detecta curiosidade com perguntas', () => {
    const result = classificar('Como funciona? Onde fica? Quando?');
    expect(result.sentimento).toBe('curioso');
  });

  test('retorna neutro para mensagem normal', () => {
    const result = classificar('Qual o endereço do data center?');
    expect(result.sentimento).toBe('neutro');
    expect(result.intensidade).toBe(0.3);
  });

  test('calcularIntensidade com marcadores de alta intensidade', () => {
    const intensidade = calcularIntensidade('muito extremamente totalmente');
    expect(intensidade).toBeGreaterThan(0.5);
  });

  test('calcularIntensidade com repetição de caracteres', () => {
    const intensidade = calcularIntensidade('nããão');
    expect(intensidade).toBeGreaterThan(0);
  });

  test('calcularIntensidade com maiúsculas', () => {
    const intensidade = calcularIntensidade('ISSO É URGENTE');
    expect(intensidade).toBeGreaterThan(0);
  });

  test('gerarPromptEmpatia retorna vazio para neutro', () => {
    expect(gerarPromptEmpatia({ sentimento: 'neutro' })).toBe('');
    expect(gerarPromptEmpatia(null)).toBe('');
  });

  test('gerarPromptEmpatia para frustrado', () => {
    const prompt = gerarPromptEmpatia({ sentimento: 'frustrado' });
    expect(prompt).toContain('frustrado');
  });

  test('gerarPromptEmpatia para urgente', () => {
    const prompt = gerarPromptEmpatia({ sentimento: 'urgente' });
    expect(prompt).toContain('urgência');
  });

  test('gerarAjusteTom para urgência', () => {
    const ajuste = gerarAjusteTom({ urgencia: true, frustracao: false, sentimento: 'urgente' });
    expect(ajuste.formalidade).toBe('alto');
    expect(ajuste.profundidade).toBe('baixo');
  });

  test('gerarAjusteTom para frustração', () => {
    const ajuste = gerarAjusteTom({ urgencia: false, frustracao: true, sentimento: 'frustrado' });
    expect(ajuste.formalidade).toBe('medio');
  });

  test('gerarAjusteTom para positivo', () => {
    const ajuste = gerarAjusteTom({ urgencia: false, frustracao: false, sentimento: 'positivo' });
    expect(ajuste.humor).toBe('moderado');
  });

  test('gerarAjusteTom retorna padrão para null', () => {
    const ajuste = gerarAjusteTom(null);
    expect(ajuste.formalidade).toBe('normal');
    expect(ajuste.humor).toBe('nenhum');
  });
});

describe('Humanizer - Humanização de Respostas', () => {
  test('retorna resposta vazia para entrada vazia', () => {
    expect(humanizar('')).toBe('');
    expect(humanizar(null)).toBeNull();
  });

  test('capitaliza primeira letra', () => {
    const result = humanizar('resposta em minúsculo com texto suficiente para não adicionar expressão');
    expect(result.charAt(0)).toBe('R');
  });

  test('adiciona ponto final quando não tem pontuação', () => {
    const result = humanizar('resposta sem pontuação');
    expect(result.endsWith('.')).toBe(true);
  });

  test('não adiciona ponto quando já tem', () => {
    const result = humanizar('Resposta com ponto.');
    expect(result.endsWith('.')).toBe(true);
  });

  test('adiciona expressão especialista para resposta curta', () => {
    const result = humanizar('Sim');
    expect(result.length).toBeGreaterThan(2);
  });

  test('não adiciona expressão para continuação de conversa', () => {
    const result = humanizar('Sim', { isContinuacao: true });
    expect(result).toBe('Sim.');
  });

  test('gerarSaudacao sem período', () => {
    const saudacao = gerarSaudacao();
    expect(saudacao.length).toBeGreaterThan(0);
  });

  test('gerarSaudacao com período manhã', () => {
    expect(gerarSaudacao('manha')).toBe('Bom dia!');
  });

  test('gerarSaudacao com período tarde', () => {
    expect(gerarSaudacao('tarde')).toBe('Boa tarde!');
  });

  test('gerarSaudacao com período noite', () => {
    expect(gerarSaudacao('noite')).toBe('Boa noite!');
  });

  test('precisaEncerramento para resposta sem pontuação', () => {
    expect(precisaEncerramento('resposta sem ponto')).toBe(true);
  });

  test('precisaEncerramento para resposta com pergunta', () => {
    expect(precisaEncerramento('Você pode ajudar?')).toBe(true);
  });

  test('precisaEncerramento para resposta finalizada', () => {
    expect(precisaEncerramento('Resposta finalizada.')).toBe(false);
  });

  test('adicionarEncerramento para resposta sem encerramento', () => {
    const result = adicionarEncerramento('Resposta sem encerramento');
    expect(result.length).toBeGreaterThan('Resposta sem encerramento'.length);
  });

  test('adicionarEncerramento não modifica resposta finalizada', () => {
    const result = adicionarEncerramento('Resposta finalizada.');
    expect(result).toBe('Resposta finalizada.');
  });
});