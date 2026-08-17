/**
 * Testes para Memory e Voice
 * Cobre: short-term-memory.js, memory-manager.js, response-consolidator.js,
 *        cancellation-token.js, voice-session-manager.js
 */
const ShortTermMemory = require('../memory/short-term-memory');
const { MemoryManager } = require('../memory/memory-manager');
const { ResponseConsolidator } = require('../voice/response-consolidator');
const { CancellationToken } = require('../voice/cancellation-token');
const { VoiceSessionManager } = require('../voice/voice-session-manager');

describe('ShortTermMemory - Memória de Curto Prazo', () => {
  let memory;

  beforeEach(() => {
    memory = new ShortTermMemory(3);
  });

  test('adiciona e recupera interação', () => {
    memory.add('user1', 'Pergunta 1', 'Resposta 1');
    const recent = memory.getRecent('user1');
    expect(recent).toHaveLength(1);
    expect(recent[0].pergunta).toBe('Pergunta 1');
    expect(recent[0].resposta).toBe('Resposta 1');
  });

  test('limita número de interações', () => {
    memory.add('user1', 'P1', 'R1');
    memory.add('user1', 'P2', 'R2');
    memory.add('user1', 'P3', 'R3');
    memory.add('user1', 'P4', 'R4');
    const recent = memory.getRecent('user1');
    expect(recent).toHaveLength(3);
    expect(recent[0].pergunta).toBe('P2');
  });

  test('getRecent retorna últimas N interações', () => {
    memory.add('user1', 'P1', 'R1');
    memory.add('user1', 'P2', 'R2');
    memory.add('user1', 'P3', 'R3');
    const recent = memory.getRecent('user1', 2);
    expect(recent).toHaveLength(2);
    expect(recent[0].pergunta).toBe('P2');
  });

  test('getAll retorna todo histórico', () => {
    memory.add('user1', 'P1', 'R1');
    memory.add('user1', 'P2', 'R2');
    expect(memory.getAll('user1')).toHaveLength(2);
  });

  test('getAll retorna vazio para usuário sem sessão', () => {
    expect(memory.getAll('inexistente')).toEqual([]);
  });

  test('getContextPrompt gera prompt com histórico', () => {
    memory.add('user1', 'Qual o endereço?', 'Rua X');
    const prompt = memory.getContextPrompt('user1');
    expect(prompt).toContain('## Histórico da Conversa:');
    expect(prompt).toContain('Usuário: Qual o endereço?');
    expect(prompt).toContain('Charles: Rua X');
  });

  test('getContextPrompt retorna vazio sem histórico', () => {
    expect(memory.getContextPrompt('user1')).toBe('');
  });

  test('isContinuation detecta continuação', () => {
    memory.add('user1', 'Qual o endereço?', 'Rua X');
    expect(memory.isContinuation('user1', 'e qual o telefone?')).toBe(true);
  });

  test('isContinuation retorna false sem histórico', () => {
    expect(memory.isContinuation('user1', 'e qual o telefone?')).toBe(false);
  });

  test('clear remove sessão do usuário', () => {
    memory.add('user1', 'P1', 'R1');
    memory.clear('user1');
    expect(memory.getAll('user1')).toEqual([]);
  });

  test('clearAll remove todas as sessões', () => {
    memory.add('user1', 'P1', 'R1');
    memory.add('user2', 'P2', 'R2');
    memory.clearAll();
    expect(memory.getStats().activeSessions).toBe(0);
  });

  test('getStats retorna estatísticas', () => {
    memory.add('user1', 'P1', 'R1');
    memory.add('user1', 'P2', 'R2');
    memory.add('user2', 'P3', 'R3');
    const stats = memory.getStats();
    expect(stats.activeSessions).toBe(2);
    expect(stats.totalInteractions).toBe(3);
    expect(stats.maxInteractions).toBe(3);
  });
});

describe('MemoryManager - Gerenciador de Memória', () => {
  test('remember e recall funcionam', async () => {
    const manager = new MemoryManager();
    await manager.remember('user1', 'Qual o endereço?', 'Rua X');
    const context = await manager.recall('user1', 'Qual o endereço?');
    expect(context.history).toBeDefined();
    expect(context.facts).toBeDefined();
    expect(context.summary).toBeDefined();
  });

  test('newSession limpa short-term', async () => {
    const manager = new MemoryManager();
    await manager.remember('user1', 'P1', 'R1');
    await manager.newSession('user1');
    expect(manager.shortTerm.getAll('user1')).toEqual([]);
  });

  test('getStats retorna estatísticas', async () => {
    const manager = new MemoryManager();
    const stats = await manager.getStats();
    expect(stats.shortTerm).toBeDefined();
    expect(stats.longTerm).toBeDefined();
    expect(stats.semantic).toBeDefined();
  });
});

