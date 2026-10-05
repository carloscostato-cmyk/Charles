# 🎯 Plano para Reduzir a Taxa de Alucinação do Charles

**Objetivo:** reduzir a Taxa de Alucinação de **44% → ≤ 5%** (meta do agente de qualidade), subindo a nota geral do Charles rumo ao 10/10.

---

## 📌 1. Diagnóstico (o que está causando os 44%)

**Como a métrica é medida:** uma resposta entra como "possível alucinação" quando tem **mais de 200 caracteres** E o contexto RAG da pergunta **não foi validado** (nenhuma fonte com relevância/confiança suficientes).

Hoje: **22 das 50 últimas respostas** estão nessa situação. As causas raiz identificadas são:

| # | Causa raiz | Evidência no sistema |
|---|-----------|----------------------|
| 1 | **Motor de busca fraco (embeddings de hash local)** | Log: `[Embeddings] Provedor ativo: local-hash (384 dims)`. O `.env` não tem `GEMINI_API_KEY` nem `OPENAI_API_KEY` — por isso quase toda busca retorna `0 resultados validados`, mesmo para perguntas que TÊM resposta na base (ex.: "Onde fica o DC de Barueri?", "Onde fica Campinas?") |
| 2 | **Perguntas sem documentação recebem resposta "inventada" do LLM** | `knowledge-gaps.json` registra respostas `fonte=llm` e `fonte=llm-fallback`: failover, SLA do DC, Tier III, acesso ao DC, backup, firmware, senha do servidor, F5 Big-IP, telefone do presidente |
| 3 | **FAQ sem datas** | `FAQ Freshness: 0%` — a planilha `FQ_DATA_CENTER.xls` não tem coluna de data de atualização |
| 4 | **Cobertura de lacunas baixa** | `Coverage Rate: 14%` — os temas perguntados sem fonte não têm FAQ/item na base |

**O que JÁ está do nosso lado:** o prompt-master tem regra "Nunca invente...", o `llm-client` já registra lacunas, o validador RAG foi apertado (`MIN_RELEVANCE_SCORE 0.35`) e o agente roda 3x/dia monitorando.

---

## 🚀 2. FASE 1 — Melhorar o "motor de busca" (MAIOR IMPACTO · ~30 min)

> 💡 Esta é a ação nº 1. O sistema foi feito para usar embeddings semânticos do **Google Gemini (grátis)** e cair para o modo fraco (hash) quando não há chave configurada. **É exatamente o que está acontecendo hoje.**

**Passo 1.1 — Criar uma chave GRATUITA do Google Gemini**
- Acesse: `aistudio.google.com` → botão **"Get API key"** → **Create API key**
- (Gratuito, sem cartão de crédito, para uso em volume moderado)

**Passo 1.2 — Instalar a chave no Charles**
- Abra o arquivo `.env` (na raiz do projeto) e adicione a linha:
  ```
  GEMINI_API_KEY=cole_a_sua_chave_aqui
  ```
- Salve o arquivo. Nada mais precisa ser feito — o Charles detecta a chave sozinho na próxima inicialização (o log passará a mostrar `Provedor ativo: gemini (768 dims)`).

**Passo 1.3 — Reindexar a base de conhecimento (obrigatório)**
- Os vetores antigos (hash) são incompatíveis com os novos (Gemini) — a base precisa ser reconstruída: **159 itens de FAQ + Data Centers + PDFs**.
- **Ação:** me avise ("chave instalada") que **eu executo a reindexação** e valido o resultado com o agente.
- ✅ Resultado esperado: perguntas que têm resposta na base passam a ser encontradas e citadas → as respostas deixam de ser "só LLM".

---

## 📚 3. FASE 2 — Conteúdo oficial (com o time · sem código)

**Passo 2.1 — Responder os temas mais perguntados SEM fonte** (lista atual do `knowledge-gaps.json`; cada um vira um item na planilha `FQ_DATA_CENTER.xls`):

