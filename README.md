# ��� Chatbot Charles v4.3 - State of the Art 2026

Assistente Virtual Corporativo do Departamento de Data Center da Claro Empresas.

## ��� v4.3 — Camada Anti-Interrupção de Voz + VoiceClient Frontend

v4.3 adiciona **resiliência de voz enterprise** sobre a base v4.2:

- **Camada Anti-Interrupção** (`backend/voice/`) — 10 módulos: State Machine, Exclusive Playback Lock, Response Queue, Tool Gate, Safe Tool Executor, Response Consolidator, Safe TTS Streamer, Interruption Manager, Circular Audio Buffer, Cancellation Token
- **Voice Gate pré-fala** integrado no `llm-client.js` — bloqueia TTS até tools concluírem, enfileira respostas durante fala, cancela streams em interrupção do usuário
- **VoiceClient Frontend** (`frontend/js/voice-client.js`) — AudioContext nativo, lock de reprodução, fila de buffers, `handleUserStop()` para barge-in real
- **Testes de voz** — `backend/__tests__/voice-session.test.js` cobre lock, state machine, tool gate, queue, interruption manager
- Servidor rodando em `http://localhost:3000` com todas as funcionalidades ativas

### Avaliação de Capacidades de LLM: 9.3/10
### Segurança: 7.5/10 (dev) · 9.5/10 (com Entra ID obrigatório)

---

## ��� Arquitetura (Clean Architecture + SOLID)

