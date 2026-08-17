/**
 * Testes para Tools
 * Cobre: calculate-tool.js, system-status-tool.js, base-tool.js, tool-registry.js
 */
const CalculateTool = require('../tools/calculate-tool');
const SystemStatusTool = require('../tools/system-status-tool');
const BaseTool = require('../tools/base-tool');
const { ToolRegistry } = require('../tools/tool-registry');

describe('CalculateTool - Cálculo Matemático', () => {
  const tool = new CalculateTool();

  test('calcula soma simples', async () => {
    const result = await tool.execute({ expression: '2 + 3' });
    expect(result.result).toBe(5);
    expect(result.expression).toBe('2+3');
  });

  test('calcula expressão com precedência', async () => {
    const result = await tool.execute({ expression: '2 + 3 * 4' });
    expect(result.result).toBe(14);
  });

  test('calcula com parênteses', async () => {
    const result = await tool.execute({ expression: '(10 - 5) / 2' });
    expect(result.result).toBe(2.5);
  });

  test('calcula potência', async () => {
    const result = await tool.execute({ expression: '2 ^ 3' });
    expect(result.result).toBe(8);
  });

  test('calcula porcentagem', async () => {
    const result = await tool.execute({ expression: '100 * 0.15' });
    expect(result.result).toBe(15);
  });

  test('lança erro para expressão vazia', async () => {
    await expect(tool.execute({ expression: '   ' })).rejects.toThrow('Expressao matematica invalida');
  });

  test('lança erro para expressão inválida', async () => {
    await expect(tool.execute({ expression: 'abc' })).rejects.toThrow('Expressao matematica invalida');
  });

  test('formata resultado inteiro sem decimais', () => {
    expect(tool._formatResult(5)).toBe('5');
  });

  test('formata resultado decimal', () => {
    expect(tool._formatResult(2.5)).toBe('2.5');
  });
});

describe('SystemStatusTool - Status do Sistema', () => {
  const tool = new SystemStatusTool();

  test('retorna status online com informações básicas', async () => {
    const result = await tool.execute();
    expect(result.status).toBe('online');
    expect(result.uptime).toBeGreaterThan(0);
    expect(result.memory).toBeDefined();
    expect(result.memory.total).toContain('GB');
    expect(result.cpu).toBeDefined();
    expect(result.cpu.cores).toBeGreaterThan(0);
    expect(result.platform).toBeDefined();
    expect(result.hostname).toBeDefined();
  });

  test('retorna detalhes completos com detail=full', async () => {
    const result = await tool.execute({ detail: 'full' });
    expect(result.nodeVersion).toBeDefined();
    expect(result.pid).toBeDefined();
    expect(result.memoryProcess).toContain('MB');
  });

  test('retorna uptime formatado', async () => {
    const result = await tool.execute();
    expect(result.uptimeFormatted).toMatch(/^\d+h \d+m$/);
  });
});

describe('BaseTool - Classe Base', () => {
  class TestTool extends BaseTool {
    constructor() {
      super({
        name: 'TestTool',
        description: 'Ferramenta de teste',
        inputSchema: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            idade: { type: 'number' }
          },
          required: ['nome']
        }
      });
    }
    async execute(params) {
      return { ok: true, ...params };
    }
  }

  const tool = new TestTool();

  test('valida campo obrigatório ausente', () => {
    const validation = tool.validateInput({});
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Campo 'nome' é obrigatório");
  });

  test('valida campo obrigatório presente', () => {
    const validation = tool.validateInput({ nome: 'Carlos' });
    expect(validation.valid).toBe(true);
  });

  test('valida tipo de campo incorreto', () => {
    const validation = tool.validateInput({ nome: 'Carlos', idade: 'trinta' });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('deve ser number');
  });

  test('run retorna sucesso para execução válida', async () => {
    const result = await tool.run({ nome: 'Carlos', idade: 30 });
    expect(result.success).toBe(true);
    expect(result.result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.tool).toBe('TestTool');
  });

  test('run retorna erro de validação', async () => {
    const result = await tool.run({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validação falhou');
  });

  test('getDefinition retorna definição da ferramenta', () => {
    const def = tool.getDefinition();
    expect(def.name).toBe('TestTool');
    expect(def.description).toBe('Ferramenta de teste');
    expect(def.inputSchema).toBeDefined();
  });

  test('execute não implementado lança erro', async () => {
    const base = new BaseTool({ name: 'Base' });
    await expect(base.execute({})).rejects.toThrow('Método execute() deve ser implementado');
  });
});

describe('ToolRegistry - Registro de Ferramentas', () => {
  const registry = new ToolRegistry();

  test('registra ferramentas padrão', () => {
    const tools = registry.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(4);
    const names = tools.map(t => t.name);
    expect(names).toContain('CalculateTool');
    expect(names).toContain('CurrentDateTool');
    expect(names).toContain('SystemStatusTool');
    expect(names).toContain('SearchKnowledgeTool');
  });

  test('seleciona CalculateTool para expressão matemática', () => {
    const selections = registry.selectTools('quanto é 2 + 2?');
    expect(selections.some(s => s.tool === 'CalculateTool')).toBe(true);
  });

  test('seleciona CurrentDateTool para pergunta de data', () => {
    const selections = registry.selectTools('que dia é hoje?');
    expect(selections.some(s => s.tool === 'CurrentDateTool')).toBe(true);
  });

  test('seleciona SystemStatusTool para status do sistema', () => {
    const selections = registry.selectTools('como esta o sistema?');
    expect(selections.some(s => s.tool === 'SystemStatusTool')).toBe(true);
  });

  test('seleciona SearchKnowledgeTool para procedimentos', () => {
    const selections = registry.selectTools('qual o procedimento para acesso?');
    expect(selections.some(s => s.tool === 'SearchKnowledgeTool')).toBe(true);
  });

  test('executa ferramenta inexistente retorna erro', async () => {
    const result = await registry.executeTool('FerramentaInexistente');
    expect(result.success).toBe(false);
    expect(result.error).toContain('nao encontrada');
  });

  test('executa CurrentDateTool com sucesso', async () => {
    const result = await registry.executeTool('CurrentDateTool');
    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
  });

  test('getStats retorna estatísticas', () => {
    const stats = registry.getStats();
    expect(stats.registeredTools).toContain('CalculateTool');
    expect(stats.totalExecutions).toBeGreaterThanOrEqual(0);
  });

  test('unregister remove ferramenta', () => {
    registry.unregister('CalculateTool');
    expect(registry.getTool('CalculateTool')).toBeUndefined();
    registry.register(new CalculateTool());
  });
});