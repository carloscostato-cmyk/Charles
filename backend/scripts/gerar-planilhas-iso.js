/**
 * gerar-planilhas-iso.js
 *
 * Gera as planilhas editáveis do SGIA (ISO/IEC 42001:2023).
 * Uso: node scripts/gerar-planilhas-iso.js
 * Saída: docs/iso-42001/planilhas/*.xlsx
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'iso-42001', 'planilhas');

/** Formata a aba: larguras, congelar cabeçalho e autofiltro. */
function formatSheet(ws, larguras) {
  ws['!cols'] = larguras.map((w) => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e })
  };
  return ws;
}

/** Monta uma aba a partir de headers + linhas. */
function aba(nome, headers, dados, larguras) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dados]);
  return { nome, ws: formatSheet(ws, larguras) };
}

/** Grava um .xlsx com uma ou mais abas. */
function escrever(nomeArquivo, abas) {
  const wb = XLSX.utils.book_new();
  abas.forEach((a) => XLSX.utils.book_append_sheet(wb, a.ws, a.nome));
  const destino = path.join(OUT_DIR, nomeArquivo);
  XLSX.writeFile(wb, destino, { bookSST: false });
  console.log(`[ISO] ${nomeArquivo}`);
}

// ============================================================================
// DADOS
// ============================================================================

const PAPELIS = [
  ['PAP-01', 'Proprietário do SGIA (Responsável pela IA)', 'Aprova mudanças de escopo, fontes e política de uso. Ponto de escalonamento para incidente de IA.', 'Gestão do Data Center', 'CRÍTICO', '', '', '', ''],
  ['PAP-02', 'Encarregado de Dados (DPO)', 'Guarda o registro de tratamento, responde a titulares, aprova avaliação LGPD.', 'Jurídico / Compliance', 'CRÍTICO', '', '', '', ''],
  ['PAP-03', 'Gestor do Departamento de Data Center', 'Aprova a operação do assistente no escopo do departamento.', 'Gestão do Data Center', 'ALTO', '', '', '', ''],
  ['PAP-04', 'Responsável Técnico (Engineering)', 'Implementa mudanças, mantém guardrails, responde pela disponibilidade.', 'Engineering', 'ALTO', '', '', '', ''],
  ['PAP-05', 'Auditor Interno (ISO 42001)', 'Revisa aderência trimestral, emite não-conformidades.', 'Compliance / Qualidade', 'ALTO', '', '', '', ''],
  ['PAP-06', 'Curador da Base Documental', 'Atualiza FAQ, responde às lacunas de conhecimento.', 'Data Center', 'MÉDIO', '', '', '', ''],
  ['PAP-07', 'Ponto de Contato com Usuários', 'Recebe feedback e reclamações sobre o assistente.', 'Data Center', 'BAIXO', '', '', '', '']
];

const RACI = [
  ['Definir propósito e escopo do SGIA', 'A/R', 'C', 'C', 'C', 'I'],
  ['Aprovar fonte de dados para o assistente', 'A', 'C', 'C', 'R', 'I'],
  ['Definir política de uso aceitável', 'A/R', 'C', 'C', 'C', 'I'],
  ['Avaliação de impacto LGPD', 'C', 'A/R', 'C', 'C', 'I'],
  ['Alterar o prompt mestre', 'A', 'I', 'I', 'R', 'I'],
  ['Adicionar novo agente especialista', 'A', 'I', 'C', 'R', 'I'],
  ['Gerenciar incidente de IA', 'A/R', 'C', 'C', 'C', 'I'],
  ['Revisão periódica do SGIA', 'A/R', 'C', 'C', 'C', 'I'],
  ['Auditoria interna de conformidade', 'C', 'C', 'C', 'C', 'A/R'],
  ['Atualizar base de conhecimento', 'I', 'I', 'C', 'R', 'C'],
  ['Acessar e resetar memória de usuários', 'C', 'A', 'C', 'R', 'I'],
  ['Consultar traces de auditoria', 'I', 'C', 'C', 'R', 'I']
];

const INCIDENTES = [
  ['INC-001', 'EXEMPLO — apagar', 'Resposta com dado pessoal sem procedência', 'Usuário reportou', '', 'Não se aplica', 'Aberto', '', '', '', '', ''],
  ['INC-002', '', '', '', '', '', '', '', '', '', '', ''],
  ['INC-003', '', '', '', '', '', '', '', '', '', '', ''],
  ['INC-004', '', '', '', '', '', '', '', '', '', '', ''],
  ['INC-005', '', '', '', '', '', '', '', '', '', '', '']
];

