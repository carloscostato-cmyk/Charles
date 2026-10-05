# Apresentação Charles — Guia de Uso

Apresentação institucional do **Charles** (Assistente de IA do Departamento de
Data Center — Claro Empresas), criada para apresentar o projeto às demais áreas
e solicitar contribuição para a base de conhecimento.

---

## Como abrir

**Opção 1 — Recomendada:** clique duas vezes em `index.html`. Abre no navegador.

**Opção 2 — Servidor local** (melhor para projetar):

```bash
cd apresentacao-charles
python -m http.server 8000
```

Acesse `http://localhost:8000`

> A pasta `assets/` contém as imagens. **Mova as duas pastas juntas.**

---

## Controles

| Ação | Controle |
|---|---|
| Avançar | `→` · `Espaço` · `Page Down` · botão `›` · arrastar no celular |
| Voltar | `←` · `Page Up` · botão `‹` |
| Ir ao início / fim | `Home` / `End` |
| Ir para um slide | Clicar nos pontinhos na parte inferior |
| **Tela cheia** | `F` — use na hora de projetar |
| Exportar PDF | Botão `⎙` (ícone de impressora) |

> No PDF: use **Imprimir → Salvar como PDF**, modo paisagem, margens "Nenhuma".

---

## Os 11 slides

| # | Slide | Objetivo |
|---|---|---|
| 1 | **Capa** | Impacto e posicionamento |
| 2 | **O problema** | Por que chatbot genérico não serve |
| 3 | **Quem é Charles** | Foto real + o que ele é e o que não é |
| 4 | **Números** | Os 8 indicadores medidos |
| 5 | **A evolução** | Gráfico de 50% para 0% de alucinação |
| 6 | **Comparativo** | Tabela honesta: generalista x corporativo x Charles |
| 7 | **Arquitetura** | Os 5 especialistas e o dado estruturado |
| 8 | **Conversa** | O diferencial humano com limites claros |
| 9 | **Governança** | ISO/IEC 42001 e conformidade |
| 10 | **Onde precisamos de você** | **O pedido de ação — cobertura 14%** |
| 11 | **Encerramento** | Chamada final para contribuição |

---

## Notas do apresentador

### Slide 5 — A evolução (o mais forte)

Não é marketing, é histórico. O agente de qualidade mediu **50% de alucinação**
e isso foi tratado como risco crítico. Três medições consecutivas depois
confirmaram **0%**.

> *"Não é palpite — ele mede o próprio erro e se corrige."*

### Slide 6 — Comparativo

Ser honesto aqui é o que dá credibilidade. O Charles **não** é melhor em
conhecimento geral — ele é restrito ao Data Center. O argumento não é
superar o ChatGPT, é **usar a ferramenta certa para cada situação**.

### Slide 10 — O pedido de ação (não pule este slide)

É aqui que a apresentação pede algo concreto. A cobertura está em **14%**:
86% das perguntas ainda não têm resposta na base.

> *"Não é limitação da ferramenta. É conteúdo que só vocês têm."*

---

## Perguntas que podem surgir

**"Ele erra?"**
> "Sim, e ele mede o próprio erro. Hoje é 0%, era 50% anteontem — e tem limiar
> explícito que o faz recusar responder quando não sabe."

**"E a LGPD?"**
> Slide 9 — registro de tratamento documentado, dados mascarados na entrada,
> acesso por papéis via Entra ID.

**"Quanto custa?"**
> Groq gratuito. Sem custo de licença. Sem consumo de dados de clientes.

**"E se eu precisar de algo que ele não sabe?"**
> A pergunta vira lacuna registrada. É assim que a base cresce — com o
> conteúdo de quem tem o processo.

---

## Dados apresentados (verificados em 10/10/2026)

| Dado | Valor | Origem |
|---|---|---|
| Alucinação | 0% | `data/quality-history.json` |
| Taxa de citação | 100% | Agente de qualidade |
| Itens de FAQ | 159 | `FQ_DATA_CENTER.xls` |
| Data Centers | 11 | `sites_data_center.xlsx` |
| Interações auditadas | 211 | Tracer SQLite |
| Testes | 302 | Jest |
| Testes de conformidade | 33 | `iso-42001-conformidade.test.js` |
| Cobertura | 14% | Agente de qualidade |
| Ciclos de medição | 26 | `data/quality-history.json` |

> Todos os números foram extraídos do sistema real. Se rodar a avaliação
> novamente, atualize cobertura e nota antes de apresentar.

---

## Para virar PPT

1. Abra no Chrome/Edge → `F` (tela cheia)
2. Botao `⎙` → destino **"Salvar como PDF"**
3. No PowerPoint: `Inserir → Objetos → Texto do PowerPoint` para editar,
   ou use o PDF direto

Alternativa: **app.powerpoint.com** → `Arquivo → Importar slides` → envie o PDF.

---

## Dicas de apresentação

- **Abra em tela cheia antes de começar** (`F`)
- **Não pule o slide 10** — é o objetivo da reunião
- Comece pelo slide 5 (a evolução) se quiser impressionar rápido
- O slide 3 (foto real do Charles) gera conexão imediata

---

**Classificação:** Uso interno
**Atualizado:** 2026-10-10