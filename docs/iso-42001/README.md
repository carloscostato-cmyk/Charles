# SGIA Charles — Documentação ISO/IEC 42001:2023

**Assistente de IA Charles** — Departamento de Data Center, Claro Empresas

---

## Documentos do SGIA

| # | Documento | ISO/IEC 42001 | Arquivo |
|---|---|---|---|
| 1 | **Governança** | 4.1, 4.2, 4.3, 5.1, 5.2 | [`SGIA-GOVERNANCA.md`](./SGIA-GOVERNANCA.md) |
| 2 | **Declaração de Aplicabilidade** | 4.3, 8.3 | [`DECLARACAO-APLICABILIDADE.md`](./DECLARACAO-APLICABILIDADE.md) |
| 3 | **Gestão de Riscos** | 6.1 | [`GESTAO-RISCOS-IA.md`](./GESTAO-RISCOS-IA.md) |
| 4 | **Política de Uso Aceitável** | 6.3, 8.4 | [`POLITICA-USO-ACEPTAVEL.md`](./POLITICA-USO-ACEPTAVEL.md) |
| 5 | **Registro de Tratamento de Dados (ROPA)** | 8.2, 7.1 | [`REGISTRO-TRATAMENTO-DADOS.md`](./REGISTRO-TRATAMENTO-DADOS.md) |
| 6 | **Melhoria Contínua** | 10.1, 9.1 | [`MELHORIA-CONTINUA.md`](./MELHORIA-CONTINUA.md) |

---

## Planilhas editáveis

As planilhas abaixo são os **registros vivos** do SGIA — documentos que devem
ser preenchidos, assinados e revisados pela organização.

| Planilha | O que é | Preenchimento |
|---|---|---|
| `planilhas/00-LEIA-ME.xlsx` | Ordem de preenchimento | — |
| `planilhas/01-PAPELIS-RESPONSABILIDADES.xlsx` | **Designação de papéis** | 🔴 **BLOQUEIA CERTIFICAÇÃO** |
| `planilhas/02-MATRIZ-RACI.xlsx` | Responsabilidades por atividade | Trimestral |
| `planilhas/03-REGISTRO-INCIDENTES-IA.xlsx` | Log de incidentes | Contínuo |
| `planilhas/04-REGISTRO-NAO-CONFORMIDADES.xlsx` | NCs do ciclo de auditoria | Semestral |
| `planilhas/05-ROPA-TRATAMENTO-DADOS.xlsx` | Registro de tratamento (LGPD) | Trimestral |
| `planilhas/06-AVALIACAO-IMPACTO-ETICO.xlsx` | Decisões éticas do sistema | Semestral |
| `planilhas/07-PLANO-ACOES-CORRETIVAS.xlsx` | Ações e prazos | Trimestral |

Para regenerar as planilhas (após alterar a estrutura):

```bash
cd backend && npm run iso:planilhas
```

> **Ação bloqueante:** preencher `01-PAPELIS-RESPONSABILIDADES.xlsx` (PAP-01 a
> PAP-05) e assinar. Enquanto isso não ocorrer, o SGIA **não é certificável**
> (risco OP-01, nível 12 — Crítico).

---

## Como iniciar

**Se você é o Proprietário do SGIA:**
1. Preencha os nomes em [`SGIA-GOVERNANCA.md` §4](./SGIA-GOVERNANCA.md)
2. Assine a aprovação em §5
3. Revise os riscos em [`GESTAO-RISCOS-IA.md`](./GESTAO-RISCOS-IA.md)

**Se você é o Auditor interno:**
1. Leia a [`DECLARACAO-APLICABILIDADE.md`](./DECLARACAO-APLICABILIDADE.md) — mapeia cada cláusula
2. Verifique as evidências em [`backend/__tests__/iso-42001-conformidade.test.js`](../../backend/__tests__/iso-42001-conformidade.test.js)
3. Confirme o registro em [`REGISTRO-TRATAMENTO-DADOS.md`](./REGISTRO-TRATAMENTO-DADOS.md)

**Se você é o Encarregado de Dados (DPO):**
1. Revise os tratamentos em [`REGISTRO-TRATAMENTO-DADOS.md` §2](./REGISTRO-TRATAMENTO-DADOS.md)
2. Avalie o risco residual em §6
3. Confirme os controles técnicos em §5

---

## Estado atual

```
Aderência declarada:      35% →(meta 100%)
Requisitos conformes:     0 → 17
Não conformidades abertas: 13 → 1 (bloqueio: assinatura)
Testes de conformidade:   0 → 33
Testes totais do projeto: 267
```

---

## Regras de ouro

> **1. Nada de previsão meteorológica.** Charles não tem fonte de clima.
> Inventar previsão seria alucinação com aparência de utilidade.
>
> **2. Nada de status operacional.** Sem acesso a monitoramento, o Charles
> não afirma se um Data Center está no ar.
>
> **3. Sempre citar a fonte.** Toda orientação operacional exige procedência
> documental (FAQ, RAG ou procedimento).
>
> **4. Falar como gente, trabalhar com rigor.** Conversa humana é o diferencial;
> rastreabilidade é a obrigação. As duas coisas convivem.

---

**Classificação:** Uso interno
**Revisão:** semestral · **Próxima:** 2027-04-10