```
backend/
├── server.js                          # Servidor Express + SSE + Rotas + Security stack
├── llm-client.js                     # Cliente LLM integrado (RAG + Tools + Memory + Router + Voice Gate)
├── llm-provider.js                   # Provider abstraction + Smart Model Selection + TLS seguro
├── faq-reader.js                     # Leitor de FAQ (Excel)
├── faq-search.js                     # Busca fuzzy (compatibilidade)
│
├── middleware/                        # FASE 9: Segurança
│   ├── security-middleware.js        # CORS, rate-limit, PII, headers, prompt-injection, score
│   └── entra-id-auth.js              # JWT Entra ID, RBAC, MFA opcional, audit
│
├── agents/                           # FASE 3: Agent Router + Voice Orchestrator v2.0
│   ├── orchestrator.js               # Orquestrador (compatibilidade)
│   ├── router-agent.js               # Router inteligente
│   ├── voice-orchestrator.js         # Voice Orchestrator v2.0
│   ├── voice-specialist.js           # Charles Voice Executive Intelligence
│   ├── tts-specialist.js             # SSML dinâmico e prosódia (EXPANDIDO v2.0)
│   ├── prompt-naturalizer-agent.js   # Naturalização de prompt
│   ├── sentiment-classifier.js       # Classificador de sentimento
│   ├── faq-specialist.js             # Especialista em FAQ
│   ├── humanizer.js                  # Humanização de respostas
│   ├── context-memory.js             # Memória de contexto
│   ├── response-quality.js           # Qualidade de respostas
│   ├── knowledge-gap.js              # Lacunas de conhecimento
│   ├── download-specialist.js        # Downloads estruturados
│   ├── feedback-manager.js           # Verifica múltiplas fontes
│   └── specialist-document.js        # Leitura de documentos
│
├── voice/                            # FASE 4: Anti-Interrupção (NOVO v4.3)
│   ├── voice-state-machine.js        # Máquina de estados: IDLE→LISTENING→PROCESSING→TOOL_EXECUTING→SPEAKING→COMPLETED
│   ├── voice-session-manager.js      # Orquestra turnos de voz, integra todos os módulos
│   ├── exclusive-playback-lock.js    # Lock exclusivo (evita áudio sobreposto)
│   ├── response-queue.js             # Fila de prioridade (HIGH/NORMAL/LOW) durante SPEAKING
│   ├── tool-gate.js                  # Pré-fala: executa tools ANTES de liberar TTS
│   ├── safe-tool-executor.js         # Execução segura com timeout/cancelamento
│   ├── response-consolidator.js      # Consolida resposta final (tools + LLM + fallback)
│   ├── safe-tts-streamer.js          # Stream TTS com cancelamento cooperativo
│   ├── interruption-manager.js       # Detecta "pare/silêncio" vs comandos; bloqueia SYSTEM interrupt
│   ├── circular-audio-buffer.js      # Buffer circular para pré-carregamento
│   └── cancellation-token.js         # Token de cancelamento propagado por toda a cadeia
│
├── rag/                              # FASE 1: RAG Enterprise
│   ├── vector-store.js               # Interface abstrata
│   ├── local-vector-store.js         # SQLite + cosine similarity
│   ├── embeddings.js                 # Embeddings (Gemini/OpenAI/Local)
│   ├── chunker.js                    # Chunking inteligente
│   ├── document-loader.js            # Multi-formato (PDF, DOCX, XLS, TXT, MD)
│   └── rag-service.js                # Serviço RAG principal
│
├── tools/                            # FASE 2: Tool Calling
│   ├── base-tool.js                  # Classe base abstrata
│   ├── tool-registry.js              # Registro de ferramentas
│   ├── calculate-tool.js             # Calculadora
│   ├── search-knowledge-tool.js      # Busca na base (RAG)
│   ├── current-date-tool.js          # Data/hora atual
│   └── system-status-tool.js         # Status do sistema
│
├── memory/                           # FASE 4: Modern Memory
│   ├── memory-manager.js             # Gerenciador central
│   ├── short-term-memory.js          # Memória de curto prazo (RAM)
│   ├── long-term-memory.js           # Memória de longo prazo (SQLite)
│   └── semantic-memory.js            # Memória semântica (User Facts)
│
├── streaming/                        # FASE 5: Streaming
│   └── sse-handler.js                # Server-Sent Events
│
├── multimodal/                       # FASE 6: Multimodalidade
│   └── file-processor.js             # Processador de arquivos
│
├── observability/                    # FASE 7: Observabilidade
│   ├── tracer.js                     # Tracing completo
│   └── metrics.js                    # Métricas e dashboard
│
├── cache/                            # v4.2: Cache Redis + fallback LRU
│   └── redis-cache.js                # Cache manager
│
├── guardians/                        # Guardiões do sistema
│   ├── knowledge-guardian.js         # Integridade da base
│   ├── code-guardian.js              # Qualidade do código
│   ├── system-guardian.js            # Arquitetura do sistema
│   ├── deployment-guardian.js        # Validação pré-deploy
│   └── test-guardian.js              # Qualidade de testes
│
��── __tests__/                        # Testes automatizados (Jest)
    ├── setup.js
    ├── llm-provider.test.js
    ├── orchestrator.test.js
    ├── router-agent.test.js
    ├── rag-service.test.js
    ├── rag-advanced.test.js
    ├── memory-manager.test.js
    ├── memory-voice.test.js
    ├── tools.test.js
    ├── sentiment-humanizer.test.js
    ├── faq-literal-response.test.js
    ├── datacenter-location.test.js
    ├── chunker-document-loader.test.js
    ├── charles-ai-v4.test.js
    ├── api-rbac.test.js
    ├── api-contract.test.js
    ├── api-auth.test.js
    └── voice-session.test.js         # NOVO: Testes da camada anti-interrupção
```

---

## ��� Configuração

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite .env com suas chaves de API e segurança
```

Variáveis de segurança relevantes:

| Variável | Dev | Produção | Descrição |
|----------|-----|----------|-----------|
| `ALLOW_ANONYMOUS` | `true` | `false` | Libera API sem JWT (só desenvolvimento) |
| `AZURE_TENANT_ID` | opcional | obrigatório | Tenant Microsoft Entra ID |
| `AZURE_CLIENT_ID` | opcional | obrigatório | App Registration |
| `ALLOWED_ORIGINS` | localhost | whitelist | CORS restritivo |
| `ALLOW_INSECURE_TLS` | `false` | `false` | Só `true` se proxy corporativo exigir |
| `REQUIRE_MFA` | `false` | recomendado | Exige MFA no token |

Documentação completa: [`docs/SEGURANCA-ENTRA-ID.md`](docs/SEGURANCA-ENTRA-ID.md).

### 3. Iniciar o servidor

```bash
npm start
# ou
npm run dev
```

O servidor estará disponível em `http://localhost:3000`.

