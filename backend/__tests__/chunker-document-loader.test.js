/**
 * Testes para Chunker e DocumentLoader
 * Cobre: chunker.js, document-loader.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Chunker - Divisão Inteligente de Texto', () => {
  const Chunker = require('../rag/chunker');

  test('retorna array vazio para texto vazio', () => {
    const chunker = new Chunker();
    expect(chunker.chunk('')).toEqual([]);
    expect(chunker.chunk('   ')).toEqual([]);
    expect(chunker.chunk(null)).toEqual([]);
  });

  test('retorna um único chunk para texto curto', () => {
    const chunker = new Chunker({ chunkSize: 500 });
    const result = chunker.chunk('Texto curto de exemplo');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Texto curto de exemplo');
    expect(result[0].metadata.chunkIndex).toBe(0);
    expect(result[0].metadata.totalChunks).toBe(1);
  });

  test('adiciona prefixo do nome do arquivo quando metadata.fileName existe', () => {
    const chunker = new Chunker({ chunkSize: 500 });
    const result = chunker.chunk('Conteúdo do documento', { fileName: 'teste.txt' });
    expect(result[0].content).toContain('[Documento: teste.txt]');
  });

  test('divide texto longo em múltiplos chunks', () => {
    const chunker = new Chunker({ chunkSize: 50, chunkOverlap: 10 });
    const longText = 'Esta é uma frase de exemplo com conteúdo suficiente para dividir em vários pedaços. '.repeat(20);
    const result = chunker.chunk(longText);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].metadata.totalChunks).toBe(result.length);
  });

  test('chunkQAItems cria chunks de Q&A', () => {
    const chunker = new Chunker();
    const items = [
      { pergunta: 'O que é um data center?', resposta: 'É uma infraestrutura.' },
      { pergunta: 'Onde fica?', resposta: 'Em São Paulo.' }
    ];
    const result = chunker.chunkQAItems(items, { source: 'faq' });
    expect(result).toHaveLength(2);
    expect(result[0].content).toContain('Pergunta:');
    expect(result[0].content).toContain('Resposta:');
    expect(result[0].metadata.type).toBe('qa');
    expect(result[0].metadata.source).toBe('faq');
  });

  test('chunkQAItems com metadata base', () => {
    const chunker = new Chunker();
    const result = chunker.chunkQAItems(
      [{ pergunta: 'P1', resposta: 'R1' }],
      { categoria: 'infra' }
    );
    expect(result[0].metadata.categoria).toBe('infra');
  });
});

describe('DocumentLoader - Carregamento de Arquivos', () => {
  const DocumentLoader = require('../rag/document-loader');
  const loader = new DocumentLoader();

  test('lança erro para arquivo inexistente', async () => {
    await expect(loader.loadFile('/caminho/inexistente.txt')).rejects.toThrow('Arquivo não encontrado');
  });

  test('carrega arquivo .txt', async () => {
    const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'Conteúdo de teste do arquivo');
    try {
      const result = await loader.loadFile(tmpFile);
      expect(result.content).toBe('Conteúdo de teste do arquivo');
      expect(result.metadata.extension).toBe('.txt');
      expect(result.metadata.type).toBe('text');
      expect(result.metadata.fileName).toContain('test-');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('carrega arquivo .md e remove formatação markdown', async () => {
    const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, '# Título\n\n**Negrito** e *itálico* e `código`\n\n[link](https://exemplo.com)');
    try {
      const result = await loader.loadFile(tmpFile);
      expect(result.metadata.type).toBe('markdown');
      expect(result.content).not.toContain('#');
      expect(result.content).not.toContain('**');
      expect(result.content).not.toContain('*');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('loadText retorna conteúdo com metadata', () => {
    const result = loader.loadText('Texto direto', { categoria: 'teste' });
    expect(result.content).toBe('Texto direto');
    expect(result.metadata.source).toBe('text');
    expect(result.metadata.categoria).toBe('teste');
    expect(result.metadata.size).toBe(12);
  });

  test('loadURL lança erro para URL inválida', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(loader.loadURL('https://exemplo.com/nao-existe')).rejects.toThrow('HTTP 404');
    global.fetch.mockRestore();
  });

  test('loadURL carrega e limpa HTML', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body><script>var x=1;</script><style>body{}</style><h1>Título</h1><p>Conteúdo</p></body></html>'
    });
    const result = await loader.loadURL('https://exemplo.com');
    expect(result.metadata.source).toBe('url');
    expect(result.content).toContain('Título');
    expect(result.content).toContain('Conteúdo');
    expect(result.content).not.toContain('<script>');
    expect(result.content).not.toContain('<style>');
    global.fetch.mockRestore();
  });
});