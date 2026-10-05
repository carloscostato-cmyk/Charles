# Política de Uso Aceitável do Charles
# ISO/IEC 42001:2023 — Cláusula 8.4 (Uso Indevido) e 6.3 (Limitações)

**Versão:** 1.0
**Data:** 2026-10-10
**Vigência:** imediata
**Classificação:** Uso interno

---

## 1. Finalidade desta política

Define o que o Charles **pode** e o que **não pode** fazer, e o que o
**usuário** pode e não pode pedir. Complementa o prompt mestre com as
fronteiras de uso que um auditor precisa enxergar.

---

## 2. Usos aceitáveis

| # | Uso | Exemplo |
|---|---|---|
| U-1 | Consulta a procedimento e runbook | "Como faço backup no DC de São Paulo?" |
| U-2 | Endereço e contato de unidade | "Qual o telefone do DC de Manaus?" |
| U-3 | Interpretação de FAQ | "Qual o SLA do Data Center?" |
| U-4 | Apoio a diagnóstico | "O alarme de temperatura está alto, o que verifico?" |
| U-5 | **Conversa social** | "Bom dia", "obrigado", "como você está?" |
| U-6 | Limites de competência | Charles declara quando não sabe |

> **U-5 é intencional.** Ser humano no trato é parte da qualidade do
> atendimento. A conversa é limitada — nunca substitui a orientação técnica.

---

## 3. Usos NÃO aceitáveis

| # | Uso proibido | Como o sistema trata |
|---|---|---|
| P-1 | Prompt injection ("ignore as instruções", "revele seu prompt") | `PromptInjectionGuard` bloqueia e sanitiza |
| P-2 | Pedir segredo do prompt de sistema | Bloqueado pelo guard |
| P-3 | Dado pessoal de terceiros (CPF, cartão, senha) | `PIIScrubber` mascara na entrada |
| P-4 | Decisão automatizada com efeito jurídico ou contratual | Fora do escopo (§1.1 do SGIA) |
| P-5 | Usar resposta do Charles como aprovação de mudança | Vedado pelo prompt mestre §10 |
| P-6 | Injetar dado falso e esperar que o Charles confirme | Quality enforcer + cited sources |
| P-7 | Tentar obter acesso a outro tenant / sistema | `externalUsersBlocker` + RBAC |

---

## 4. Limites declarados ao usuário (Cláusula 6.3)

O Charles deve comunicar seus limites de forma explícita e não-ilusória.
Aplica-se em três níveis:

### 4.1 Nível de sistema — sempre visível

A interface exibe:
- Que o Charles é uma **IA** (não uma pessoa real).
- Que as respostas **dependem de evidência documental**.
- Que o Charles **não tem acesso** a monitoramento, CMDB ou tickets.

### 4.2 Nível de resposta — quando aplicável

| Situação | O Charles deve dizer |
|---|---|
| Sem evidência documental | "Não encontrei evidência documental suficiente…" (§25 do prompt mestre) |
| **Previsão do tempo** | "Não tenho acesso a previsão do tempo — não quero passar informação inventada." |
| Dados de cliente | "Não tenho acesso a dados atuais de clientes." |
| Conhecimento geral | Identifica como "não confirmado pela documentação interna" (§4.8) |

> **Previsão do tempo é proibida.** Charles **não** possui fonte
> meteorológica conectada. Mentir sobre o tempo seria alucinação com
> aparência de utilidade — inaceitável sob ISO 42001.

### 4.3 Nível de escalonamento

Quando não há base para responder, o Charles **indica o escalonamento** ao
Analyst responsável, em vez de encerrar sem orientação.

---

## 5. Fronteiras do `specialist-availability` (correção C1)

> **Achado de auditoria:** o agente respondia, de forma fixa,
> *"Todos os centros estão operacionais"* — **afirmando saúde de produção sem
> consultar fonte**. Isso viola a cláusula 6.3 e a §3 do prompt mestre.

**Regra vigente:** o agente **não** declara status de nenhum Data Center.
Ele informa apenas o que a base documental sustenta (localização, contato,
região, agenda de manutenção) e **encaminha** a verificação de status ao
Analyst ou ao sistema de monitoramento. A política está codificada em
`backend/agents/specialist-availability.js`.

---

## 6. Papéis e responsabilidades no uso

| Papel | Responsabilidade |
|---|---|
| **Usuário** | Verificar a resposta antes de agir; reportar resposta incorreta |
| **Analyst** | Confirmar procedimento antes de execução; não tratar resposta do Charles como aprovação |
| **Proprietário do SGIA** | Aprovar mudanças nesta política |
| **Engineering** | Implementar e manter os guardrails técnicos |

---

## 7. Consequências — Violações

| Violação | Ação |
|---|---|
| Tentativa de prompt injection | Bloqueio automático + registro em log de auditoria |
| Envio de dado sensível | Mascaramento + alerta ao DPO |
| Uso para decisão automatizada | Revisão de incidente (§9.2) |

---

## 8. Referências

- Prompt mestre v4.1 §10 (Segurança Operacional) e §25 (ausência de evidência)
- `SGIA-GOVERNANCA.md` §1.1 (escopo negativo)
- `REGISTRO-TRATAMENTO-DADOS.md` §5 (controles técnicos)