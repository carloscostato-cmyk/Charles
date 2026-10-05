# Gestão de Riscos de IA — Charles
# ISO/IEC 42001:2023 — Cláusula 6.1 (Ação para Riscos e Impactos)

**Versão:** 1.0
**Data:** 2026-10-10
**Método:** Análise de risco por matriz Probabilidade × Impacto
**Classificação:** Uso interno

---

## 1. Escala de avaliação

**Probabilidade:** Baixa (1) · Média (2) · Alta (3)
**Impacto:** Baixo (1) · Médio (2) · Alto (3) · Crítico (4)

**Nível = P × I**

| Nível | Classificação | Tratamento exigido |
|---|---|---|
| 1–3 | Baixo | Monitorar |
| 4–6 | Médio | Mitigar + monitorar |
| 8–9 | Alto | Mitigar obrigatoriamente + revisão trimestral |
| 10–12 | Crítico | **Não aceitável — corrigir antes de operar** |

---

## 2. Riscos técnicos (IA)

| ID | Risco | P | I | Nível | Tratamento | Status |
|---|---|---|---|---|---|---|
| IA-01 | **Alucinação** — resposta inventada com aparência técnica | 3 | 4 | **12 Crítico** | Prompt mestre §12 (política anti-alucinação) + `quality-enforcer` (citação obrigatória) + §25 (mensagem de ausência de evidência) | **Mitigado** |
| IA-02 | **Afirmação de status sem fonte** — declarar DC "operacional" | 3 | 4 | **12 Crítico** | `specialist-availability` reescrito: declara o limite e encaminha (ISO 6.3). Teste de regressão `iso-42001-conformidade.test.js` | **Corrigido (C1)** |
| IA-03 | Resposta fora de escopo (não é Data Center) | 2 | 2 | 4 Médio | `social-specialist` reconduz ao domínio; teste de regressão | Mitigado |
| IA-04 | Prompt injection (extração de prompt, bypass de regra) | 2 | 4 | 8 Alto | `PromptInjectionGuard` (10 padrões) + sanitização | Mitigado |
| IA-05 | Formato técnico em conversa (degrada a experiência) | 3 | 2 | 6 Médio | Métrica `conversaHumana` (10% da nota) + `social-specialist` antes do enforcer | **Mitigado (D3)** |
| IA-06 | Desconhecimento do horário (diz "Bom dia" à noite) | 2 | 1 | 2 Baixo | `humanizer.detectarPeriodo()` com horário real | Mitigado |
| IA-07 | Vazamento do prompt mestre | 1 | 3 | 3 Baixo | Guard bloqueia "revele seu prompt" | Mitigado |
| IA-08 | Fonte desatualizada (FAQ/planilha) | 3 | 3 | 9 Alto | Métrica `faqFreshness` + `knowledge-gap` alimentando curadoria | **Em monitoramento** |

---

## 3. Riscos de dados e privacidade (LGPD)

| ID | Risco | P | I | Nível | Tratamento | Status |
|---|---|---|---|---|---|---|
| DP-01 | PII na pergunta vaza para o trace | 2 | 4 | 8 Alto | `PIIScrubber` na entrada; retenção 90 dias | Mitigado |
| DP-02 | Nome do usuário usado sem base legal declarada | 1 | 2 | 2 Baixo | Registro T-01 com base legal (Art. 7º, II) | **Mitigado (B1)** |
| DP-03 | Memória de conversa retém dado sensível além do necessário | 2 | 3 | 6 Médio | Reset disponível; política de retenção definida | Mitigado |
| DP-04 | Acesso indevido aos traces | 1 | 4 | 4 Médio | RBAC (`admin`) | Mitigado |

> **Nota:** o bug do cartão de crédito mascarado como telefone foi **encontrado
> pelos testes de conformidade** e corrigido em 2026-10-10. Ver
> `backend/middleware/security-middleware.js` (ordem das regras do scrubber).

---

## 4. Riscos éticos e de uso indevido

| ID | Risco | P | I | Nível | Tratamento | Status |
|---|---|---|---|---|---|---|
| ET-01 | Usuário trata resposta do Charles como aprovação de mudança | 3 | 4 | **12 Crítico** | Política de uso §3 P-5; §10 do prompt mestre (segurança operacional) | Mitigado |
| ET-02 | Dependência excessiva do assistente | 2 | 2 | 4 Médio | Declaração de que é IA e não substitui Analyst | Mitigado |
| ET-03 | Viés algorítmico | 1 | 2 | 2 Baixo | Domínio técnico; sem avaliação de pessoas | Mitigado |
| ET-04 | Discriminação | 1 | 3 | 3 Baixo | Sem decisão sobre pessoas; RBAC por papel | Mitigado |
| ET-05 | IA usada sem o usuário saber que é IA | 2 | 3 | 6 Médio | Identificação como IA na interface (ISO 6.1) | Mitigado |

---

## 5. Riscos operacionais e de governança

| ID | Risco | P | I | Nível | Tratamento | Status |
|---|---|---|---|---|---|---|
| OP-01 | **Sem responsável designado** para o SGIA | 3 | 4 | **12 Crítico** | `SGIA-GOVERNANCA.md` §4 — **aguarda assinatura** | **Aberto — bloqueia certificação** |
| OP-02 | Base de conhecimento desatualizada | 3 | 3 | 9 Alto | Métrica + `knowledge-gap` + ciclo de revisão com owners | Em andamento |
| OP-03 | Falha de provedor de LLM | 2 | 2 | 4 Médio | Fallback chain + tabela local | Mitigado |
| OP-04 | Sem programa de auditoria interna | 2 | 3 | 6 Médio | Testes de conformidade automatizados (`iso-42001-conformidade.test.js`) | **Iniciado** |
| OP-05 | Agente "casca" (nome sem função) | 3 | 2 | 6 Médio | Inventário em `SGIA-GOVERNANCA.md` §2.1 | **Em análise** |

---

## 6. Riscos residuais não mitigáveis

| ID | Risco | Justificativa |
|---|---|---|
| RN-01 | Base de conhecimento em planilha | Migração para sistema documental é decisão de negócio |
| RN-02 | Sem HTTPS em desenvolvimento | Resolvido em produção via HSTS |

---

## 7. Revisão e aceite

| Campo | Responsável | Data |
|---|---|---|
| Elaboração | Engineering (Charles) | 2026-10-10 |
| Revisão técnica | _A designar_ | ____/____/______ |
| Aprovação | Proprietário do SGIA | ____/____/______ |

**Próxima revisão:** 2027-01-10 (trimestral, conforme nível Alto/Crítico)