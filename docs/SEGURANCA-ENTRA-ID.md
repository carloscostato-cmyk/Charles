# Segurança - Microsoft Entra ID (Azure AD)

## Índice

1. [Status Atual](#status-atual)
2. [Visão Geral](#visão-geral)
3. [Arquitetura de Segurança](#arquitetura-de-segurança)
4. [Configuração do Azure AD](#configuração-do-azure-ad)
5. [Variáveis de Ambiente](#variáveis-de-ambiente)
6. [Fluxo de Autenticação](#fluxo-de-autenticação)
7. [RBAC (Role Based Access Control)](#rbac-role-based-access-control)
8. [Integração Frontend](#integração-frontend)
9. [Testes](#testes)
10. [Troubleshooting](#troubleshooting)

---

## Status Atual

| Modo | `ALLOW_ANONYMOUS` | Nível (`/api/status` → `seguranca.nivel`) | Uso |
|------|-------------------|-------------------------------------------|-----|
| **Desenvolvimento** | `true` | **7.5 / 10** | Dev local sem Azure |
| **Produção** | `false` | **9.5 / 10** | Entra ID obrigatório |

### Controles sempre ativos (independente do modo)

| Controle | Módulo | Observação |
|----------|--------|------------|
| CORS restritivo | `security-middleware.js` | `ALLOWED_ORIGINS` |
| Rate limit (IP) | `apiLimiter` | 60 req/min |
| Rate limit (usuário) | `entra-id-auth.js` | 100–200 req/min por role |
| Security headers | `securityHeadersMiddleware` | nosniff, frame DENY, HSTS em prod |
| PII scrubber (LGPD) | `PIIScrubber` | CPF, CNPJ, e-mail, telefone, cartão |
| Prompt injection | `PromptInjectionGuard` | EN + PT |
| TLS verificado | `server.js` + `llm-provider.js` | desliga só com `ALLOW_INSECURE_TLS=true` |
| RBAC | `roleGuard` | rotas admin/gerente |
| Auth Entra ID | `authenticationMiddleware` | ativo quando `ALLOW_ANONYMOUS=false` |

### Pendências para 10/10

- [ ] Credenciais reais `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` (não placeholders)
- [ ] Login MSAL no frontend (hoje só `chatAPI.setToken`)
- [ ] `REQUIRE_MFA=true` em produção
- [ ] Audit log persistente (SIEM), não só console
- [ ] Remover `NODE_TLS_REJECT_UNAUTHORIZED=0` residual em `scripts/pdf-routine.js`

### Verificar score em runtime

```bash
curl http://localhost:3000/api/status
```

Resposta esperada (trecho):

```json
{
  "seguranca": {
    "nivel": 7.5,
    "maximo": 10,
    "modo": "desenvolvimento",
    "resumo": "Hardening ativo (ALLOW_ANONYMOUS=true — ative auth em produção)",
    "controles": {
      "corsRestritivo": true,
      "rateLimit": true,
      "tlsVerificado": true,
      "autenticacaoEntraId": false,
      "rbac": true
    }
  }
}
```

---

## Visão Geral

O sistema possui **hardening de segurança wired no `server.js`** e autenticação **Microsoft Entra ID (Azure AD)** controlada por `ALLOW_ANONYMOUS`:

### Funcionalidades Implementadas

✅ **Autenticação via Microsoft Entra ID (Azure AD)** (quando `ALLOW_ANONYMOUS=false`)
✅ **Validação de JWT** com verificação de assinatura RS256
✅ **Verificação de expiração do token** (não aceita tokens expirados)
✅ **Extração de informações do usuário** autenticado
✅ **Verificação de tenant autorizado**
✅ **RBAC (Role Based Access Control)** - Administrador, Gerente, Usuário
✅ **Log de auditoria** completo (console)
✅ **Rate limiting** por IP e por usuário autenticado
✅ **Bloqueio de usuários externos** não autorizados
✅ **Suporte a MFA** (opcional via `REQUIRE_MFA`)
✅ **Proteção contra prompt injection** e PII scrubber (LGPD)
✅ **CORS restritivo** + security headers
✅ **TLS verification** ativa por padrão
✅ **Score dinâmico de segurança** em `/api/status`

### Camadas de Segurança

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  api-client.js                                  │   │
│  │  - Armazena token JWT                           │   │
│  │  - Adiciona header Authorization: Bearer {token} │   │
│  │  - Trata erros 401/403 (logout automático)       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  CORS + Security Headers                        │    │
│  │  - Origens permitidas                           │    │
│  │  - X-Content-Type-Options, X-Frame-Options      │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Audit Logger                                   │    │
│  │  - Registra todas as requisições                 │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Rate Limiter (por IP + por usuário)            │    │
│  │  - IP: 60 req/min                               │    │
│  │  - Admin: 200 req/min                           │    │
│  │  - Gerente: 150 req/min                         │    │
│  │  - Usuário: 100 req/min                         │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Authentication Middleware (Entra ID)            │    │
│  │  - Valida JWT token                              │    │
│  │  - Verifica assinatura RS256                     │    │
│  │  - Verifica expiração                            │    │
│  │  - Verifica tenant autorizado                    │    │
│  │  - Extrai dados do usuário                       │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  External Users Blocker                          │    │
│  │  - Bloqueia usuários guest/external              │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  MFA Middleware (opcional)                       │    │
│  │  - Verifica se token contém MFA                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Authorization Middleware (RBAC)                 │    │
│  │  - Admin: Acesso total                           │    │
│  │  - Gerente: Acesso parcial                       │    │
│  │  - Usuário: Acesso básico                        │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Rota Protegida                                  │    │
│  │  - Dados do usuário em req.user                  │    │
│  │  - Processa requisição                           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Arquitetura de Segurança

### Middleware de Autenticação (`backend/middleware/entra-id-auth.js`)

**Funcionalidades:**
- Validação de JWT usando JWKS (JSON Web Key Set) do Azure AD
- Verificação de tenant autorizado
- Extração de informações do usuário (displayName, mail, department, jobTitle, groups)
- Determinação automática de role (admin, gerente, usuario) baseada em:
  1. Roles explícitas no token
  2. Job Title
  3. Grupos de segurança
- Log de auditoria completo
- Rate limiting por usuário autenticado

### Rotas Protegidas

**Públicas (sem autenticação):**
- `GET /api/status`
- `GET /api/providers`
- `GET /api/faq`
- `GET /api/sugestoes`

**Protegidas (requerem autenticação):**
- `POST /api/chat` - Admin, Gerente, Usuário
- `POST /api/chat/stream` - Admin, Gerente, Usuário
- `GET /api/agentes` - Admin, Gerente, Usuário
- `GET /api/guardians` - Admin, Gerente, Usuário
- `GET /api/rag/stats` - Admin, Gerente, Usuário
- `POST /api/rag/index` - **Apenas Admin**
- `POST /api/rag/index-url` - **Apenas Admin**
- `POST /api/rag/index-text` - **Apenas Admin**
- `DELETE /api/rag/clear` - **Apenas Admin**
- `POST /api/pdf/index` - **Apenas Admin**
- `POST /api/upload` - Admin, Gerente
- `GET /api/observability/dashboard` - **Apenas Admin**
- `GET /api/observability/traces` - **Apenas Admin**
- `POST /api/memory/reset` - Admin, Gerente
- `POST /api/chat/reset` - Admin, Gerente

---

## Configuração do Azure AD

### Passo 1: Registrar Aplicação no Azure AD

1. Acesse o [Azure Portal](https://portal.azure.com)
2. Navegue para **Microsoft Entra ID** → **App registrations**
3. Clique em **New registration**
4. Preencha:
   - **Name**: `Chatbot Charles`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: `http://localhost:3000` (ou seu domínio)
5. Clique em **Register**

### Passo 2: Anotar IDs

Após o registro, anote:
- **Application (client) ID** → `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_TENANT_ID`

### Passo 3: Configurar Autenticação

1. No menu lateral, clique em **Authentication**
2. Adicione plataformas:
   - **Web**: `http://localhost:3000`
   - **Single-page application**: `http://localhost:3000`
3. Em **Implicit grant and hybrid flows**, habilite:
   - ✅ Access tokens
   - ✅ ID tokens

### Passo 4: Configurar Permissões

1. Vá para **API permissions**
2. Clique em **Add a permission**
3. Selecione **Microsoft Graph**
4. Adicione:
   - `openid`
   - `email`
   - `profile`
   - `User.Read`

### Passo 5: Criar Segredos (Client Secret)

1. Vá para **Certificates & secrets**
2. Clique em **New client secret**
3. Adicione descrição e expiração
4. **IMPORTANTE**: Copie o valor do secret imediatamente

### Passo 6: Configurar Grupos de Segurança (Opcional)

Para RBAC avançado:

1. Crie grupos de segurança no Azure AD:
   - `ChatbotCharles-Admins`
   - `ChatbotCharles-Gerentes`
   - `ChatbotCharles-Usuarios`

2. Atribua usuários aos grupos

3. No **App registrations** → **Token configuration**:
   - Adicione o claim `groups`
   - Configurar **Group membership claims** para **Security groups**

---

## Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# ===========================================
# SEGURANÇA - MICROSOFT ENTRA ID (AZURE AD)
# ===========================================
# OBRIGATÓRIO para produção: Tenant ID do Azure AD
AZURE_TENANT_ID=seu-tenant-id-aqui

# OBRIGATÓRIO: Client ID da aplicação registrada no Azure AD
AZURE_CLIENT_ID=seu-client-id-aqui

# OPCIONAL: Audience (normalmente o mesmo Client ID)
AZURE_AUDIENCE=

# Tenant IDs autorizados (separados por vírgula para múltiplos tenants)
ALLOWED_TENANT_IDS=

# Modo de validação: strict (valida assinatura) ou permissive (apenas estrutura)
AUTH_VALIDATION_MODE=strict

# IMPORTANTE: false para produção (nível 9.5), true para desenvolvimento local (nível 7.5)
ALLOW_ANONYMOUS=true

# OPCIONAL: Requer MFA (true/false)
REQUIRE_MFA=false

# TLS: true apenas se proxy corporativo quebrar HTTPS (risco MITM)
ALLOW_INSECURE_TLS=false

# ===========================================
# CORS - Origens permitidas
# ===========================================
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001
```

### Explicação das Variáveis

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `AZURE_TENANT_ID` | ✅ em prod | ID do tenant do Azure AD |
| `AZURE_CLIENT_ID` | ✅ em prod | ID da aplicação registrada no Azure AD |
| `AZURE_AUDIENCE` | ❌ | Audience do token (normalmente o Client ID) |
| `ALLOWED_TENANT_IDS` | ❌ | Lista de tenants autorizados (separados por vírgula) |
| `AUTH_VALIDATION_MODE` | ❌ | `strict` (valida assinatura) ou `permissive` |
| `ALLOW_ANONYMOUS` | ❌ | `false` produção (9.5), `true` desenvolvimento (7.5) |
| `REQUIRE_MFA` | ❌ | `true` para exigir MFA |
| `ALLOW_INSECURE_TLS` | ❌ | `true` só com proxy MITM corporativo |
| `ALLOWED_ORIGINS` | ❌ | Origens permitidas para CORS |

---

## Fluxo de Autenticação

### Backend

1. **Cliente faz requisição** com header:
   ```
   Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6...
   ```

2. **Authentication Middleware**:
   - Extrai o token do header
   - Decodifica o header para obter o `kid` (Key ID)
   - Busca a chave pública no JWKS do Azure AD
   - Valida o token:
     - ✅ Assinatura RS256
     - ✅ Expiração
     - ✅ Audience
     - ✅ Issuer
     - ✅ Tenant autorizado

3. **Extrai informações do usuário**:
   ```javascript
   {
     oid: "12345678-1234-1234-1234-123456789012",
     displayName: "João Silva",
     mail: "joao.silva@empresa.com",
     upn: "joao.silva@empresa.com",
     tenantId: "87654321-4321-4321-4321-210987654321",
     department: "Tecnologia",
     jobTitle: "Desenvolvedor Senior",
     groups: ["ChatbotCharles-Usuarios"],
     roles: [],
     role: "usuario" // determinado automaticamente
   }
   ```

4. **Autorização (RBAC)**:
   - Verifica se o usuário tem a role necessária
   - Admin: acesso total
   - Gerente: acesso parcial
   - Usuário: acesso básico

5. **Log de Auditoria**:
   ```javascript
   {
     timestamp: "2026-06-06T17:30:00.000Z",
     event: "authentication",
     userId: "12345678-1234-1234-1234-123456789012",
     upn: "joao.silva@empresa.com",
     tenantId: "87654321-4321-4321-4321-210987654321",
     success: true,
     reason: null,
     ip: "192.168.1.100"
   }
   ```

### Frontend

```javascript
// 1. Usuário faz login no Azure AD (via popup ou redirect)
// 2. Azure AD retorna token JWT
const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6...";

// 3. Armazena token no cliente
chatAPI.setToken(token);
chatAPI.setUser({
  nome: "João Silva",
  email: "joao.silva@empresa.com",
  departamento: "Tecnologia",
  cargo: "Desenvolvedor Senior",
  role: "usuario"
});

// 4. Todas as requisições incluem automaticamente o header
// Authorization: Bearer {token}

// 5. Trata erros de autenticação
try {
  const response = await chatAPI.enviarMensagem("Olá!");
} catch (error) {
  // Se erro 401/403, redireciona para login
  console.error("Sessão expirada");
}
```

---

## RBAC (Role Based Access Control)

### Níveis de Acesso

| Role | Descrição | Acesso |
|------|-----------|--------|
| **admin** | Administrador | Acesso total a todas as funcionalidades |
| **gerente** | Gerente/Coordenador | Acesso a upload, reset de memória e chat |
| **usuario** | Usuário padrão | Acesso a chat, FAQ, agents, RAG stats |

### Determinação Automática de Role

O sistema determina a role automaticamente baseado em:

1. **Roles explícitas no token** (prioritário):
   ```
   roles: ["admin"] → role: "admin"
   roles: ["gerente"] → role: "gerente"
   ```

2. **Job Title**:
   ```
   jobTitle: "Administrador de Sistemas" → role: "admin"
   jobTitle: "Gerente de Projetos" → role: "gerente"
   jobTitle: "Coordenador de TI" → role: "gerente"
   ```

3. **Grupos de segurança**:
   ```
   groups: ["ChatbotCharles-Admins"] → role: "admin"
   ```

4. **Default**: `usuario`

### Customização de Roles

Para customizar as regras de role, edite o arquivo `backend/middleware/entra-id-auth.js`:

```javascript
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
```

---

## Integração Frontend

### api-client.js

O cliente de API já está configurado para enviar automaticamente o token JWT:

```javascript
// Funções de autenticação
chatAPI.setToken(token);        // Define token
chatAPI.getUser();               // Obtém usuário
chatAPI.setUser(user);           // Define usuário
chatAPI.isAuthenticated();       // Verifica se está autenticado
chatAPI.logout();                // Realiza logout

// Header automático em todas as requisições
Authorization: Bearer {token}

// Tratamento automático de erros 401/403
// Redireciona para login se sessão expirada
```

### Exemplo de Uso

```javascript
// 1. Verificar autenticação
if (!chatAPI.isAuthenticated()) {
  // Redirecionar para login
  window.location.href = '/login';
}

// 2. Enviar mensagem
try {
  const response = await chatAPI.enviarMensagem("Olá, Charles!");
  console.log(response);
} catch (error) {
  console.error("Erro:", error);
}

// 3. Upload de arquivo
const file = document.getElementById('fileInput').files[0];
try {
  const result = await chatAPI.uploadFile(file);
  console.log("Upload:", result);
} catch (error) {
  console.error("Erro no upload:", error);
}

// 4. Logout
chatAPI.logout();
window.location.href = '/';
```

---

## Testes

### Teste 1: Verificar Status Público

```bash
curl http://localhost:3000/api/status
```

**Esperado**: Status do servidor sem autenticação

### Teste 2: Verificar Proteção de Rota

```bash
curl http://localhost:3000/api/chat -X POST -H "Content-Type: application/json" -d '{"mensagem":"teste"}'
```

**Esperado**:
```json
{
  "error": "Acesso negado. Efetue login com sua conta corporativa Microsoft 365.",
  "code": "NOT_AUTHENTICATED"
}
```

### Teste 3: Token Inválido

```bash
curl http://localhost:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_invalido" \
  -d '{"mensagem":"teste"}'
```

**Esperado**:
```json
{
  "error": "Acesso negado. Token inválido ou expirado.",
  "code": "INVALID_TOKEN"
}
```

### Teste 4: Token Expirado

```bash
# Use um token expirado (criado há mais de 1 hora)
curl http://localhost:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_expirado" \
  -d '{"mensagem":"teste"}'
```

**Esperado**:
```json
{
  "error": "Acesso negado. Token inválido ou expirado.",
  "code": "INVALID_TOKEN"
}
```

### Teste 5: Tenant Não Autorizado

```bash
# Use um token de um tenant não autorizado
curl http://localhost:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_tenant_nao_autorizado" \
  -d '{"mensagem":"teste"}'
```

**Esperado**:
```json
{
  "error": "Acesso negado. Tenant não autorizado.",
  "code": "UNAUTHORIZED_TENANT"
}
```

### Teste 6: Permissão Insuficiente (Admin)

```bash
# Token de usuário comum tentando acessar rota de admin
curl http://localhost:3000/api/rag/index -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_usuario_comum" \
  -d '{"filePath":"/tmp/teste.txt"}'
```

**Esperado**:
```json
{
  "error": "Acesso negado. Permissões insuficientes.",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

---

## Troubleshooting

### Problema: Chat retorna 401 sem login

**Causa**: `ALLOW_ANONYMOUS=false` e não há `Authorization: Bearer …`.

**Solução (dev)**: defina `ALLOW_ANONYMOUS=true` e reinicie o servidor (nível **7.5**).

**Solução (prod)**: configure Tenant/Client reais e envie JWT via `chatAPI.setToken(token)`.

### Problema: Score em `/api/status` não atualiza após mudar `.env`

**Solução**: reinicie o processo Node (`npm start`). Variáveis de ambiente são lidas no boot.

### Problema: Chamadas LLM falham por certificado SSL (proxy corporativo)

**Solução** (temporária): `ALLOW_INSECURE_TLS=true`. Remova quando o proxy permitir TLS normal.

### Problema: Token rejeitado mesmo com token válido

**Solução**: Verifique se o `AZURE_TENANT_ID` e `AZURE_CLIENT_ID` estão corretos no `.env` (não use placeholders).

### Problema: Erro de CORS

**Solução**: Adicione a origem do frontend em `ALLOWED_ORIGINS` (inclua IPs da LAN se acessar por `http://IP:3000`).

### Problema: Grupos de segurança não aparecem no token

**Solução**: 
1. Habilite `groups` claim no Azure AD
2. Configure `Group membership claims` para `Security groups`

### Problema: Role não está correta

**Solução**: Verifique a ordem de prioridade no `determineRole()`:
1. Roles explícitas no token
2. Job Title
3. Grupos de segurança

### Problema: Rate limit muito agressivo

**Solução**: Ajuste os limites no arquivo `.env`:
```javascript
// backend/middleware/entra-id-auth.js
this.windowMs = 60 * 1000; // 1 minuto
this.maxRequests = 100; // 100 requisições por minuto
```

### Problema: MFA não funciona

**Solução**: Verifique se o token contém o claim `amr` com valor `mfa`:
```json
{
  "amr": ["mfa", "pwd"]
}
```

---

## Checklist de Segurança

### Produção

- [ ] `ALLOW_ANONYMOUS=false` no `.env`
- [ ] `AUTH_VALIDATION_MODE=strict` no `.env`
- [ ] `REQUIRE_MFA=true` (recomendado)
- [ ] `ALLOWED_TENANT_IDS` configurado com tenants autorizados
- [ ] HTTPS configurado (não usar HTTP)
- [ ] CORS configurado com domínios específicos
- [ ] Segredos do Azure AD armazenados em Azure Key Vault
- [ ] Logs de auditoria enviados para Azure Monitor
- [ ] Rate limiting configurado
- [ ] Testes de penetração realizados

### Desenvolvimento

- [ ] `ALLOW_ANONYMOUS=true` (opcional para testes)
- [ ] Token de teste válido para desenvolvimento
- [ ] Postman/Insomnia collection com exemplos de requisições

---

## Referências

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/en-us/entra/identity/)
- [Azure AD JWT Tokens](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
- [JWKS (JSON Web Key Set)](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens#validation)
- [Role-Based Access Control](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/)

---

**Última atualização**: 2026-06-06
**Versão**: 3.0.0
**Autor**: Equipe Chatbot Charles