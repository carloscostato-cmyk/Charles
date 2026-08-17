const http = require('http');

jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

process.env.ALLOW_ANONYMOUS = 'false';
process.env.REQUIRE_MFA = 'false';

jest.mock('../middleware/entra-id-auth', () => {
  const actual = jest.requireActual('../middleware/entra-id-auth');

  return {
    ...actual,
    authenticationMiddleware: (req, res, next) => {
      req.user = {
        authenticated: true,
        anonymous: false,
        oid: 'rbac-test-user',
        role: req.headers['x-test-role'] || 'usuario',
        displayName: 'RBAC Test User'
      };
      req.tokenPayload = {};
      next();
    }
  };
});

const { app } = require('../server');

let server;
let baseUrl;

function request(path, { method = 'GET', role = 'usuario', body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(new URL(path, baseUrl), {
      method,
      headers: {
        'X-Test-Role': role,
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      }
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(responseBody) }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

beforeAll((done) => {
  server = app.listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => { server.close(done); });

describe('RBAC contracts for sensitive API endpoints', () => {
  test.each([
    ['POST', '/api/rag/index-text', { text: 'conteúdo de teste' }],
    ['DELETE', '/api/rag/clear', null],
    ['POST', '/api/memory/reset', null],
    ['GET', '/api/observability/dashboard', null]
  ])('denies a standard user on %s %s', async (method, path, body) => {
    const response = await request(path, { method, body });

    expect(response.status).toBe(403);
    expect(response.json).toEqual(expect.objectContaining({
      code: 'INSUFFICIENT_PERMISSIONS',
      userRole: 'usuario'
    }));
  });

  test('allows a gerente to reset memory but not access the admin dashboard', async () => {
    const reset = await request('/api/memory/reset', { method: 'POST', role: 'gerente' });
    const dashboard = await request('/api/observability/dashboard', { role: 'gerente' });

    expect(reset.status).toBe(200);
    expect(dashboard.status).toBe(403);
    expect(dashboard.json).toEqual(expect.objectContaining({
      code: 'INSUFFICIENT_PERMISSIONS',
      userRole: 'gerente'
    }));
  });
});