describe('ResponseConsolidator - Consolidação de Respostas', () => {
  const consolidator = new ResponseConsolidator();

  test('consolida resposta direta sem tools', async () => {
    const result = await consolidator.consolidate('qual o endereço?', []);
    expect(result.source).toBe('direct');
    expect(result.confidence).toBe(0.85);
    expect(result.readyForTTS).toBe(true);
  });

  test('consolida resposta com tool result', async () => {
    const result = await consolidator.consolidate('qual o endereço?', [
      { success: true, data: { resposta: 'Rua X, 100' } }
    ]);
    expect(result.source).toBe('tool-result');
    expect(result.confidence).toBe(0.95);
    expect(result.text).toBe('Rua X, 100');
  });

  test('consolida com erro e fallback', async () => {
    const result = await consolidator.consolidate('qual o endereço?', [
      { error: true, message: 'Falha na busca' },
      { fallback: true, message: 'Usando fallback' }
    ]);
    expect(result.source).toBe('partial-fallback');
    expect(result.confidence).toBe(0.7);
  });

  test('consolida com erro apenas', async () => {
    const result = await consolidator.consolidate('qual o endereço?', [
      { error: true, message: 'Falha na busca' }
    ]);
    expect(result.source).toBe('error-fallback');
    expect(result.confidence).toBe(0.6);
  });

  test('buildDirectResponse para download', async () => {
    const text = await consolidator.buildDirectResponse('quero baixar o arquivo');
    expect(text).toContain('download');
  });

  test('buildDirectResponse para notícias', async () => {
    const text = await consolidator.buildDirectResponse('quero ver notícias');
    expect(text).toContain('notícias');
  });

  test('buildDirectResponse para pesquisa', async () => {
    const text = await consolidator.buildDirectResponse('faça uma pesquisa');
    expect(text).toContain('pesquisa');
  });

  test('buildDirectResponse genérico', async () => {
    const text = await consolidator.buildDirectResponse('olá');
    expect(text).toContain('Entendi');
  });

  test('calculateConfidence sem tools', () => {
    expect(consolidator.calculateConfidence([])).toBe(0.7);
  });

  test('calculateConfidence com sucesso', () => {
    expect(consolidator.calculateConfidence([{ success: true }])).toBe(0.95);
  });

  test('calculateConfidence com fallback', () => {
    expect(consolidator.calculateConfidence([{ fallback: true }])).toBe(0.75);
  });

  test('calculateConfidence com erro', () => {
    expect(consolidator.calculateConfidence([{ error: true }])).toBe(0.6);
  });
});

describe('CancellationToken - Token de Cancelamento', () => {
  test('inicia não cancelado', () => {
    const token = new CancellationToken();
    expect(token.isCancelled()).toBe(false);
    expect(token.getReason()).toBeNull();
  });

  test('cancel marca como cancelado', () => {
    const token = new CancellationToken();
    token.cancel('USER_REQUEST');
    expect(token.isCancelled()).toBe(true);
    expect(token.getReason()).toBe('USER_REQUEST');
  });

  test('onCancel registra listener', () => {
    const token = new CancellationToken();
    const listener = jest.fn();
    token.onCancel(listener);
    token.cancel('TEST');
    expect(listener).toHaveBeenCalledWith('TEST');
  });

  test('onCancel retorna função de unsubscribe', () => {
    const token = new CancellationToken();
    const listener = jest.fn();
    const unsubscribe = token.onCancel(listener);
    unsubscribe();
    token.cancel('TEST');
    expect(listener).not.toHaveBeenCalled();
  });

  test('reset limpa estado', () => {
    const token = new CancellationToken();
    token.cancel('TEST');
    token.reset();
    expect(token.isCancelled()).toBe(false);
    expect(token.getReason()).toBeNull();
  });

  test('listener com erro não quebra cancelamento', () => {
    const token = new CancellationToken();
    token.onCancel(() => { throw new Error('erro'); });
    expect(() => token.cancel('TEST')).not.toThrow();
  });
});

describe('VoiceSessionManager - Gerenciador de Sessão de Voz', () => {
  test('inicia em estado IDLE', () => {
    const manager = new VoiceSessionManager();
    expect(manager.getState()).toBe('IDLE');
  });

  test('isSpeaking retorna false inicialmente', () => {
    const manager = new VoiceSessionManager();
    expect(manager.isSpeaking()).toBe(false);
  });

  test('isProcessing retorna false inicialmente', () => {
    const manager = new VoiceSessionManager();
    expect(manager.isProcessing()).toBe(false);
  });

  test('reset limpa estado', () => {
    const manager = new VoiceSessionManager();
    manager.reset();
    expect(manager.getState()).toBe('IDLE');
    expect(manager.active).toBe(false);
  });

  test('handleUserInterruption cancela e limpa fila', async () => {
    const manager = new VoiceSessionManager();
    const result = await manager.handleUserInterruption();
    expect(result.action).toBe('RESET_TO_LISTENING');
    expect(result.reason).toBe('USER_INTERRUPT');
  });

  test('handleUserStop chama handleUserInterruption', async () => {
    const manager = new VoiceSessionManager();
    const result = await manager.handleUserStop();
    expect(result.action).toBe('RESET_TO_LISTENING');
  });

  test('setTTSStreamer define streamer', () => {
    const manager = new VoiceSessionManager();
    const streamer = { speak: jest.fn() };
    manager.setTTSStreamer(streamer);
    expect(manager.ttsStreamer).toBe(streamer);
  });
});