Consulte o nível de segurança em runtime:

```bash
curl http://localhost:3000/api/status
# → seguranca.nivel (7.5 em dev | 9.5 com Entra ID obrigatório)
```

---

## ��� API Endpoints

### Básicos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/status` | Status + **nível de segurança** + RAG + métricas (público) |
| GET | `/api/faq` | Base de conhecimento FAQ |
| POST | `/api/chat` | Processa pergunta (JSON) — requer auth se `ALLOW_ANONYMOUS=false` |
| POST | `/api/chat/stream` | Processa com streaming SSE |
| GET | `/api/sugestoes` | Sugestões de perguntas (público) |
| GET | `/api/providers` | Provedores de LLM (público) |
| GET | `/api/agentes` | Status dos agentes + router |
| GET | `/api/guardians` | Relatório dos guardiões |
| POST | `/api/chat/reset` | Reseta conversa (**admin/gerente**) |

### FASE 1: RAG Enterprise
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/rag/stats` | Estatísticas do RAG |
| POST | `/api/rag/index` | Indexa arquivo (**admin**) |
| POST | `/api/rag/index-url` | Indexa URL (**admin**) |
| POST | `/api/rag/index-text` | Indexa texto (**admin**) |
| POST | `/api/rag/search` | Busca semântica |
| DELETE | `/api/rag/clear` | Limpa base RAG (**admin**) |

### FASE 2: Tool Calling
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/tools` | Lista ferramentas |
| GET | `/api/tools/stats` | Estatísticas |
| POST | `/api/tools/execute` | Executa ferramenta |

### FASE 3: Voice Orchestrator v2.0
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/voice/orquestrator/process` | Processa texto com voz |
| GET | `/api/voice/orquestrator/diagnostico` | Diagnóstico do sistema |
| POST | `/api/voice/orquestrator/personalidade` | Alterar personalidade |

### FASE 4: Modern Memory
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/memory/stats` | Estatísticas de memória |
| GET | `/api/memory/facts` | Fatos do usuário |
| POST | `/api/memory/reset` | Reseta memória (**admin/gerente**) |

### FASE 4: Camada Anti-Interrupção (v4.3)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/voice/session/process` | Processa turno de voz (VoiceSessionManager) |
| POST | `/api/voice/session/stop` | Interrompe fala atual (barge-in) |
| GET | `/api/voice/session/status` | Estado da sessão de voz |

### FASE 6: Multimodalidade
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/upload` | Upload de arquivo (**admin/gerente**) |
| GET | `/api/upload/supported-types` | Tipos suportados (público) |

### FASE 7: Observabilidade
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/observability/dashboard` | Dashboard completo (**admin**) |
| GET | `/api/observability/traces` | Traces recentes (**admin**) |
| GET | `/api/observability/stats` | Estatísticas agregadas |

### FASE 8: Smart Model Selection
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/model/complexity?q=` | Analisa complexidade |

### FASE 9: Segurança (Entra ID + Hardening)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/status` → `seguranca` | Score dinâmico (0–10), controles e recomendações |

### v4.2: Cache e Documentos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/cache/stats` | Estatísticas do cache |
| POST | `/api/cache/clear` | Limpa cache (**admin**) |
| GET | `/api/documents/:filename/thumbnail` | Thumbnail do documento |
| GET | `/api/documents/:filename/download` | Download do documento |
| GET | `/api/pdf/list` | Lista PDFs indexados |
| POST | `/api/pdf/ask` | Pergunta sobre PDF indexado |

---

## ������ Funcionalidades por Fase

