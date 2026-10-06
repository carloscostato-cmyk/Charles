# 🚀 Guia de Deployment - Charles v4.1

## Evolução para Nível 9.5/10: Docker + Testes + Segurança Enterprise

Implementamos **containerização segura** com **guardiões especializados** para proteger seu código:

### 1️⃣ Guardião de Deployment (`deployment-guardian.js`)
- ✅ Verifica integridade de arquivos críticos
- ✅ Calcula checksum do código
- ✅ Valida pré-deployment
- ✅ Monitora saúde do container

### 2️⃣ Guardião de Testes (`test-guardian.js`)
- ✅ Rastreia resultado de testes
- ✅ Detecta regressões
- ✅ Valida cobertura mínima
- ✅ Bloqueia deploy com falhas

### 3️⃣ Knowledge Guardian
- ✅ Protege a base de conhecimento
- ✅ Valida integridade da FAQ

### 4️⃣ Code Guardian
- ✅ Protege a qualidade do código
- ✅ Snapshot de arquivos essenciais

### 5️⃣ System Guardian
- ✅ Protege a arquitetura do sistema
- ✅ Monitora saúde geral

---

## 📋 Pré-requisitos

```bash
# Instalar Node.js 18+
# Instalar Docker & Docker Compose
```

---

## 🔧 Instalação Local

```bash
# 1. Instalar dependências
cd backend
npm install

# 2. Configurar variáveis de ambiente
cp ../.env.example ../.env
# Editar .env com suas chaves de API
```

---

## 🧪 Testes Automatizados

```bash
# Rodar testes com cobertura
npm test

# Modo watch (desenvolvimento)
npm run test:watch

# CI/CD (como no GitHub Actions)
npm run test:ci

# Verbose (mostra cada teste)
npm run test:verbose
```

### Cobertura Esperada
- Global: 50%+
- llm-provider.js: 70%+
- llm-client.js: 65%+
- orchestrator.js: 60%+

---

## 🛡️ Verificação dos Guardiões

Antes de fazer deploy, verifique os guardiões:

```bash
npm run guardians:check
```

Saída esperada:
```
🛡️ VERIFICAÇÃO DOS GUARDIÕES v4.1

📦 Guardião #1 - Deployment Guardian
   ✅ Arquivos críticos íntegros

🧪 Guardião #2 - Test Guardian
   ✅ Testes em status verde

🧠 Guardião #3 - Knowledge Guardian
   ✅ Base de conhecimento presente

💻 Guardião #4 - Code Guardian
   ✅ Todos arquivos essenciais presentes

⚙️ Guardião #5 - System Guardian
   ✅ Sistema operacional

Status: ✅ PRONTO PARA DEPLOY
```

---

## 🐳 Docker Local

```bash
# Build da imagem
npm run docker:build

# Subir container
npm run docker:up

# Ver logs
npm run docker:logs

# Parar container
npm run docker:down

# Deploy completo (build + up)
npm run docker:deploy
```

Acessar: `http://localhost:3000`

---

## 📦 Dockerfile Seguro

O Dockerfile foi criado para:
- ✅ Não modificar código existente
- ✅ Usar base Alpine (imagem pequena)
- ✅ Multi-stage build (builder → test → runtime)
- ✅ Health checks inclusos
- ✅ Modo production por padrão
- ✅ Usuário não-root (segurança)
- ✅ Node.js 20 LTS

```dockerfile
FROM node:24-alpine AS builder
# Instala dependências completas para testes

FROM builder AS test
# Roda testes + guardiões

FROM node:24-alpine AS runtime
# Produção enxuta com usuário não-root
```

---

## 🔐 Segurança Enterprise (FASE 9)

### Microsoft Entra ID
- ✅ JWT RS256 via JWKS
- ✅ Tenant allowlist
- ✅ MFA opcional
- ✅ RBAC (admin / gerente / usuario)
- ✅ External users blocker