const NAO_CONFORMIDADES = [
  ['NC-001', '5.1', 'Aprovação da alta direção não formalizada', 'Alta', 'Crítico', 'Aberto', 'Aguardando assinatura do Proprietário do SGIA', 'SGIA-GOVERNANCA.md §5', '', ''],
  ['NC-002', '5.2', 'Papéis e responsabilidades não designados formalmente', 'Alta', 'Crítico', 'Aberto', 'Designar papéis e preencher PAP-01 a PAP-05', '01-PAPELIS-RESPONSABILIDADES.xlsx', '', ''],
  ['NC-003', '6.3', 'Agente afirmava status operacional sem fonte', 'Alta', 'Crítico', 'Corrigido', 'specialist-availability reescrito com declaração de limite', 'iso-42001-conformidade.test.js', '2026-10-10', ''],
  ['NC-004', '8.2', 'Base legal do uso do nome do usuário não declarada', 'Média', 'Médio', 'Corrigido', 'Tratamento T-01 registrado no ROPA', 'REGISTRO-TRATAMENTO-DADOS.md', '2026-10-10', ''],
  ['NC-005', '8.2', 'PIIScrubber não protegia cartão de crédito', 'Alta', 'Alto', 'Corrigido', 'Ordem das regras corrigida em security-middleware.js', 'iso-42001-conformidade.test.js', '2026-10-10', ''],
  ['NC-006', '7.4', 'Política de retenção de logs não formalizada', 'Média', 'Médio', 'Corrigido', 'Retenção de 90 dias definida no ROPA', 'REGISTRO-TRATAMENTO-DADOS.md §2.3', '2026-10-10', ''],
  ['NC-007', '9.3', 'Sem programa de auditoria interna', 'Média', 'Médio', 'Em andamento', '33 testes de conformidade automatizados criados', 'iso-42001-conformidade.test.js', '2026-10-10', ''],
  ['NC-008', '9.1', 'Dashboard sem KPIs formais definidos', 'Média', 'Médio', 'Em andamento', '7 métricas definidas com pesos no quality agent', 'MELHORIA-CONTINUA.md §2', '2026-10-10', ''],
  ['NC-009', '4.1', 'Finalidade do sistema de IA não documentada formalmente', 'Média', 'Médio', 'Corrigido', 'Documento de governança criado', 'SGIA-GOVERNANCA.md §1', '2026-10-10', ''],
  ['NC-010', '8.4', 'Sem política de uso aceitável', 'Média', 'Médio', 'Corrigido', 'Política de uso criada com usos proibidos', 'POLITICA-USO-ACEPTAVEL.md', '2026-10-10', ''],
  ['NC-011', '6.2', 'Objetivos do SGIA não formalizados', 'Baixa', 'Baixo', 'Em andamento', 'Métricas de qualidade definidas', 'MELHORIA-CONTINUA.md §5', '', ''],
  ['NC-012', '10.1', 'Melhoria contínua não formalizada', 'Baixa', 'Baixo', 'Corrigido', 'Ciclo automatizado documentado', 'MELHORIA-CONTINUA.md', '2026-10-10', '']
];

