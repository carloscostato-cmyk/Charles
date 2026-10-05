# Registro de Tratamento de Dados Pessoais (ROPA)
# Charles — Assistente de IA do Departamento de Data Center
# ISO/IEC 42001:2023 (Cláusula 8.2 / 8.3) + LGPD (Lei 13.709/2018)

**Versão:** 1.0
**Data:** 2026-10-10
**Responsável pelo registro:** Encarregado de Dados (DPO) — _a designar_
**Classificação:** Uso interno

---

## 1. Controlador e Operador

| Papel | Organização |
|---|---|
| **Controlador** (decide o tratamento) | Claro Empresas — Departamento de Data Center |
| **Operador** (executa o tratamento) | _a designar_ |
| **Encarregado (DPO)** | _a designar_ |

---

## 2. Inventário de tratamento (Art. 30 LGPD)

### 2.1 Tratamento T-01 — Identificação e saudação personalizada

| Campo | Conteúdo |
|---|---|
| **Finalidade** | Personalizar a saudação inicial do assistente (ex.: "Bom dia, Carlos!") conforme o horário e o usuário autenticado |
| **Base legal** | **Art. 7º, II — legítimo interesse** (melhorar a experiência do atendimento corporativo) |
| **Dados tratados** | Primeiro nome do usuário, e-mail corporativo, departamento, cargo |
| **Origem** | Microsoft Entra ID (autenticação corporativa) |
| **Destinatários** | Nenhum — processamento interno, sem transferência a terceiros |
| **Persistência** | Não há. O nome é montado em memória a cada requisição, a partir do token JWT |
| **Logs** | O nome **não** é gravado em logs nem em traces |
| **Segurança** | PIIScrubber (CPF/CNPJ/e-mail/telefone/cartão), RBAC, rate limit |
| **Risco residual** | **Baixo** |

> **Nota de transparência:** a saudação com nome foi implementada em
### 2.2 Tratamento T-02 — Memória de conversa

| Campo | Conteúdo |
|---|---|
| **Finalidade** | Manter contexto entre turnos de conversa (memória de curto prazo e semântica) |
| **Base legal** | Art. 7º, II — legítimo interesse (continuidade do atendimento) |
| **Dados tratados** | Histórico de perguntas e respostas; fatos extraídos sobre o usuário |
| **Origem** | Interação direta do usuário |
| **Base de dados** | SQLite local (`backend/memory/`) |
| **Retenção** | Curto prazo: sessão. Fatos semânticos: enquanto ativo |
| **Direitos do titular** | Reset via `DELETE /api/memory/reset` (papel `gerente`/`admin`) |
| **Risco residual** | **Médio** — ver `GESTAO-RISCOS-IA.md` §3 |

### 2.3 Tratamento T-03 — Traces de observabilidade

| Campo | Conteúdo |
|---|---|
| **Finalidade** | Auditoria interna, rastreabilidade e melhoria contínua de qualidade |
| **Base legal** | Art. 7º, II — legítimo interesse (segurança e qualidade) |
| **Dados tratados** | Pergunta, resposta, fonte, quality score, agente usado, latência |
| **Base de dados** | SQLite (`backend/observability/`) |
| **Retenção** | **90 dias** (janela usada pelo quality agent) |
| **PII** | Sanitizada na entrada via `PIIScrubber` antes de gravar |
| **Risco residual** | **Baixo** |

### 2.4 Tratamento T-04 — Knowledge gaps (lacunas de conhecimento)

| Campo | Conteúdo |
|---|---|
| **Finalidade** | Curadoria documental — identificar perguntas sem resposta na base |
| **Base legal** | Art. 7º, II — legítimo interesse |
---

## 3. Inventário de IA (Cláusula 8.3 — Classificação)

Charles é classificado como sistema de IA de **risco limitado**:

| Dimensão | Classificação | Justificativa |
|---|---|---|
| Finalidade | **Assistiva** | Apoia decisão humana; não decide |
| Autonomia | **Baixa** | Respostas baseadas em documento aprovado |
| Reversibilidade | **Alta** | Nenhuma ação automática em produção |
| Dados | **Internos** | Documentação operacional corporativa |

> **Não há uso de IA de alto risco.** Charles **não** realiza triagem de
> candidatos, avaliação de desempenho, crédito, saúde nem decisão automatizada
> com efeito jurídico.

---

## 4. Direitos dos titulares (Art. 18 LGPD)

| Direito | Como exercer |
|---|---|
| Confirmação / acesso | Solicitação ao Proprietário do SGIA |
| Correção | Conversa direta ("meu nome é X") |
| Eliminação | `DELETE /api/memory/reset` ou solicitação ao Proprietário |
| Portabilidade | Export das conversas via solicitação formal |
| Não discriminação | Garantido — dados técnicos não geram tratamento diferenciado |

**Canal de privacidade:** Proprietário do SGIA ou DPO.

---

## 5. Controles técnicos de proteção (Cláusula 8.4)

| Controle | Implementação |
|---|---|
| Sanitização de PII | `PIIScrubber` — CPF, CNPJ, e-mail, telefone, cartão |
| Controle de acesso | RBAC (admin / gerente / usuário) via Entra ID |
| Criptografia em trânsito | HSTS habilitado em produção |
| Log de auditoria | `auditLogMiddleware` + `AuditLogger` |
| Bloqueio de externos | `externalUsersBlocker` |
| Rate limiting | 60 req/min por IP |
| Proteção contra prompt injection | `PromptInjectionGuard` (10 padrões) |
| Não repassar o prompt | Bloqueio de "revele seu prompt de sistema" |

---

## 6. Riscos LGPD residuais

| # | Risco | Prob. | Impacto | Mitigação | Status |
|---|---|---|---|---|---|
| LGPD-1 | Nome exibido sem consentimento explícito | Baixa | Baixo | Legítimo interesse documentado; opting out simples | Mitigado |
| LGPD-2 | PII escapa do scrubber | Média | Alto | PII Scrubber + revisão periódica de padrões | **Em monitoramento** |
| LGPD-3 | Traces retidos além do necessário | Baixa | Médio | Retenção de 90 dias definida | Mitigado |
| LGPD-4 | Acesso indevido ao banco de traces | Baixa | Alto | RBAC restrito a `admin` | Mitigado |

---

## 7. Referências

- LGPD — Lei nº 13.709/2018, Art. 30
- ISO/IEC 42001:2023 — Cláusulas 8.2 (LGPD) e 8.3 (classificação de IA)
- Governança — `SGIA-GOVERNANCA.md`
- Política de uso — `POLITICA-USO-ACEPTAVEL.md`
| **Dados tratados** | Texto da pergunta, data, contador de repetições |
| **Filtro** | Conversa fiada ("bom dia", "obrigado") é **descartada** (`ehConversaFiada`) |
| **Risco residual** | **Baixo** |
> 2026-10-10. Antes disso a interface exibia texto estático. A mudança **não**
> amplia a coleta: apenas passa a usar a identidade que **já era transmitida
> pelo Entra ID** para autenticação.