### FASE 1: RAG Enterprise
- **Chunking inteligente**: Recursive Character Splitter com overlap
- **Embeddings semânticos**: Gemini (768d), OpenAI (1536d), ou local hash (384d)
- **Similarity Search**: Cosine similarity em SQLite
- **Context Retrieval**: Recupera contexto relevante automaticamente
- **Context Compression**: Filtra resultados de baixa qualidade
- **Indexação automática**: XLS, XLSX, PDF, DOCX, TXT, Markdown, URLs

### FASE 2: Tool Calling
- **Framework interno**: Cada ferramenta tem name, description, input/output schema, validation, timeout
- **Ferramentas**: CalculateTool, SearchKnowledgeTool, CurrentDateTool, SystemStatusTool
- **Seleção automática**: O sistema detecta intenção e executa ferramentas
- **Orquestração**: analisa → decide → executa → retorna → sintetiza

### FASE 3: Agent Router + Voice Orchestrator v2.0
- **Classificação de intenção**: GREETING, FAQ_KNOWLEDGE, CALCULATION, SYSTEM_QUERY, TEMPORAL, CONVERSATION, COMPLEX_REASONING, CONTINUATION
- **Roteamento dinâmico**: Seleciona apenas agentes necessários
- **Redução de latência**: Menos agentes = resposta mais rápida
- **Redução de custo**: Menos processamento desnecessário
- **Voice Orchestrator v2.0**: SSML dinâmico, prosódia adaptativa, sentimento, personalidade dinâmica

### FASE 4: Memória Moderna + Camada Anti-Interrupção
- **Short-Term Memory**: Últimas interações em RAM (janela deslizante)
- **Long-Term Memory**: Persiste conversas em SQLite + Conversation Summary
- **Semantic Memory**: Extrai fatos do usuário (nome, email, departamento, etc.)
- **Recuperação automática**: "Meu nome é Carlos" → "Qual é meu nome?"
- **Voice State Machine**: 7 estados (IDLE, LISTENING, PROCESSING, TOOL_EXECUTING, SPEAKING, COMPLETED, INTERRUPTED)
- **Exclusive Playback Lock**: Garante áudio não sobreposto
- **Response Queue**: Fila de prioridade durante SPEAKING
- **Tool Gate**: Executa tools ANTES de liberar TTS
- **Safe Tool Executor**: Timeout, cancelamento, retry
- **Response Consolidator**: Une tools + LLM + fallback direto
- **Safe TTS Streamer**: Stream com cancelamento cooperativo
- **Interruption Manager**: Detecta "pare/silêncio" (USER_STOP) vs comandos; bloqueia SYSTEM interrupt durante fala
- **Circular Audio Buffer**: Pré-carregamento de áudio
- **Cancellation Token**: Propaga cancelamento por toda a cadeia
- **Voice Session Manager**: Orquestra turnos completos
- **VoiceClient Frontend**: AudioContext nativo, lock, fila, `handleUserStop()` para barge-in

### FASE 5: Streaming
- **Server-Sent Events (SSE)**: Respostas token-by-token
- **Eventos**: token, metadata, routing, context, tool_call, done, error
- **UX similar ao ChatGPT**: Texto aparece gradualmente

### FASE 6: Multimodalidade
- **Upload de arquivos**: PDF, DOCX, XLS, XLSX, TXT, MD, imagens
- **Extração de conteúdo**: Automática via document-loader
- **Indexação automática**: Arquivos são indexados no RAG
- **Perguntas sobre conteúdo**: "Resuma este PDF", "Explique este contrato"

### FASE 7: Observabilidade
- **Tracing completo**: agente, tempo, modelo, tokens, ferramenta, custo
- **Dashboard operacional**: Métricas em tempo real
- **Custo estimado**: Cálculo automático por modelo
- **Histórico de traces**: Últimas N requisições com detalhes

### FASE 8: Smart Model Selection
- **Classificação**: LOW (modelo barato), MEDIUM (intermediário), HIGH (premium)
- **Otimização de custo**: Perguntas simples usam modelo menor
- **Fallback automático**: Groq → OpenRouter → Gemini
- **Modelos por complexidade**:
  - LOW: llama-3.1-8b-instant / gemini-1.5-flash
  - MEDIUM: llama-3.3-70b-versatile / gemini-1.5-flash
  - HIGH: llama-3.3-70b-versatile / gemini-1.5-pro

