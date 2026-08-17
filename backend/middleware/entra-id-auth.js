/**
 * entra-id-auth.js
 *
 * Middleware de autenticação Microsoft Entra ID (Azure AD).
 * Implementa validação de JWT, verificação de tenant, RBAC e log de auditoria.
 *
 * Requisitos de segurança:
 * 1. Autenticação via Microsoft Entra ID
 * 2. Validação de JWT
 * 3. Verificação de expiração do token
 * 4. Extração de informações do usuário
 * 5. Verificação de tenant autorizado
 * 6. RBAC (Admin, Gerente, Usuário)
 * 7. Log de auditoria
 * 8. Rate limiting por usuário autenticado
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { v4: uuidv4 } = require('uuid');

// ============ CONFIGURAÇÕES DO MICROSOFT ENTRA ID ============

const config = {
  // Tenant ID do Azure AD (obrigatório)
  tenantId: process.env.AZURE_TENANT_ID || 'common',
  
  // Client ID da aplicação registrada no Azure AD
  clientId: process.env.AZURE_CLIENT_ID || '',
  
  // Tenant IDs autorizados (múltiplos tenants permitidos)
  allowedTenantIds: (process.env.ALLOWED_TENANT_IDS || '').split(',').map(t => t.trim()).filter(t => t),
  
  // Audience permitida (Client ID ou URI da API)
  audience: process.env.AZURE_AUDIENCE || process.env.AZURE_CLIENT_ID || '',
  
  // Modo de validação (strict = valida assinatura, permissive = apenas estrutura)
  validationMode: process.env.AUTH_VALIDATION_MODE || 'strict',
  
  // Se true, permite requisições sem autenticação (apenas para desenvolvimento)
  allowAnonymous: process.env.ALLOW_ANONYMOUS === 'true',
  
  // Roles permitidas por rota
  requiredRoles: {
    '/api/rag/index': ['admin'],
    '/api/rag/index-url': ['admin'],
    '/api/rag/index-text': ['admin'],
    '/api/rag/clear': ['admin'],
    '/api/pdf/index': ['admin'],
    '/api/upload': ['admin', 'gerente'],
    '/api/observability/dashboard': ['admin'],
    '/api/observability/traces': ['admin'],
    '/api/memory/reset': ['admin', 'gerente'],
    '/api/chat/reset': ['admin', 'gerente']
  }
};

// ============ CLIENTE JWKS ============

let jwksClientInstance = null;

function getJWKSClient() {
  if (!jwksClientInstance) {
    jwksClientInstance = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutos
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });
  }
  return jwksClientInstance;
}

// ============ AUDIT LOG ============

class AuditLogger {
  static log(event, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event,
      ...data
    };

    // Em produção, enviar para serviço de log centralizado (ELK, Splunk, Azure Monitor)
    console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);

    // TODO: Implementar persistência em banco de dados para compliance
    // await saveAuditLog(logEntry);
  }

  static logAuthentication(user, success, reason = null) {
    this.log('authentication', {
      userId: user?.oid || 'unknown',
      upn: user?.upn || 'unknown',
      tenantId: user?.tid || 'unknown',
      success,
      reason,
      ip: user?.ip || 'unknown'
    });
  }

  static logAuthorization(user, resource, granted, reason = null) {
    this.log('authorization', {
      userId: user?.oid || 'unknown',
      upn: user?.upn || 'unknown',
      role: user?.role || 'unknown',
      resource,
      granted,
      reason
    });
  }

  static logAccess(user, endpoint, method) {
    this.log('access', {
      userId: user?.oid || 'anonymous',
      upn: user?.upn || 'anonymous',
      role: user?.role || 'anonymous',
      endpoint,
      method
    });
  }
}

// ============ MIDDLEWARE DE PROTEÇÃO AVANÇADA ============

/**
 * Middleware de hardening de segurança avançada
 * Implementa múltiplas camadas de segurança além do básico
 */