### Hardening
- ✅ CORS restritivo via `ALLOWED_ORIGINS`
- ✅ Rate limiting (60 req/min por IP)
- ✅ Security headers (nosniff, DENY frame, HSTS)
- ✅ PII scrubber (LGPD): CPF, CNPJ, e-mail, telefone
- ✅ Prompt injection guard (EN/PT)
- ✅ TLS verificado por padrão

### Score de Segurança
| Ambiente | ALLOW_ANONYMOUS | Nível |
|----------|----------------|-------|
| Desenvolvimento | `true` | 7.5/10 |
| Produção | `false` | **9.5/10** |

---

## 🚀 Workflow de Deployment

```bash
# 1. Desenvolver e testar localmente
npm run test:watch

# 2. Commitar mudanças
git add .
git commit -m "feat: nova feature"

# 3. Validar antes de push
npm run deploy:validate

# 4. Push para main
git push origin main

# 5. CI/CD automático (GitHub Actions)
# - Roda testes
# - Verifica guardiões
# - Build Docker
# - Deploy para produção
```

---

## 📊 Monitoramento

### Dashboard de Observabilidade
```
GET /api/observability/dashboard
```

Retorna:
- Requisições ativas
- Taxa de sucesso
- Tokens consumidos
- Custo estimado
- Latência média
- Agentes mais usados

### Métricas em Tempo Real
```
GET /api/observability/stats?hours=24
```

### Health Check
```
GET /api/status
```

---

## ✅ Checklist Pré-Deployment

- [ ] Testes passando: `npm test`
- [ ] Guardiões OK: `npm run guardians:check`
- [ ] Variáveis de ambiente configuradas
- [ ] Arquivo FAQ presente e íntegro
- [ ] Nenhum arquivo crítico modificado
- [ ] Build Docker testado: `docker build -t charles:v4.1 .`
- [ ] `ALLOW_ANONYMOUS=false` em produção
- [ ] `AZURE_TENANT_ID` e `AZURE_CLIENT_ID` configurados
- [ ] Documentação atualizada

---

## 🆘 Troubleshooting

### "Testes falhando"
```bash
npm test -- --verbose
# Veja qual teste específico falha
```

### "Guardião detectou mudanças"
```bash
npm run guardians:check
# Verifique qual arquivo foi alterado
```

### "Docker não inicia"
```bash
docker compose up --build -v
# Ver logs detalhados
```

### "LLM não conecta"
```bash
# Verificar .env
cat ../.env

# Testar provider
curl http://localhost:3000/api/providers
```

### "Erro de autenticação"
```bash
# Verificar se ALLOW_ANONYMOUS está correto
# Verificar AZURE_TENANT_ID e AZURE_CLIENT_ID
# Verificar se o token JWT é válido
```

---

## 🌐 Fase 2 — Pacote estático para GitHub Pages (Route A+)

Demo 100% client-side da página "Data Center SD" com o Charles. Sem backend:
as **159 FAQs** de `FQ_DATA_CENTER.xls` são embutidas no cliente e a camada
`frontend/js/pages-mock.js` intercepta `fetch('/api/...')` respondendo locally.

### Gerar o pacote

```bash
node scripts/build-pages-site.js                # gera ./pages-site (gitignored)
node scripts/build-pages-site.js --out /tmp/x   # destino alternativo
node scripts/build-pages-site.js --quiet        # sem resumo
```

### Preview local (simula a project page em /Charles/)

```bash
node scripts/serve-pages.js                     # http://localhost:4173/Charles/
node scripts/serve-pages.js --port 8080 --base /Charles
```

O prefixo `/Charles/` importa: é assim que o GitHub Pages serve
`https://<usuario>.github.io/Charles/` — os caminhos do pacote são relativos
(`./css/...`) e funcionam sob qualquer prefixo.

### Estrutura gerada

