/**
 * quality-enforcer.js
 * Valida e força compliance com prompt-master v4.1:
 * - Citações obrigatórias por tipo de fonte
 * - Quality score 0-100
 * - Anti-alucinação via RAG validator
 * - Formato de saída padronizado
 */

const { getRAGService } = require('../rag/rag-service');

const CITATION_PATTERNS = {
  FAQ: /FAQ:\s*\S+/i,
  DC: /DC:\s*\S+/i,
  RAG: /RAG:\s*\S+/i,
  TOOL: /TOOL:\s*\S+/i,
  SPEC: /SPEC:\s*\S+/i,
  MEM: /MEM:\s*\S+/i
};

const MIN_CITATIONS_REQUIRED = 1;
const HALLUCINATION_THRESHOLD = 0.3; // RAG validation confidence
const SAFE_ABSTENTION_PATTERNS = [
  /não encontrei evidência documental suficiente/i,
  /não vou completar a resposta com suposições/i,
  /não é possível confirmar/i
];

/**
 * Extrai citações da resposta
 * @param {string} resposta
 * @returns {Object} { citations: Array, hasValidCitation: boolean }
 */
function extrairCitacoes(resposta) {
  const citations = [];
  const lines = resposta.split('\n');
  
  for (const line of lines) {
    for (const [type, pattern] of Object.entries(CITATION_PATTERNS)) {
      const matches = line.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        for (const match of matches) {
          citations.push({ type, text: match.trim(), line: line.trim() });
        }
      }
    }
  }
  
  return {
    citations,
    hasValidCitation: citations.length >= MIN_CITATIONS_REQUIRED,
    count: citations.length
  };
}

/**
 * Verifica se a resposta tem estrutura obrigatória v4.1
 * @param {string} resposta
 * @returns {Object}
 */
function verificarEstrutura(resposta) {
  const hasConfianca = /confian[çc]a\s*:/i.test(resposta);
  const hasFatos = /fatos?\s*confirmados?:/i.test(resposta);
  const hasNaoConfirmados = /pontos?\s*n[ãa]o\s*confirmados?:/i.test(resposta);
  const hasResposta = /resposta\s*:/i.test(resposta);
  
  return {
    hasConfianca,
    hasFatos,
    hasNaoConfirmados,
    hasResposta,
    isStructured: hasConfianca && hasFatos && hasResposta
  };
}

/**
 * Calcula quality_score 0-100 baseado em múltiplos fatores
 * @param {Object} params
 * @returns {number}
 */