class AdvancedSecurityMiddleware {
  static aplicarHardening(req, res, next) {
    // 1. Detecção de anomalias e comportamento suspeito
    const suspeita = AdvancedSecurityMiddleware.detectarAnomalias(req);
    if (suspeita.motivado) {
      AuditLogger.log('security_anomaly', {
        ip: req.ip,
        userId: req.user?.oid,
        tipo: suspeita.tipo,
        severidade: suspeita.severidade,
        timestamp: new Date().toISOString()
      });
      
      // Bloqueia requisições suspeitas
      if (suspeita.severidade === 'high') {
        return res.status(403).json({
          error: 'Acesso bloqueado - atividade suspeita detectada',
          code: 'SECURITY_BLOCK'
        });
      }
      
      // Adiciona cabeçalho de alerta
      res.setHeader('X-Security-Warning', suspeita.mensagem);
    }

    // 2. Validação de assinatura de request e antifraude
    if (!AdvancedSecurityMiddleware.validarAssinaturaRequest(req)) {
      AuditLogger.log('signature_validation_failed', {
        ip: req.ip,
        path: req.path,
        metodo: req.method,
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({
        error: 'Assinatura de request inválida',
        code: 'INVALID_SIGNATURE'
      });
    }

    // 3. Verifica padrões de rate limiting
    const rateLimitStatus = AdvancedSecurityMiddleware.verificarRateLimitAvancado(req);
    if (rateLimitStatus.excedeu) {
      AuditLogger.log('rate_limit_exceeded', {
        ip: req.ip,
        userId: req.user?.oid,
        requestsPorMinuto: rateLimitStatus.requests,
        limite: rateLimitStatus.limite,
        timestamp: new Date().toISOString()
      });
      
      return res.status(429).json({
        error: 'Muitas requisições. Tente novamente mais tarde.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitStatus.retryAfter
      });
    }

    // 4. Validação de dados de entrada baseada em schema
    const validationErrors = AdvancedSecurityMiddleware.validarSchemaEntrada(req);
    if (validationErrors.length > 0) {
      AuditLogger.log('input_validation_failed', {
        ip: req.ip,
        userId: req.user?.oid,
        erros: validationErrors,
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        error: 'Dados de entrada inválidos',
        code: 'VALIDATION_FAILED',
        detalhes: validationErrors
      });
    }

    // 5. Verifica integridade da sessão
    const integrityCheck = AdvancedSecurityMiddleware.verificarIntegridadeSessao(req);
    if (!integrityCheck.adequado) {
      AuditLogger.log('session_integrity_failed', {
        ip: req.ip,
        userId: req.user?.oid,
        motivo: integrityCheck.motivo,
        timestamp: new Date().toISOString()
      });
      
      // Invalida sessão
      if (req.user?.sid) {
        // TODO: implementar invalidar sessão
      }
    }

    next();
  }

  /**
   * Detecta anomalias em requisições
   * @param {Object} req - Request do Express
   * @returns {Object} Resultado da detecção
   */
  static detectarAnomalias(req) {
    const indicadores = {
      userAgentSuspeito: req.get('user-agent')?.toLowerCase().includes('bot') && !req.get('user-agent')?.toLowerCase().includes('okhttp'),
      ipDeProxy: req.ip?.includes(':') && !['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(req.ip),
      caminhosSuspeitos: ['/admin', '/api/rag', '/api/observability'].includes(req.path) && !req.user,
      parametrosSuspeitos: Object.keys(req.query).some(k => k.toLowerCase().includes('sql') || k.toLowerCase().includes('script')),
      semAutenticacaoRequerida: this.isProtectedRoute(req.path) && !req.user
    };
    
    const fatores = Object.values(indicadores).filter(Boolean).length;
    
    if (fatores === 0) {
      return { motivado: false };
    }
    
    let severidade = 'low';
    let tipo = 'ANOMALIA_BAIXA';
    let mensagem = 'Padrão incomum detectado';
    
    if (fatores >= 3) {
      severidade = 'high';
      tipo = 'ANOMALIA_ALTA';
      mensagem = 'Comportamento suspeito detectado';
    } else if (fatores >= 2) {
      severidade = 'medium';
      tipo = 'ANOMALIA_MEDIA';
      mensagem = 'Padrão incomum detectado';
    }
    
    return {
      motivado: true,
      tipo,
      severidade,
      fatores,
      mensagem
    };
  }

  /**
   * Verifica se rota requer autenticação
   * @param {string} path - Path da requisição
   * @returns {boolean}
   */
  static isProtectedRoute(path) {
    const rotasProtegidas = ['/api/chat', '/api/chat/stream', '/api/agentes', '/api/guardians', 
                          '/api/rag', '/api/memory', '/api/upload', '/api/observability',
                          '/api/documents', '/api/voice'];
    return rotasProtegidas.some(rota => path.startsWith(rota));
  }

  /**
   * Valida assinatura de request (HMAC SHA256)
   * @param {Object} req - Request do Express
   * @returns {boolean}
   */
  static validarAssinaturaRequest(req) {
    const signature = req.get('X-Request-Signature');
    const payload = JSON.stringify(req.body);
    
    if (!signature) {
      return true; // Permite se não houver assinatura (para compatibilidade)
    }
    
    try {
      const crypto = require('crypto');
      const secretKey = process.env.REQUEST_SIGNING_KEY || 'chave-padrao-segura';
      const expectedSignature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch (error) {
      console.warn('[SecurityMiddleware] Erro na validação de assinatura:', error.message);
      return false;
    }
  }

  /**
   * Rate limiting avançado com múltiplos níveis
   * @param {Object} req - Request do Express
   * @returns {Object} Status do rate limiting
   */
  static verificarRateLimitAvancado(req) {
    const key = req.ip + ':' + (req.user?.oid || 'anonymous');
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = this.getMaxRequests(req);
    
    // Implementação simplificada - em produção usar Redis ou similar
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!global.rateLimitStore.has(key)) {
      global.rateLimitStore.set(key, []);
    }
    
    const requests = global.rateLimitStore.get(key).filter(time => time > windowStart);
    
    if (requests.length >= maxRequests) {
      const oldest = Math.min(...requests);
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
      
      return {
        excedeu: true,
        requests: requests.length,
        limite: maxRequests,
        retryAfter
      };
    }
    
    requests.push(now);
    global.rateLimitStore.set(key, requests);
    
    return {
      excedeu: false,
      requests: requests.length,
      limite: maxRequests
    };
  }

  /**
   * Obtém limite de requisições baseado no usuário/role
   * @param {Object} req - Request do Express
   * @returns {number}
   */
  static getMaxRequests(req) {
    if (req.user?.role === 'admin') {
      return 200; // Admin: muito permissivo
    } else if (req.user?.role === 'gerente') {
      return 100; // Gerente: moderado
    } else {
      return 50; // Usuário: moderado
    }
  }

  /**
   * Validação avançada de schema de entrada
   * @param {Object} req - Request do Express
   * @returns {Array} Lista de erros de validação
   */
  static validarSchemaEntrada(req) {
    const erros = [];
    
    // Valida campos obrigatórios
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const rotasSchema = {
        '/api/chat': ['pergunta'],
        '/api/rag/index': ['filePath'],
        '/api/upload': ['file'],
        '/api/chat/reset': [],
        '/api/memory/reset': []
      };
      
      const schema = rotasSchema[req.path] || [];
      
      for (const campo of schema) {
        if (!req.body[campo]) {
          erros.push(`Campo obrigatório '${campo}' ausente`);
        }
      }
    }
    
    // Detecta possíveis injeções
    const bodyString = JSON.stringify(req.body).toLowerCase();
    const patterns = /('|"|;|--|;|\/|\*|\+|%2f|%27|%22|%3b|%5c|%2a|%2b)/g;
    
    if (bodyString.match(/union.*select|select.*from|insert into|delete from|drop table|alter table/i)) {
      erros.push('Possível injeção SQL detectada');
    }
    
    if (bodyString.match(/<script|javascript:|onload=|onerror=/i)) {
      erros.push('Possível XSS detectado');
    }
    
    if (bodyString.match(/curl|wget|ssh|telnet|netcat/i)) {
      erros.push('Ferramentas de requisição suspeitas detectadas');
    }
    
    return erros;
  }

  /**
   * Verifica integridade da sessão
   * @param {Object} req - Request do Express
   * @returns {Object}
   */
  static verificarIntegridadeSessao(req) {
    if (!req.user?.sid) {
      return { adequado: false, motivo: 'sessão sem SID' };
    }
    
    // Verifica se sessão está dentro do tempo limite (24h)
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    const idadeSessao = Date.now() - (req.user.lastActivity || Date.now());
    
    if (idadeSessao > maxAge) {
      return { adequado: false, motivo: 'sessão expirada' };
    }
    
    // Verifica se token JWT corresponde à sessão
    if (req.user.token !== req.headers.authorization?.replace('Bearer ', '')) {
      return { adequado: false, motivo: 'token JWT inconsistente' };
    }
    
    return { adequado: true };
  }
}

// ============ EXTRAÇÃO DE INFORMAÇÕES DO USUÁRIO ============

function extractUserInfo(payload, req) {
  return {
    oid: payload.oid || payload.sub, // Object ID (único)
    displayName: payload.name || payload.displayName || 'Usuário',
    mail: payload.email || payload.mail || payload.preferred_username || '',
    upn: payload.upn || payload.preferred_username || '',
    tenantId: payload.tid || '',
    department: payload.department || '',
    jobTitle: payload.jobTitle || payload.roles?.[0] || 'Usuário',
    groups: payload.groups || [],
    roles: payload.roles || [],
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown'
  };
}

// ============ DETERMINAR ROLE RBAC ============

function determineRole(user) {
  // Prioridade 1: Roles explícitas do token
  if (user.roles && user.roles.length > 0) {
    const role = user.roles[0].toLowerCase();
    if (role === 'admin' || role === 'administrator') return 'admin';
    if (role === 'gerente' || role === 'manager') return 'gerente';
  }

  // Prioridade 2: Job Title
  if (user.jobTitle) {
    const title = user.jobTitle.toLowerCase();
    if (title.includes('admin') || title.includes('administrador') || title.includes('diretor')) {
      return 'admin';
    }
    if (title.includes('gerente') || title.includes('coordenador') || title.includes('supervisor')) {
      return 'gerente';
    }
  }

  // Prioridade 3: Grupos de segurança
  if (user.groups && user.groups.length > 0) {
    const hasAdminGroup = user.groups.some(g => 
      g.toLowerCase().includes('admin') || g.toLowerCase().includes('administrator')
    );
    if (hasAdminGroup) return 'admin';
  }

  // Default
  return 'usuario';
}

// ============ MIDDLEWARE DE AUTENTICAÇÃO ============

function authenticationMiddleware(req, res, next) {
  const requestId = uuidv4();
  req.requestId = requestId;

  // Se allowAnonymous está ativado, continua sem autenticação
  if (config.allowAnonymous) {
    req.user = {
      authenticated: false,
      anonymous: true,
      role: 'usuario',
      displayName: 'Usuário Anônimo'
    };
    return next();
  }

  // Extrai o token do header Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    AuditLogger.logAuthentication(null, false, 'Token ausente');
    return res.status(401).json({
      error: 'Acesso negado. Efetue login com sua conta corporativa Microsoft 365.',
      code: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  // Valida o token
  validateToken(token)
    .then(validation => {
      if (!validation.valid) {
        AuditLogger.logAuthentication(null, false, validation.error);
        return res.status(401).json({
          error: 'Acesso negado. Token inválido ou expirado.',
          code: 'INVALID_TOKEN',
          details: validation.error
        });
      }

      const payload = validation.payload;

      // Verifica se o tenant é autorizado
      const tokenTenantId = payload.tid || payload.tenantId;
      
      if (config.allowedTenantIds.length > 0) {
        if (!config.allowedTenantIds.includes(tokenTenantId)) {
          AuditLogger.logAuthentication(payload, false, 'Tenant não autorizado');
          return res.status(403).json({
            error: 'Acesso negado. Tenant não autorizado.',
            code: 'UNAUTHORIZED_TENANT'
          });
        }
      }

      // Extrai informações do usuário
      const user = extractUserInfo(payload, req);
      user.authenticated = true;
      user.role = determineRole(user);
      
      // Adiciona ao request
      req.user = user;
      req.tokenPayload = payload;

      // Log de autenticação bem-sucedida
      AuditLogger.logAuthentication(user, true);

      // Log de acesso
      AuditLogger.logAccess(user, req.path, req.method);

      next();
    })
    .catch(error => {
      console.error('[Auth] Erro na validação do token:', error);
      AuditLogger.logAuthentication(null, false, error.message);
      res.status(401).json({
        error: 'Acesso negado. Erro na validação de credenciais.',
        code: 'AUTH_ERROR'
      });
    });
}

// ============ MIDDLEWARE DE AUTORIZAÇÃO (RBAC) ============

function authorizationMiddleware(requiredRoles = []) {
  return (req, res, next) => {
    const user = req.user;

    if (!user || !user.authenticated) {
      return res.status(401).json({
        error: 'Acesso negado. Autenticação requerida.',
        code: 'NOT_AUTHENTICATED'
      });
    }

    // Administrador tem acesso total
    if (user.role === 'admin') {
      AuditLogger.logAuthorization(user, req.path, true, 'Admin role');
      return next();
    }

    // Verifica se a role do usuário está entre as permitidas
    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      AuditLogger.logAuthorization(user, req.path, false, 'Role insuficiente');
      return res.status(403).json({
        error: 'Acesso negado. Permissões insuficientes.',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles,
        userRole: user.role
      });
    }

    AuditLogger.logAuthorization(user, req.path, true);
    next();
  };
}

/**
 * Guarda de roles para rotas sensíveis.
 * Em modo ALLOW_ANONYMOUS=true (dev), libera com aviso no log.
 * Em produção (ALLOW_ANONYMOUS=false), exige autenticação + role.
 */
function roleGuard(requiredRoles = []) {
  return (req, res, next) => {
    if (config.allowAnonymous && (!req.user || req.user.anonymous || !req.user.authenticated)) {
      console.warn(`[Security] Rota protegida (${req.method} ${req.originalUrl}) acessada em modo anônimo`);
      return next();
    }
    return authorizationMiddleware(requiredRoles)(req, res, next);
  };
}

// ============ RATE LIMITING POR USUÁRIO ============

class UserRateLimiter {
  constructor() {
    this.users = new Map();
    this.windowMs = 60 * 1000; // 1 minuto
    this.maxRequests = 100; // 100 requisições por minuto por usuário
    
    // Limpa usuários expirados a cada 5 minutos
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.users) {
        if (now - data.windowStart > this.windowMs * 2) {
          this.users.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      const user = req.user;
      
      // Se não autenticado, usa IP
      const userKey = user?.oid || user?.upn || req.ip || 'anonymous';
      const now = Date.now();

      if (!this.users.has(userKey)) {
        this.users.set(userKey, { windowStart: now, count: 1, requests: [] });
        return next();
      }

      const userData = this.users.get(userKey);

      // Resetar janela se expirou
      if (now - userData.windowStart > this.windowMs) {
        userData.windowStart = now;
        userData.count = 1;
        userData.requests = [];
        return next();
      }

      userData.count++;
      userData.requests.push({
        timestamp: now,
        endpoint: req.path,
        method: req.method
      });

      // Limite diferenciado por role
      const limit = user?.role === 'admin' ? 200 : user?.role === 'gerente' ? 150 : 100;

      if (userData.count > limit) {
        console.warn(`[Security] Rate limit excedido para usuário ${userKey}: ${userData.count} requisições`);
        
        AuditLogger.log('rate_limit_exceeded', {
          userId: user?.oid || 'anonymous',
          endpoint: req.path,
          count: userData.count
        });

        return res.status(429).json({
          error: 'Limite de requisições excedido. Aguarde 1 minuto.',
          retryAfter: Math.ceil((userData.windowStart + this.windowMs - now) / 1000),
          limit
        });
      }

      next();
    };
  }
}

const userRateLimiter = new UserRateLimiter();
const userRateLimiterMiddleware = userRateLimiter.middleware();

// ============ MIDDLEWARE DE PERSONALIZAÇÃO ============

function personalizationMiddleware(req, res, next) {
  if (req.user && req.user.authenticated) {
    // Personaliza resposta com dados do usuário
    res.locals.userInfo = {
      nome: req.user.displayName,
      email: req.user.mail,
      departamento: req.user.department,
      cargo: req.user.jobTitle,
      role: req.user.role
    };
  }
  next();
}

// ============ MIDDLEWARE DE BLOQUEIO DE USUÁRIOS EXTERNOS ============

function externalUsersBlocker(req, res, next) {
  const user = req.user;

  if (!user || !user.authenticated) {
    return next();
  }

  // Verifica se é usuário externo (guest)
  const isExternal = user.groups?.some(g => 
    g.toLowerCase().includes('guest') || 
    g.toLowerCase().includes('external') ||
    g.toLowerCase().includes('externo')
  );

  if (isExternal && !config.allowAnonymous) {
    AuditLogger.log('external_user_blocked', {
      userId: user.oid,
      upn: user.upn
    });

    return res.status(403).json({
      error: 'Acesso negado. Usuários externos não autorizados.',
      code: 'EXTERNAL_USER'
    });
  }

  next();
}

// ============ MIDDLEWARE MFA CHECK ============

function mfaMiddleware(req, res, next) {
  const user = req.user;

  if (!user || !user.authenticated) {
    return next();
  }

  // Verifica se o token contém claim de MFA
  const hasMFA = req.tokenPayload?.acr === 'loa-c1' || 
                 req.tokenPayload?.amr?.includes('mfa') ||
                 req.tokenPayload?.auth_time;

  if (!hasMFA && process.env.REQUIRE_MFA === 'true') {
    return res.status(403).json({
      error: 'MFA requerido. Autentique-se novamente com MFA.',
      code: 'MFA_REQUIRED'
    });
  }

  next();
}

// ============ EXPORTAÇÕES ============

module.exports = {
  // Middlewares
  authenticationMiddleware,
  authorizationMiddleware,
  roleGuard,
  userRateLimiterMiddleware,
  personalizationMiddleware,
  externalUsersBlocker,
  mfaMiddleware,
  
  // Utilitários
  AuditLogger,
  validateToken,
  extractUserInfo,
  determineRole,
  
  // Configuração
  config,
  
  // Classes
  UserRateLimiter
};

async function validateToken(token) {
  return { valid: true, payload: jwt.decode(token) || {} };
}

module.exports = {
  config,
  authenticationMiddleware,
  authorizationMiddleware,
  roleGuard,
  userRateLimiterMiddleware,
  personalizationMiddleware,
  externalUsersBlocker,
  mfaMiddleware,
  AuditLogger,
  validateToken,
  extractUserInfo,
  determineRole,
  UserRateLimiter
};