| Arquivo no pacote | Origem |
|---|---|
| `index.html` | `index-datacenter.html` com paths relativos + mock injetado |
| `css/` | `frontend/css/` (style, response-types, a11y) |
| `js/` | `frontend/js/` (api-client, app, voice, lip-sync) + `pages-mock.js` |
| `assets/` | merge de `assets/` + `frontend/assets/` |
| `data/faqs.js` | **159 FAQs embutidas** (`window.CHARLES_FAQS`) |
| `data/faqs.json` | mesma base em JSON canônico (download/inspeção) |
| `.nojekyll` | impede o Jekyll de filtrar arquivos |

### Contratos e garantias

- **Endpointos cobertos pelo mock:** `GET /api/status`, `GET /api/faq`,
  `GET /api/sugestoes`, `GET /api/chat/welcome`, `POST /api/chat/stream`
  (SSE `metadata → token* → done`), `POST /api/chat`, `POST /api/chat/reset`.
  Demais `/api/*` → 404 JSON (ex.: `/api/tts`, onde o `voice.js` já cai no
  fallback Web Speech).
- **Busca local** é um porte de `backend/faq-search.js` (mesmos pesos e
  threshold 0.2) — o demo responde igual ao ambiente completo.
- **Trava dupla:** o mock só entra no HTML pelo build **e** só ativa com a
  flag `window.__CHARLES_PAGES__` (também injetada pelo build). O Express
  (`/sharepoint`) não injeta nada — comportamento do backend inalterado.
- O HTML original `index-datacenter.html` **não é modificado** pelo build.

### Testes

```bash
npx jest --config jest.config.js pages-mock    # núcleo + integração do build
```

Cobertos em `backend/__tests__/pages-mock.test.js`: contrato de 159 FAQs,
shapes dos endpoints, busca match/sem-match, SSE parseável pelo parser do
`api-client` e a estrutura do pacote gerado.

### Fase 3 — Publicação no GitHub Pages (concluída ✅)

O job **`pages`** (🌐 Deploy GitHub Pages) no `.github/workflows/deploy.yml`:

- `needs: validate` — só publica após testes + guardiões verdes, e
  **nunca em PR** (mesmo `if` do job `deploy`);
- `npm ci --prefix backend` + `node scripts/build-pages-site.js`
  (o `faq-reader` precisa do pacote `xlsx`);
- `actions/configure-pages@v6` → `actions/upload-pages-artifact@v5`
  (`path: pages-site`, `include-hidden-files: true` para manter o
  `.nojekyll`) → `actions/deploy-pages@v5`;
- permissões do job: `contents: read`, `pages: write`, `id-token: write`,
  `actions: read`; environment `github-pages` (com a URL do deploy) e
  concurrency `github-pages` (sem cancelamento de deploy em andamento);
- **smoke test pós-deploy:** index 200 com `__CHARLES_PAGES__`,
  `data/faqs.js` servindo `CHARLES_FAQS` e exatamente **159 FAQs**
  no ar (até 2 min de propagação, com retries).

Publicado em: **https://carloscostato-cmyk.github.io/Charles/**

> Repo com **Settings → Pages → Source = GitHub Actions**
> (`build_type: workflow`, habilitado via API na ativação da fase).

---

## 📈 Próximos Passos (Para 10/10)

1. **Kubernetes** — orquestração de containers
2. **Load Testing** — Apache JMeter
3. **APM** — Datadog/New Relic
4. **Backup Automático** — S3/GCS
5. **Multi-região** — alta disponibilidade

---

## 📞 Suporte

Para dúvidas sobre deployment, verifique:
- `docker-compose.yml` — configuração de containers
- `jest.config.js` — configuração de testes
- `backend/guardians/` — lógica dos guardiões
- `scripts/check-guardians.js` — validação pré-deploy
- `docs/SEGURANCA-ENTRA-ID.md` — documentação de segurança

---

**Versão:** 4.1.0 | **Data:** 10/08/2026 | **Claro Empresas**