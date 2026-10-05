/**
 * security-middleware.js
 *
 * Camada de hardening de segurança para o servidor Express.
 * Inclui: CORS restritivo, Rate Limiting, Validação de entrada,
 * PII Scrubber (LGPD), e proteção contra Prompt Injection.
 *
 * FASE 1 - Segurança básica
 */

const cors = require('cors');

// ============ CORS RESTRITIVO ============

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001').split(',').map(o => o.trim());

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[Security] CORS bloqueado para origin: ${origin}`);
      callback(new Error('Origem não permitida pela política CORS corporativa.'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400 // Cache preflight por 24h
};

const corsMiddleware = cors(corsOptions);

// ============ RATE LIMITING ============

// Rate limiter simples sem dependência externa
class SimpleRateLimiter {
  constructor(windowMs = 60000, maxRequests = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map();

    // Limpa clientes expirados a cada 5 minutos
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.clients) {
        if (now - data.windowStart > this.windowMs * 2) {
          this.clients.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      const clientKey = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();

      if (!this.clients.has(clientKey)) {
        this.clients.set(clientKey, { windowStart: now, count: 1 });
        return next();
      }

      const client = this.clients.get(clientKey);

      // Resetar janela se expirou
      if (now - client.windowStart > this.windowMs) {
        client.windowStart = now;
        client.count = 1;
        return next();
      }

      client.count++;

      if (client.count > this.maxRequests) {
        console.warn(`[Security] Rate limit excedido para ${clientKey}: ${client.count} requisições`);
        return res.status(429).json({
          error: 'Limite de requisições excedido. Aguarde 1 minuto antes de tentar novamente.',
          retryAfter: Math.ceil((client.windowStart + this.windowMs - now) / 1000)
        });
      }

      next();
    };
  }
}

// 60 requisições por minuto por IP
const rateLimiter = new SimpleRateLimiter(60 * 1000, 60);
const apiLimiter = rateLimiter.middleware();

// ============ PII SCRUBBER (LGPD) ============

class PIIScrubber {
  static sanitize(text) {
    if (typeof text !== 'string') return text;

    let sanitized = text;

    // Cartão de crédito ANTES do telefone: a sequência de 13-19 dígitos
    // contém padrão que a regra de telefone consumiria primeiro,
    // produzindo "[TELEFONE_REDACTED] [TELEFONE_REDACTED]" em vez de
    // "[CARTAO_REDACTED]".
    sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
      const digits = match.replace(/\D/g, '');
      if (/^[3456]/.test(digits) && digits.length >= 13) {
        return '[CARTAO_REDACTED]';
      }
      return match;
    });

    // CPF: 000.000.000-00 ou 00000000000
    sanitized = sanitized.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REDACTED]');

    // CNPJ: 00.000.000/0000-00
    sanitized = sanitized.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ_REDACTED]');

    // E-mail
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      '[EMAIL_REDACTED]'
    );

    // Telefone BR: (11) 99999-9999, 11 99999-9999, +55 11 99999-9999
    sanitized = sanitized.replace(
      /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?\d{4}|\d{4})[-\s]?\d{4}\b/g,
      '[TELEFONE_REDACTED]'
    );

    return sanitized;
  }
}

// ============ PROMPT INJECTION GUARD ============

class PromptInjectionGuard {
  static SUSPICIOUS_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now\s+(DAN|jailbroken|unrestricted)/i,
    /system\s*:\s*you\s+are/i,
    /\bact\s+as\s+(if|a|an)\b.*\b(system|admin|root)\b/i,
    /reveal\s+(your|the)\s+(system\s+)?prompt/i,
    /print\s+(your|the)\s+(system\s+)?prompt/i,
    /forget\s+(all|everything|your)\s+(instructions|rules|guidelines)/i,
    /ignorar?\s+(todas?\s+)?(as\s+)?instru[cç][oõ]es\s+(anteriores|previas)/i,
    /revela(r)?\s+(seu|o)\s+prompt\s+(de\s+)?sistema/i
  ];

  static check(text) {
    if (typeof text !== 'string') return { safe: true };

    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(text)) {
        console.warn(`[Security] Prompt injection detectado: ${text.substring(0, 100)}...`);
        return {
          safe: false,
          pattern: pattern.toString(),
          sanitized: text.replace(pattern, '[BLOCKED]')
        };
      }
    }

    return { safe: true };
  }
}

// ============ INPUT VALIDATION MIDDLEWARE ============

function inputValidationMiddleware(req, res, next) {
  if (req.method === 'POST' && req.body) {
    // Valida campo pergunta se presente
    if (req.body.pergunta !== undefined) {
      if (typeof req.body.pergunta !== 'string') {
        return res.status(400).json({ error: 'O campo "pergunta" deve ser uma string.' });
      }

      if (req.body.pergunta.length > 5000) {
        return res.status(400).json({ error: 'Pergunta excede o tamanho máximo permitido (5000 caracteres).' });
      }

      if (req.body.pergunta.trim().length === 0) {
        return res.status(400).json({ error: 'Pergunta não pode estar vazia.' });
      }

      // Sanitiza PII
      req.body.pergunta = PIIScrubber.sanitize(req.body.pergunta);

      // Verifica prompt injection
      const injectionCheck = PromptInjectionGuard.check(req.body.pergunta);
      if (!injectionCheck.safe) {
        req.body.pergunta = injectionCheck.sanitized;
        req.promptInjectionDetected = true;
      }
    }

    // Também sanitiza "mensagem" (endpoint /api/chat)
    if (req.body.mensagem !== undefined && typeof req.body.mensagem === 'string') {
      if (req.body.mensagem.length > 5000) {
        return res.status(400).json({ error: 'Mensagem excede o tamanho máximo permitido (5000 caracteres).' });
      }

      req.body.mensagem = PIIScrubber.sanitize(req.body.mensagem);

      const injectionCheck = PromptInjectionGuard.check(req.body.mensagem);
      if (!injectionCheck.safe) {
        req.body.mensagem = injectionCheck.sanitized;
        req.promptInjectionDetected = true;
      }
    }
  }

  next();
}

// ============ SECURITY HEADERS ============

function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// ============ AUDIT LOGGER ============

function auditLogMiddleware(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function(...args) {
    const duration = Date.now() - start;

    // Loga apenas rotas de API (não estáticos)
    if (req.path.startsWith('/api/')) {
      console.log(`[Audit] ${req.method} ${req.path} ${res.statusCode} ${duration}ms [${req.ip}]`);
    }

    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Calcula o nível de segurança atual do sistema (0-10).
 * @param {Object} authConfig - config do entra-id-auth
 */
function getSecurityStatus(authConfig = {}) {
  const controles = {
    corsRestritivo: true,
    rateLimit: true,
    securityHeaders: true,
    piiScrubber: true,
    promptInjectionGuard: true,
    auditLog: true,
    tlsVerificado: process.env.ALLOW_INSECURE_TLS !== 'true',
    autenticacaoEntraId: authConfig.allowAnonymous !== true,
    rbac: true,
    mfaOpcional: process.env.REQUIRE_MFA === 'true'
  };

  let pontos = 0;
  const max = 10;

  if (controles.corsRestritivo) pontos += 1;
  if (controles.rateLimit) pontos += 1;
  if (controles.securityHeaders) pontos += 0.5;
  if (controles.piiScrubber) pontos += 1;
  if (controles.promptInjectionGuard) pontos += 1;
  if (controles.auditLog) pontos += 0.5;
  if (controles.tlsVerificado) pontos += 1.5;
  if (controles.rbac) pontos += 1;
  if (controles.autenticacaoEntraId) pontos += 2;
  if (controles.mfaOpcional) pontos += 0.5;

  const nivel = Math.min(max, Math.round(pontos * 10) / 10);
  const modo = controles.autenticacaoEntraId ? 'producao' : 'desenvolvimento';

  return {
    nivel,
    maximo: max,
    modo,
    resumo: controles.autenticacaoEntraId
      ? 'Entra ID obrigatório + hardening ativo'
      : 'Hardening ativo (ALLOW_ANONYMOUS=true — ative auth em produção)',
    autenticacao: controles.autenticacaoEntraId
      ? 'Microsoft Entra ID (obrigatória)'
      : 'Anônima permitida (desenvolvimento)',
    controles,
    recomendacoes: [
      ...(!controles.autenticacaoEntraId ? ['Defina ALLOW_ANONYMOUS=false e configure AZURE_TENANT_ID / AZURE_CLIENT_ID'] : []),
      ...(!controles.tlsVerificado ? ['Remova ALLOW_INSECURE_TLS=true quando o proxy corporativo permitir'] : []),
      ...(!controles.mfaOpcional ? ['Considere REQUIRE_MFA=true para rotas administrativas'] : [])
    ]
  };
}

module.exports = {
  corsMiddleware,
  apiLimiter,
  inputValidationMiddleware,
  securityHeadersMiddleware,
  auditLogMiddleware,
  getSecurityStatus,
  PIIScrubber,
  PromptInjectionGuard
};