const ROPA = [
  ['T-01', 'Identificação e saudação personalizada', 'Nome (primeiro), e-mail corporativo', 'Art. 7º II - Legítimo interesse', 'Microsoft Entra ID', 'Nenhum', 'Não persiste (em memória por requisição)', '90 dias (não aplicável - sem logs)', 'Baixo', 'Ver REGISTRO-TRATAMENTO-DADOS.md §4', '', '', ''],
  ['T-02', 'Memória de conversa', 'Histórico de perguntas e respostas', 'Art. 7º II - Legítimo interesse', 'Interação do usuário', 'Nenhum', 'SQLite local (backend/memory)', 'Sessão', 'Médio', 'DELETE /api/memory/reset', '', '', ''],
  ['T-03', 'Traces de observabilidade', 'Pergunta, resposta, fonte, score', 'Art. 7º II - Legítimo interesse', 'Interação do usuário', 'Auditor interno', 'SQLite (backend/observability)', '90 dias', 'Baixo', 'Exclusão via admin', '', '', ''],
  ['T-04', 'Knowledge gaps', 'Texto da pergunta, data', 'Art. 7º II - Legítimo interesse', 'Interação do usuário', 'Curador documental', 'JSON (knowledge-gaps.json)', 'Até respondida', 'Baixo', 'Exclusão via admin', '', '', ''],
  ['T-05', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['T-06', '', '', '', '', '', '', '', '', '', '', '', '']
];

const IMPACTO_ETICO = [
  ['D-01', 'Saudação personalizada usa nome do usuário', 'Positivo', 'Acolhedor e eficiente; reduz fricção na interação', 'Médio', 'Nome é o mínimo necessário; sem persistência; pode ser desativado', 'Aprovado'],
  ['D-02', 'Conversa social (small talk)', 'Positivo', 'Reduz sensação de roboticidade; melhora experiência', 'Baixo', 'Limitado ao escopo; nunca substitui orientação técnica', 'Aprovado'],
  ['D-03', 'Charles se recusa a prever o tempo', 'Negativo (controlado)', 'Usuário não obtém a resposta desejada', 'Médio', 'Redireciona para o que sabe fazer; alternativa seria alucinação', 'Aprovado'],
  ['D-04', 'Charles recusa afirmar status operacional', 'Negativo (controlado)', 'Operador pode achar lento', 'Alto', 'Evita decisão errada baseada em informação falsa', 'Aprovado'],
  ['D-05', 'Rastreabilidade documental obrigatória', 'Positivo', 'Permite auditoria e confiança', 'Baixo', 'Exige que a base seja mantida atualizada', 'Aprovado'],
  ['D-06', 'LGPD - sanitização de PII na entrada', 'Positivo', 'Protege titular e empresa', 'Baixo', 'Pode ocultar informação legítima se padrão for ambíguo', 'Aprovado'],
  ['D-07', 'Bloqueio de prompt injection', 'Positivo', 'Protege regras de segurança', 'Baixo', 'Pode bloquear perguntas legítimas com termos técnicos', 'Aprovado'],
  ['D-08', '', '', '', '', '', ''],
  ['D-09', '', '', '', '', '', '']
];

const ACOES = [
  ['ACAO-001', 'NC-001 / NC-002', 'Designar papéis e assinar aprovação do SGIA', 'Proprietário do SGIA', 'Crítico', 'Alta', '', '', 'Aberto', 'BLOQUEIA CERTIFICAÇÃO', ''],
  ['ACAO-002', 'NC-007', 'Instituir auditoria interna semestral', 'Auditor Interno', 'Médio', 'Média', '', '', 'Em andamento', '', ''],
  ['ACAO-003', 'NC-008', 'Formalizar KPIs no painel de qualidade', 'Engineering', 'Médio', 'Baixa', '', '', 'Em andamento', '', ''],
  ['ACAO-004', 'OP-02', 'Revisar FAQ com owners técnicos (trimestral)', 'Curador Documental', 'Alto', 'Média', '', '', 'Em andamento', '', ''],
  ['ACAO-005', 'OP-05', 'Decidir: implementar ou remover agentes casca', 'Proprietário do SGIA', 'Médio', 'Baixa', '', '', 'Aberto', '', ''],
  ['ACAO-006', 'RN-01', 'Migrar base de planilha para sistema documental', 'Gestão do Data Center', 'Alto', 'Alta', '', '', 'Não iniciado', '', ''],
  ['ACAO-007', '', '', '', '', '', '', '', '', '', ''],
  ['ACAO-008', '', '', '', '', '', '', '', '', '', '']
];
// ============================================================================
// GERAÇÃO
// ============================================================================

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 00 — Leia-me com a ordem de preenchimento
escrever('00-LEIA-ME.xlsx', [
  aba('Instruções',
    ['Ordem', 'Planilha', 'O que preencher', 'Quem preenche', 'Prazo'],
    [
      [1, '01-PAPELIS-RESPONSABILIDADES.xlsx', 'NOME COMPLETO, MATRÍCULA/EMAIL, DATA DA DESIGNAÇÃO, ASSINATURA', 'Gestão do Data Center', 'PRIORITÁRIO — BLOQUEIA CERTIFICAÇÃO'],
      [2, '02-MATRIZ-RACI.xlsx', 'Revisar se os papéis assumidos estão corretos; ajustar C/I se necessário', 'Proprietário do SGIA', 'Após definir os papéis'],
      [3, '05-ROPA-TRATAMENTO-DADOS.xlsx', 'Completar T-05 e T-06; preencher ENCAMINHAMENTO LGPD e CONTATO DPO', 'DPO', 'Trimestral'],
      [4, '06-AVALIACAO-IMPACTO-ETICO.xlsx', 'Completar D-08 e D-09; revisar os Status das decisões existentes', 'DPO + Proprietário', 'Semestral'],
      [5, '07-PLANO-ACOES-CORRETIVAS.xlsx', 'PRAZO, DATA CONCLUSÃO, RESPONSÁVEL, STATUS', 'Proprietário do SGIA', 'Trimestral'],
      [6, '03-REGISTRO-INCIDENTES-IA.xlsx', 'A linha 1 é exemplo — apagar. Registrar incidentes reais', 'Proprietário do SGIA', 'Contínuo'],
      [7, '04-REGISTRO-NAO-CONFORMIDADES.xlsx', 'Atualizar Status e Prazo. NC-001 e NC-002 dependem dos papéis', 'Auditor Interno', 'Semestral'],
      ['', '', '', '', ''],
      ['', 'LEMBRETE', 'A planilha 01 é a mais importante. Sem ela o SGIA não é certificável.', '', ''],
      ['', 'PRÓXIMO PASSO', 'Preencher PAP-01 a PAP-05, imprimir e assinar. Depois marcar NC-001 e NC-002 como "Corrigido".', '', '']
    ],
    [8, 44, 78, 28, 42])
]);

// 01 — Papéis (BLOQUEIA CERTIFICAÇÃO)
escrever('01-PAPELIS-RESPONSABILIDADES.xlsx', [
  aba('Papéis',
    ['ID', 'Papel', 'Responsabilidade', 'Área de origem', 'Criticidade', 'NOME COMPLETO', 'MATRÍCULA / EMAIL', 'DATA DA DESIGNAÇÃO', 'ASSINATURA'],
    PAPELIS,
    [10, 42, 62, 24, 12, 28, 28, 20, 20])
]);

// 02 — Matriz RACI
escrever('02-MATRIZ-RACI.xlsx', [
  aba('RACI',
    ['Atividade', 'Proprietário SGIA', 'DPO', 'Infosec', 'Engineering', 'Auditor Interno'],
    RACI,
    [48, 16, 12, 12, 16, 16])
]);

// 03 — Registro de incidentes
escrever('03-REGISTRO-INCIDENTES-IA.xlsx', [
  aba('Incidentes',
    ['ID', 'Data', 'Título', 'Descrição', 'Categoria', 'Impacto', 'Status', 'Ações Tomadas', 'Responsável', 'Data de Resolução', 'Evidência', 'Observação'],
    INCIDENTES,
    [10, 12, 34, 50, 18, 14, 12, 42, 20, 18, 24, 26])
]);

// 04 — Não conformidades
escrever('04-REGISTRO-NAO-CONFORMIDADES.xlsx', [
  aba('Não Conformidades',
    ['ID', 'Cláusula ISO', 'Descrição', 'Severidade', 'Risco', 'Status', 'Ação Corretiva', 'Evidência', 'Data Correção', 'Prazo'],
    NAO_CONFORMIDADES,
    [10, 13, 52, 12, 12, 16, 54, 40, 14, 12])
]);

// 05 — ROPA (registro de tratamento)
escrever('05-ROPA-TRATAMENTO-DADOS.xlsx', [
  aba('ROPA',
    ['ID', 'Tratamento', 'Dados Pessoais', 'Base Legal', 'Origem', 'Destinatários', 'Armazenamento', 'Retenção', 'Risco', 'Direitos do Titular', 'ENCAMINHAMENTO LGPD', 'CONTATO DPO', 'Observação'],
    ROPA,
    [8, 36, 40, 30, 22, 20, 32, 32, 10, 38, 24, 22, 24])
]);

// 06 — Avaliação de impacto ético
escrever('06-AVALIACAO-IMPACTO-ETICO.xlsx', [
  aba('Impacto Ético',
    ['ID', 'Decisão / Comportamento', 'Natureza', 'Justificativa', 'Risco Ético', 'Mitigação', 'Status'],
    IMPACTO_ETICO,
    [10, 46, 20, 52, 14, 56, 14])
]);

// 07 — Plano de ações corretivas
escrever('07-PLANO-ACOES-CORRETIVAS.xlsx', [
  aba('Ações',
    ['ID', 'Origem (NC)', 'Ação Corretiva', 'Responsável', 'Risco', 'Prioridade', 'PRAZO', 'DATA CONCLUSÃO', 'Status', 'Observação', 'Evidência'],
    ACOES,
    [12, 16, 54, 28, 12, 12, 14, 18, 16, 26, 26])
]);

console.log(`\n[ISO] Planilhas geradas em: ${OUT_DIR}`);
