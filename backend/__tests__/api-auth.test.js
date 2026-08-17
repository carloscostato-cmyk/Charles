const http = require('http');

jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

process.env.ALLOW_ANONYMOUS = 'false';

const { app } = require('../server');

let server;
let baseUrl;

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(new URL(path, baseUrl), (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(body) }));
    }).on('error', reject);
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

describe('API authentication in production mode', () => {
  test('keeps /api/status public', async () => {
    const response = await request('/api/status');
    expect(response.status).toBe(200);
  });

  test('rejects protected routes without a bearer token', async () => {
    const response = await request('/api/agentes');

    expect(response.status).toBe(401);
    expect(response.json).toEqual(expect.objectContaining({ code: 'MISSING_TOKEN' }));
  });
});