### FASE 9: Segurança
- **Hardening**: CORS, rate-limit, PII, prompt-injection
- **Entra ID**: JWT, RBAC, MFA opcional
- **Auditoria**: Logs de acesso e uso

### v4.2: Cache e Downloads
- **Cache Redis**: Cache distribuído quando disponível
- **Fallback LRU**: Cache em memória se Redis indisponível
- **Download estruturado**: URLs, thumbnails e metadados de documentos
- **Greeting detection**: Respostas curtas para saudações, agradecimentos e despedidas
- **Streaming SSE robusto**: Metadados completos no fallback síncrono

### v4.3: Camada Anti-Interrupção de Voz
- **State Machine determinística**: Transições válidas apenas, eventos tipados
- **Lock exclusivo de reprodução**: Impede áudio sobreposto (race condition free)
- **Fila de resposta com prioridade**: HIGH/NORMAL/LOW durante SPEAKING
- **Tool Gate pré-fala**: Bloqueia TTS até tools concluírem
- **Execução segura de tools**: Timeout, cancelamento, retry automático
- **Consolidação de resposta**: Une tools + LLM + fallback direto
- **TTS Streamer seguro**: Cancelamento cooperativo, chunked streaming
- **Interruption Manager**: Distingue USER_STOP ("pare", "silêncio") de comandos; bloqueia SYSTEM interrupt durante SPEAKING
- **Buffer circular de áudio**: Pré-carregamento para latência percebida zero
- **Cancellation Token**: Propaga cancelamento por toda a cadeia (LLM → tools → TTS)
- **Voice Session Manager**: Orquestra turnos completos de voz
- **VoiceClient Frontend**: AudioContext, lock, fila, `handleUserStop()` para barge-in real

---

## ������ Tecnologias

- **Backend**: Node.js, Express.js
- **LLM**: Groq (Llama 3.3 70B), OpenRouter, Google Gemini
- **Auth**: Microsoft Entra ID (JWT + JWKS), RBAC
- **Security**: CORS whitelist, rate-limit, PII scrubber, prompt-injection guard
- **Vector Store**: SQLite + cosine similarity (local, sem servidor externo)
- **Embeddings**: Gemini text-embedding-004, OpenAI text-embedding-3-small, ou local hash
- **Memória**: SQLite (better-sqlite3)
- **Streaming**: Server-Sent Events (SSE)
- **Upload**: Multer
- **Document Processing**: xlsx, pdf-parse, mammoth
- **Áudio**: Web Audio API (frontend), TTS neural (ElevenLabs/OpenAI/Azure)

---

## ��� Exemplos de Uso

### Chat com streaming SSE
```javascript
await chatAPI.enviarMensagemStream('Qual o procedimento de segurança?', 'default', {
  onToken: (token) => console.log(token),
  onMetadata: (data) => console.log('Fonte:', data.fonte),
  onDone: (data) => console.log('Concluído:', data)
});
```

### Indexar arquivo no RAG
```bash
curl -X POST http://localhost:3000/api/rag/index \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/document.pdf"}'
```

### Upload de arquivo multimodal
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@document.pdf"
```

### Dashboard de observabilidade
```bash
curl http://localhost:3000/api/observability/dashboard
```

### Nível de segurança
```bash
curl http://localhost:3000/api/status
# Campo: seguranca.nivel → 7.5 (dev) ou 9.5 (Entra ID obrigatório)
```

### Processar turno de voz (v4.3)
```bash
curl -X POST http://localhost:3000/api/voice/session/process \
  -H "Content-Type: application/json" \
  -d '{"userInput": "Qual o telefone do data center?", "sessionId": "user-123"}'
```

### Interromper fala (barge-in)
```bash
curl -X POST http://localhost:3000/api/voice/session/stop \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "user-123"}'
```

---

## ��� Licença

Projeto interno - Claro Empresas / Data Center