const http = require('http');

jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

const mockProcessarPergunta = jest.fn();
const mockProcessarPerguntaStream = jest.fn();

jest.mock('../llm-client', () => ({
  verificarLLM: jest.fn(),
  limparHistorico: jest.fn(),
  processarPergunta: (...args) => mockProcessarPergunta(...args),
  processarPerguntaStream: (...args) => mockProcessarPerguntaStream(...args)
}));

process.env.ALLOW_ANONYMOUS = 'true';

const { app } = require('../server');

let server;
let baseUrl;

function request(path, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {}
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(responseBody); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: responseBody, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

beforeAll((done) => {
  server = app.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll((done) => { server.close(done); });

describe('API contracts in development mode', () => {
  beforeEach(() => {
    mockProcessarPergunta.mockReset();
    mockProcessarPerguntaStream.mockReset();
  });

  test('GET /api/status returns the public health contract', async () => {
    const response = await request('/api/status');

    expect(response.status).toBe(200);
    expect(response.json).toEqual(expect.objectContaining({
      servidor: 'online',
      chatbot: 'Charles',
      versao: expect.any(String),
      seguranca: expect.any(Object),
      llm: expect.any(Object)
    }));
  });

  test('POST /api/chat rejects a missing message with a stable error contract', async () => {
    const response = await request('/api/chat', { method: 'POST', body: {} });

    expect(response.status).toBe(400);
    expect(response.json).toEqual(expect.objectContaining({
      erro: expect.any(String),
      resposta: expect.any(String),
      tipoResposta: expect.objectContaining({ tipo: 'conversacao', deveSerFalado: true })
    }));
  });

  test('POST /api/chat returns the response contract from the processing pipeline', async () => {
    mockProcessarPergunta.mockResolvedValue({
      resposta: 'O Data Center está disponível.',
      fonte: 'faq',
      qualidade: 98,
      routing: { intent: 'faq_direto', agentsUsed: ['faq-specialist'] },
      tools: [],
      model: { provider: 'FAQ', model: 'local' },
      trace: { traceId: 'test-trace' },
      tipoResposta: { tipo: 'informacao', deveSerFalado: true }
    });

    const response = await request('/api/chat', {
      method: 'POST',
      body: { mensagem: 'O Data Center está disponível?' }
    });

    expect(response.status).toBe(200);
    expect(response.json).toEqual(expect.objectContaining({
      pergunta: 'O Data Center está disponível?',
      resposta: 'O Data Center está disponível.',
      fonte: 'faq',
      qualidade: 98,
      tipoResposta: expect.objectContaining({ tipo: 'informacao', deveSerFalado: true })
    }));
    expect(mockProcessarPergunta).toHaveBeenCalledWith(
      'O Data Center está disponível?',
      expect.any(Array),
      'default'
    );
  });

  test('POST /api/chat/stream rejects a missing message before opening SSE', async () => {
    const response = await request('/api/chat/stream', { method: 'POST', body: {} });

    expect(response.status).toBe(400);
    expect(response.json).toEqual(expect.objectContaining({ erro: expect.any(String) }));
  });

  test('POST /api/chat/stream returns an SSE response from the streaming pipeline', async () => {
    mockProcessarPerguntaStream.mockImplementation(async (pergunta, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`event: token\ndata: ${JSON.stringify({ text: `Resposta: ${pergunta}` })}\n\n`);
      res.end('event: done\ndata: {}\n\n');
    });

    const response = await request('/api/chat/stream', {
      method: 'POST',
      body: { mensagem: 'Teste de streaming' }
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('event: token');
    expect(response.body).toContain('Resposta: Teste de streaming');
    expect(response.body).toContain('event: done');
    expect(mockProcessarPerguntaStream).toHaveBeenCalledWith(
      'Teste de streaming',
      expect.anything(),
      expect.any(Array),
      'default'
    );
  });
});
