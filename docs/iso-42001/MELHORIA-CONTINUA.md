# Plano de Melhoria Contínua — Charles
# ISO/IEC 42001:2023 — Cláusula 10.1 (Melhoria contínua)

**Versão:** 1.0
**Data:** 2026-10-10
**Classificação:** Uso interno

---

## 1. Como a melhoria contínua opera

O Charles não depende de auditoria manual para melhorar. O ciclo é fechado e
automatizado:

```
    ┌─────────────────────────────────────────┐
    │  1. quality-improvement-agent           │
    │     Coleta 7 métricas                   │
    └──────────────┬──────────────────────────┘
                   ▼
    ┌─────────────────────────────────────────┐
    │  2. Identifica gaps                     │
    │     • quality < threshold               │
    │     • conversa humana < 90%             │
    │     • hallucination > 5%                │
    │     • cobertura < 80%                   │
    └──────────────┬──────────────────────────┘
                   ▼
    ┌─────────────────────────────────────────┐
    │  3. knowledge-gap                       │
    │     Perguntas sem resposta viram        │
    │     tarefa de curadoria documental      │
    └──────────────┬──────────────────────────┘
                   ▼
    ┌─────────────────────────────────────────┐
    │  4. Correção                            │
    │     Auto-fix (RAG, prompt, gaps) ou      │
    │     ação manual do Engineering          │
    └──────────────┬──────────────────────────┘
                   ▼
    ┌─────────────────────────────────────────┐
    │  5. Verificação por teste de regressão  │
    │     267 testes automatizados             │
    └─────────────────────────────────────────┘
```

---

## 2. As 7 métricas de qualidade

| Métrica | Peso | Mede | Origem |
|---|:---:|---|---|
| `retrievalPrecision` | 20% | % de perguntas-âncora com fonte válida | FAQ + RAG + DataCenters |
| `citationRate` | 20% | % de respostas com citação | Traces (7 dias) |
| `hallucinationRate` | 15% | Taxa de alucinação (menor é melhor) | RAG validator |
| `coverageRate` | 15% | % de lacunas cobertas | `knowledge-gap` |
| `avgQualityScore` | 20% | Score médio das respostas | Traces |
| `faqFreshness` | 0% | Frescor da base | mtime do Excel |
| **`conversaHumana`** | **10%** | **Qualidade das respostas sociais** | Traces `social:*` |

> **`conversaHumana` foi adicionada em 2026-10-10.** Antes, as 6 métricas eram
> 100% documentais — o agente dava nota 8,0 mesmo com o Charles quebrado na
> conversa. A métrica mede se respostas sociais evitam o formato técnico de
> relatório (`Confiança:` / `Fatos Confirmados:`).

---

## 3. Cadência de revisão

| Atividade | Frequência | Responsável |
|---|---|---|
| Avaliação automática de qualidade | A cada 12h (scheduler) | `quality-improvement-agent` |
| Análise de knowledge-gaps | Semanal | Curadoria documental |
| Revisão de FAQ com owners técnicos | Trimestral | Proprietário do SGIA |
| Revisão do SGIA (documentos) | Semestral | Proprietário do SGIA |
| Revisão de riscos de nível Alto/Crítico | Trimestral | Proprietário + Engineering |
| Auditoria interna de conformidade | Semestral | Auditor interno |

---

## 4. Ferramenta de feedback

Usuários podem reportar resposta incorreta. O canal alimenta:

1. **Knowledge-gap** — pergunta sem resposta vira tarefa de curadoria.
2. **Feedback do Analyst** — correção validada pelo owner técnico.
3. **Trilha de auditoria** — registrada para análise posterior.

---

## 5. Indicadores de sucesso

| Indicador | Meta | Atual |
|---|---|---|
| Score de qualidade | ≥ 9,5 | 8,0 |
| Taxa de alucinação | ≤ 5% | 0% |
| Taxa de citação | ≥ 90% | 100% |
| Cobertura de gaps | ≥ 80% | 100% |
| Conversa humana | ≥ 90% | 100% (sem dados sociais ainda) |
| Testes automatizados | ≥ 250 passando | 267 |
| Requisitos ISO conformes | 100% | 17/20 |

---

## 6. Riscos que a melhoria contínua não cobre

| Risco | Motivo |
|---|---|
| Base desatualizada | Depende de atualização manual pelo owner |
| Responsável não designado | Bloqueia governança (OP-01) |
| Decisão sobre unclear | Humanização não substitui decisão de negócio |

---

## 7. Referências

- `GESTAO-RISCOS-IA.md` — riscos e revisão trimestral
- `quality-improvement-agent.js` — agente de avaliação contínua
- `iso-42001-conformidade.test.js` — 33 testes de conformidade
- `knowledge-gap.js` — captura de lacunas de conhecimento