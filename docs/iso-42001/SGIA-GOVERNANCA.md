# SGIA — Sistema de Gestão de IA do Charles
# ISO/IEC 42001:2023 — Documento de Governança

**Versão:** 1.0
**Status:** Aprovado para operação
**Data de vigência:** 2026-10-10
**Próxima revisão:** 2027-04-10 (semestral)
**Classificação:** Uso interno — Claro Empresas, Departamento de Data Center

---

## 1. Finalidade do sistema de IA (ISO 42001 — Cláusula 4.1 / 6.1)

O **Charles** é um assistente de IA especializado em Data Center e Operações
NOC da Claro Empresas. Sua finalidade é:

1. **Reduzir o tempo de atendimento** (N1/N2/N3) dando acesso rápido e
   rastreável à documentação operacional.
2. **Apoiar o diagnóstico de incidentes** com procedimentos e runbooks
   versionados.
3. **Informar Addresses e contatos** das 11 unidades de Data Center.
4. **Escalar corretamente** quando a evidência documental é insuficiente.

### 1.1 O que o Charles NÃO é

Declaração explícita de escopo negativo, exigida pela cláusula 6.3
(Explicação de Limitações):

- **Não é** fonte de verdade. Toda resposta operacional exige procedência
  documental (FAQ item, RAG ou procedimento citado).
- **Não** possui acesso a sistemas de monitoramento, CMDB, tickets ou
  inventário em tempo real.
- **Não** emite parecer jurídico, médico, contábil ou jurídico-trabalhista.
- **Não** executa alterações em ambiente de produção.
- **Não** substitui julgamento técnico do Analyst responsável.

---

## 2. Escopo do SGIA (Cláusula 4.3)

### 2.1 Incluído no escopo

| Ativo | Descrição |
|---|---|
| Backend | Node.js + Express (`backend/server.js`) |
| Agentes | 5 especialistas de Data Center + rede de apoio |
| Base documental | `FQ_DATA_CENTER.xls` (159 FAQs), `sites_data_center.xlsx` (11 DCs) |
| Interface | `frontend/` (chat texto + voz) |
| Observabilidade | Tracer + banco SQLite de traces |
| Integração | Microsoft Entra ID (autenticação e identidade) |

### 2.2 Fora do escopo

- Infraestrutura de rede e servidores (gerida pela área de Infraestrutura).
- Sistemas de produção monitorados (Grafana, Zabbix, ServiceNow, CMDB).
- Ciclo de vida dos equipamentos físicos de Data Center.

### 2.3 Limitações conhecidas e aceitas

| Limitação | Impacto | Mitigação vigente |
|---|---|---|
| Sem acesso a monitoramento em tempo real | Charles não pode afirmar status de produção | Prompt mestre proíbe declarar execução em sistemas sem acesso |
| Base depende de planilhas (`.xls/.xlsx`) | Risco de desatualização | Métrica `faqFreshness` no quality agent + `knowledge-gap` |
| `specialist-availability` responde de forma genérica | Não representa status real | **Em correção — ver `POLITICA-USO-ACCEPTAVEL.md` §4** |

---

## 3. Contexto e partes interessadas (Cláusula 4.2)

| Parte interessada | Necessidade | Canal de atendimento |
|---|---|---|
| Analysts N1/N2/N3 | Resposta rápida e procedureiro correto | Chat + base documental |
| Coordenação técnica | Escalonamento e visão consolidada | Chat + escalonamento |
| Gestão do Data Center | Redução de MTTR e qualidade | Dashboard de qualidade |
| **DPO / Encarregado de Dados** | Conformidade LGPD e tratamento de dados | Canal de privacidade (§6) |
| Infosec | Segurança e controle de acesso | Fluxo de aprovação de mudanças |
| Proprietário do SGIA | Governança e aprovação de mudanças | Vide §4 |

### 3.1 Necessidades mapeadas

1. Reduzir tempo médio de primeiro atendimento.
2. Garantir rastreabilidade de toda orientação operacional.
3. Não gerar decisão automatizada sem evidência.
4. Proteger dados pessoais de usuários (LGPD).

---

## 4. Responsável pela IA e papéis (Cláusula 5.2 / 5.3)

> ⚠️ **Campo de preenchimento obrigatório antes da certificação.**
> A auditoria de 11/08/2026 apontou "Sem responsável formal designado" como
> **Não Conforme, Risco Alto**. Este documento precisa ser assinado.

| Papel | Responsável | Nome | Aprovação |
|---|---|---|---|
| **Proprietário do SGIA** (responsável pela IA) | _A designar_ | ____________ | ____/____/______ |
| **Encarregado de Dados (DPO)** | _A designar_ | ____________ | ____/____/______ |
| **Gestor do Departamento de Data Center** | _A designar_ | ____________ | ____/____/______ |
| **Responsável técnico (Engineering)** | _A designar_ | ____________ | ____/____/______ |
| **Auditor interno (ISO 42001)** | _A designar_ | ____________ | ____/____/______ |

### 4.1 Autoridades do Proprietário do SGIA

- Aprovar mudanças que afetem escopo, fontes ou política de uso.
- Convocar revisão extraordinária do SGIA.
- Autorizar ativação/desativação de novos agentes.
- Ser o ponto de escalonamento para incidente de IA (cláusula 9.2).

### 4.2 Matriz RACI das atividades do SGIA

| Atividade | Proprietário | DPO | Infosec | Engineering |
|---|---|---|---|---|
| Definir propósito e escopo | **A/R** | C | C | C |
| Aprovar fonte de dados | **A** | C | C | R |
| Política de uso aceitável | **A/R** | C | C | C |
| Avaliação de impacto LGPD | C | **A/R** | C | C |
| Mudança no prompt mestre | **A** | I | I | **R** |
| Incidente de IA | **A/R** | C | C | C |
| Revisão periódica | **A/R** | C | C | C |

*R = Responsável pela execução · A = Autoriza/aprova · C = Consultado · I = Informado*

---

## 5. Aprovação da alta direção (Cláusula 5.1)

A implantação do Charles no Departamento de Data Center foi aprovada pela
gestão, com as seguintes condições:

1. Todo uso fica restrito ao domínio de Data Center e Operações NOC.
2. Nenhuma decisão automatizada tem valor decisório sem Analyst responsável.
3. O tratamento de dados pessoais segue a LGPD e o registro em
   `REGISTRO-TRATAMENTO-DADOS.md`.
4. O SGIA é revisado semestralmente.

**Status da aprovação:** _Pendente de assinatura — ver §4._

---

## 6. Referências

- ISO/IEC 42001:2023 — Sistemas de gestão de IA
- LGPD (Lei 13.709/2018)
- Prompt mestre v4.1 — `backend/prompts/prompt-master.js`
- Política de uso aceitável — `POLITICA-USO-ACCEPTAVEL.md`
- Registro de tratamento de dados — `REGISTRO-TRATAMENTO-DADOS.md`
- Gestão de riscos — `GESTAO-RISCOS-IA.md`
- Declaração aplicável — `DECLARACAO-APLICABILIDADE.md`