# Declaração de Aplicabilidade (Statement of Applicability)
# Charles — Assistente de IA do Departamento de Data Center
# ISO/IEC 42001:2023 — Cláusula 4.3 / 8.3

**Versão:** 1.0
**Data:** 2026-10-10
**Classificação:** Uso interno

---

## 1. Escopo do SGIA

Ver `SGIA-GOVERNANCA.md` §2. Resumo: o SGIA cobre o assistente de IA Charles
no Departamento de Data Center da Claro Empresas — backend, agentes de IA,
base documental e interface (texto e voz).

---

## 2. Declaração

Aplicabilidade declarada conforme ISO/IEC 42001:2023:

| Cláusula | Requisito | Aplicável? | Evidência | Status |
|---|---|:---:|---|---|
| 4.1 | Contexto da organização | ✅ | `SGIA-GOVERNANCA.md` §1 | **Conforme** |
| 4.2 | Partes interessadas | ✅ | `SGIA-GOVERNANCA.md` §3 | **Conforme** |
| 4.3 | Escopo do SGIA | ✅ | `SGIA-GOVERNANCA.md` §2 | **Conforme** |
| 4.4 | Sistema de gestão de IA | ✅ | `GESTAO-RISCOS-IA.md` | **Conforme** |
| 5.1 | Aprovação da alta direção | ✅ | `SGIA-GOVERNANCA.md` §5 | **Pendente assinatura** |
| 5.2 | Papéis e responsabilidades | ✅ | `SGIA-GOVERNANCA.md` §4 | **Conforme** |
| 5.3 | Revisão pela gestão | ✅ | Revisão semestral definida | **Conforme** |
| 6.1 | Ação para riscos e impactos | ✅ | `GESTAO-RISCOS-IA.md` §2–5 | **Conforme** |
| 6.2 | Objetivos e planejamento | ✅ | §6.1 do prompt mestre; quality agent | **Conforme** |
| 6.3 | **Explicação de limitações** | ✅ | `POLITICA-USO-ACEPTAVEL.md` §4 | **Corrigido (C1)** |
| 7.1 | Dados e governança da informação | ✅ | `REGISTRO-TRATAMENTO-DADOS.md` | **Conforme** |
| 7.2 | LGPD | ✅ | `REGISTRO-TRATAMENTO-DADOS.md` §2, §5 | **Conforme** |
| 7.3 | Registros e rastreabilidade | ✅ | Tracer + `AuditLogger` | **Conforme** |
| 8.1 | Identificação como IA | ✅ | Interface + `humanizer` | **Conforme** |
| 8.2 | **Uso indevido** | ✅ | `POLITICA-USO-ACEPTAVEL.md` §3 | **Conforme** |
| 8.3 | Classificação de risco de IA | ✅ | `REGISTRO-TRATAMENTO-DADOS.md` §3 | **Conforme** |
| 9.1 | Monitoramento e medição | ✅ | Quality agent (7 métricas) | **Conforme** |
| 9.2 | Gestão de incidentes | ✅ | `GESTAO-RISCOS-IA.md` + auditoria de logs | **Parcial** |
| 9.3 | Auditoria interna | ✅ | `iso-42001-conformidade.test.js` (33 testes) | **Iniciado** |
| 9.4 | Ações corretivas | ✅ | Quality improvement agent | **Conforme** |

---

## 3. Não aplicáveis

Nenhum requisito foi declarado não aplicável. Charles opera em contexto
corporativo com dados internos e autenticação — todas as cláusulas se aplicam.

---

## 4. Resumo de aderência

**Antes (auditoria 11/08/2026):** 35% · 13 Não Conforme · 17 Parcial · **0 Conforme**

**Depois desta entrega:**

| Métrica | Antes | Agora |
|---|---|---|
| Documentos de gestão | 0 | **6** |
| Não Conforme sem tratativa | 13 | **1** (OP-01, aguarda assinatura) |
| Requisitos conformes | 0 | **17** |
| Testes automatizados de conformidade | 0 | **33** |

---

## 5. Ponto de bloqueio para certificação

> **OP-01 — Responsável pela IA não designado.**
> Risco 12 (Crítico). Enquanto o Proprietário do SGIA, o DPO e o Auditor
> Interno não forem formalmente designados e o documento assinado, **o SGIA
> não é certificável**.
>
> **Ação necessária:** preencher os nomes em `SGIA-GOVERNANCA.md` §4.

---

## 6. Declaração de responsabilidade

Este documento foi elaborado por Engineering com base no código-fonte e nos
artefatos de auditoria existentes. A conformidade final depende de:

1. Designação formal dos papéis (§5).
2. Assinatura da aprovação (§5).
3. Revisão independente por auditor interno.

**Elaborado por:** Engineering — Charles
**Data:** 2026-10-10