| Tema perguntado | Ação necessária |
|---|---|
| "Explique como funciona o failover em data centers" | Documentação oficial → FAQ |
| "Qual é o SLA do Data Center?" | Documentação oficial → FAQ |
| "O que é um Data Center Tier III?" | Documentação oficial → FAQ |
| "Como solicitar acesso ao Data Center?" | Documentação oficial → FAQ |
| "Procedimento de backup e recuperação" | Documentação oficial → FAQ |
| "Procedimento para atualização de firmware" | Documentação oficial → FAQ |
| "Olá, como vai?" (small talk) | Criar item de FAQ de saudação (resposta curta padrão) |

> 📌 Regra de ouro: se o tema **não tem** documentação oficial, a resposta oficial do Charles passa a ser **"Não encontrei evidência documental suficiente sobre isso."** — resposta curta e honesta (deixa de ser alucinação e vira encaminhamento).

**Passo 2.2 — Definir a lista "FORA DE ESCOPO"** (o Charles nunca deve responder com conteúdo próprio):
- Ex.: credenciais/senhas, telefones de pessoas, configuração de equipamentos de terceiros (F5), dados pessoais.
- Para esses: resposta padrão educada + registro da lacuna (o sistema já registra automaticamente).

**Passo 2.3 — Adicionar a coluna "Data de Atualização" na FAQ** (`FQ_DATA_CENTER.xls`)
- Resolve o indicador `FAQ Freshness: 0%` e permite cobrar revisões periódicas.

**Passo 2.4 — Indexar os PDFs oficiais no RAG**
- Ex.: `PR PRQ 001 rev 19 - Controle de Documentos e Registros (3).pdf`, documentos da ISO 42001 e guias da pasta.
- Comando pronto (eu executo quando quiser): `npm run pdf:index` (dentro de `backend/`).

---

## 🛡️ 4. FASE 3 — Blindar o comportamento do Charles (comigo · ~30 min)

**Passo 3.1 — Reforçar o guardrail no prompt**
- Regra: *"Antes de responder, verifique se há fonte validada (FAQ/RAG). Se NÃO houver, responda apenas a mensagem padrão 'Não encontrei evidência documental suficiente...' — nunca complemente com conhecimento geral."*
- O prompt já tem a regra "Nunca invente"; vamos tornar o **comportamento de fallback** explícito e curto.

**Passo 3.2 — Teste de sanidade (antes × depois)**
- 4 perguntas que TÊM resposta na base → devem responder COM fonte.
- 4 perguntas que NÃO têm (ex.: "senha do servidor", "SLA", "Tier III") → devem responder "Não encontrei evidência documental...".
- Rodo o agente e comparo a Taxa de Alucinação no relatório do Charles.

---

## 📈 5. FASE 4 — Monitorar e melhorar continuamente

**Passo 4.1** — Acompanhar o relatório HTML do Charles após cada execução do agente (meta: **Alucinação ≤ 5%**, Cobertura ≥ 80%).
**Passo 4.2** — A cada ciclo (3x/dia útil), temas com `vezesPerguntada ≥ 2` nos knowledge-gaps viram **itens de FAQ**.
**Passo 4.3** — Revisão trimestral da FAQ com os owners técnicos (compromisso de processo).

---

## ✅ 6. Resumo executivo (quem faz o quê)

| Fase | O que fazer | Quem | Esforço | Impacto |
|------|-------------|-----|---------|---------|
| 1 | Chave Gemini no `.env` + reindexar base | Você (chave) + eu (reindexação) | 30 min | 🔥🔥🔥 Alto |
| 2 | FAQ: temas sem fonte + datas + fora de escopo + PDFs | Time de conteúdo (eu apoio) | 1-2h/tema | 🔥🔥 Alto |
| 3 | Guardrail de fallback no prompt + testes | Eu | 30 min | 🔥 Médio-Alto |
| 4 | Monitorar relatório 3x/dia e alimentar FAQ | Você + agente automático | contínuo | 🔥 Sustentação |

> 🎯 **Meta combinada:** Alucinação ≤ 5% e Nota do Charles ≥ 9,5 rumo ao 10 (melhor que o ChatGPT).