function calcularQualityScore({ resposta, citations, estrutura, ragValidation, fonte, scoreFAQ }) {
  const isSafeAbstention = fonte === 'no-evidence' &&
    SAFE_ABSTENTION_PATTERNS.some((pattern) => pattern.test(resposta)) &&
    !ragValidation?.pass;

  if (isSafeAbstention) {
    // Recusar uma resposta sem evidência é sucesso de segurança, não falha
    // de citação. Ainda exige transparência e não pode coexistir com contexto.
    let abstentionScore = 85;
    if (estrutura.isStructured) abstentionScore += 5;
    if (estrutura.hasNaoConfirmados) abstentionScore += 5;
    return Math.min(100, abstentionScore);
  }

  let score = 50; // Base
  
  // 1. Citações (peso 30)
  if (citations.hasValidCitation) score += 20;
  if (citations.count >= 2) score += 10;
  
  // 2. Estrutura v4.1 (peso 20)
  if (estrutura.isStructured) score += 15;
  if (estrutura.hasNaoConfirmados) score += 5; // Transparência
  
  // 3. Validação RAG (peso 25)
  if (ragValidation?.pass) {
    score += Math.round(ragValidation.confidence * 25);
  } else if (fonte === 'faq' && scoreFAQ >= 0.7) {
    score += 20; // FAQ forte
  }
  
  // 4. Fonte documental (peso 15)
  const fontesDoc = ['faq', 'rag+llm', 'specialist-', 'documento', 'datacenter'];
  if (fontesDoc.some(f => fonte.startsWith(f))) score += 10;
  if (fonte === 'llm' || fonte === 'llm-fallback') score -= 15;
  
  // 5. Penalidades
  if (resposta.toLowerCase().includes('livro aberto')) score -= 30;
  if (resposta.length < 50) score -= 10; // Muito curto
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Valida anti-alucinação via RAG
 * @param {string} pergunta
 * @param {string} resposta
 * @returns {Promise<Object>}
 */
async function validarAntiAlucinacao(pergunta, resposta) {
  try {
    const ragService = getRAGService();
    const validation = await ragService.retrieve(pergunta, 5);
    
    // Heurística: resposta longa sem contexto válido = possível alucinação
    const isLongAnswer = resposta.length > 300;
    const isValid = validation.validation?.valid === true || validation.validation?.canAnswer === true;
    const hasNoContext = !isValid;
    const hasLowConfidence = (validation.validation?.confidence || 0) < HALLUCINATION_THRESHOLD;
    
    return {
      pass: isValid,
      confidence: validation.validation?.confidence || 0,
      isHallucinationRisk: isLongAnswer && (hasNoContext || hasLowConfidence),
      hasContext: isValid,
      sources: validation.results?.length || 0
    };
  } catch (e) {
    return { pass: false, confidence: 0, error: e.message };
  }
}

/**
 * Força formatação de citações conforme tipo de fonte
 * @param {string} resposta
 * @param {Array} fontesDisponiveis
 * @returns {string}
 */
function forcarCitacoes(resposta, fontesDisponiveis) {
  let resultado = resposta;
  
  // Se não tem citação válida, tenta adicionar baseada nas fontes disponíveis
  const { hasValidCitation } = extrairCitacoes(resultado);
  if (!hasValidCitation && fontesDisponiveis.length > 0) {
    const citacoes = fontesDisponiveis.map(f => {
      switch (f.tipo) {
        case 'faq':
          return `FAQ: ${f.pergunta} (score ${(f.score * 100).toFixed(0)}%)`;
        case 'datacenter':
          return `DC: ${f.titulo} (${f.cidade}/${f.uf})`;
        case 'rag':
          return `RAG: ${f.source}#chunk_${f.id} (score ${(f.score * 100).toFixed(0)}%)`;
        case 'tool':
          return `TOOL: ${f.nome} → ${f.resultado}`;
        case 'specialist':
          return `SPEC: ${f.nome} → ${f.achado}`;
        default:
          return `FONTE: ${f.tipo}`;
      }
    });
    resultado += '\n\n[Fontes utilizadas: ' + citacoes.join('; ') + ']';
  }
  
  return resultado;
}

/**
 * Pipeline principal de qualidade - valida e corrige resposta
 * @param {Object} params
 * @returns {Promise<Object>} { resposta, qualityScore, citations, estrutura, ragValidation, warnings }
 */
async function enforceQuality(params) {
  const {
    pergunta,
    resposta,
    fonte,
    resultadosFAQ,
    ragResult,
    ragSources,
    toolResults,
    specialistResults,
    contextoKB
  } = params;
  
  const warnings = [];
  
  // 1. Validação anti-alucinação
  const ragValidation = await validarAntiAlucinacao(pergunta, resposta);
  if (ragValidation.isHallucinationRisk) {
    warnings.push('RISCO_ALUCINACAO: Resposta longa sem contexto RAG válido');
  }
  
  // 2. Extrai citações existentes
  let citations = extrairCitacoes(resposta);
  
  // 3. Prepara fontes disponíveis para citação forçada
  const fontesDisponiveis = [];
  if (resultadosFAQ?.length > 0) {
    resultadosFAQ.slice(0, 2).forEach(f => fontesDisponiveis.push({ tipo: 'faq', ...f }));
  }
  if (ragSources?.length > 0) {
    ragSources.slice(0, 2).forEach(s => fontesDisponiveis.push({ tipo: 'rag', ...s.metadata, id: s.id, score: s.score }));
  }
  if (toolResults?.length > 0) {
    toolResults.forEach(t => fontesDisponiveis.push({ tipo: 'tool', nome: t.tool, resultado: JSON.stringify(t.result).substring(0, 100) }));
  }
  if (specialistResults?.length > 0) {
    specialistResults.forEach(s => fontesDisponiveis.push({ tipo: 'specialist', nome: s.name, achado: s.result }));
  }
  
  // 4. Força citações se faltando
  let respostaCorrigida = resposta;
  if (!citations.hasValidCitation) {
    respostaCorrigida = forcarCitacoes(resposta, fontesDisponiveis);
    citations = extrairCitacoes(respostaCorrigida);
    warnings.push('CITACAO_FORCADA: Citações adicionadas automaticamente');
  }
  
  // 5. Verifica estrutura v4.1
  const estrutura = verificarEstrutura(respostaCorrigida);
  if (!estrutura.isStructured) {
    // Adiciona estrutura mínima
    const confianca = citations.hasValidCitation ? 'Alto' : 'Baixo';
    const justificativa = citations.hasValidCitation 
      ? 'Baseado em evidências documentais citadas' 
      : 'Sem citação válida - resposta especulativa';
    
    respostaCorrigida = `Confiança: ${confianca} (${justificativa})\n\nFatos Confirmados:\n- ${respostaCorrigida.split('\n')[0] || 'Informação processada'}\n\nPontos Não Confirmados:\n- ${warnings.join('\n- ') || 'Nenhum'}\n\nResposta:\n${respostaCorrigida}`;
    
    warnings.push('ESTRUTURA_FORCADA: Formato v4.1 aplicado');
    estrutura.hasConfianca = true;
    estrutura.hasFatos = true;
    estrutura.hasResposta = true;
    estrutura.isStructured = true;
  }
  
  // 6. Calcula quality score
  const scoreFAQ = resultadosFAQ?.[0]?.score || 0;
  const qualityScore = calcularQualityScore({
    resposta: respostaCorrigida,
    citations,
    estrutura,
    ragValidation,
    fonte,
    scoreFAQ
  });
  
  return {
    resposta: respostaCorrigida,
    qualityScore,
    citations: citations.citations,
    citationCount: citations.count,
    hasValidCitation: citations.hasValidCitation,
    estrutura,
    ragValidation,
    warnings,
    fontesDisponiveis: fontesDisponiveis.length
  };
}

module.exports = {
  enforceQuality,
  extrairCitacoes,
  verificarEstrutura,
  calcularQualityScore,
  validarAntiAlucinacao,
  SAFE_ABSTENTION_PATTERNS,
  forcarCitacoes,
  CITATION_PATTERNS
};