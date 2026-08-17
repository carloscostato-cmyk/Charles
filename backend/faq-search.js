/**
 * faq-search.js
 * 
 * Motor de busca na FAQ.
 * Implementa busca exata e busca fuzzy (aproximada) para encontrar
 * a pergunta mais relevante no banco de conhecimento.
 * 
 * Arquitetura: Componente de busca e matching
 * - Busca exata por palavra-chave
 * - Busca fuzzy usando similaridade de strings
 * - Retorna múltiplos resultados ordenados por relevância
 */

/**
 * Calcula a similaridade de Levenshtein entre duas strings
 * Quanto maior o valor (0-1), mais similares são as strings
 */
function similaridadeLevenshtein(a, b) {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1.0;
  if (aLower.length === 0 || bLower.length === 0) return 0.0;
  
  // Cria matriz de distância
  const matrix = [];
  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower[i - 1] === aLower[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // remoção
        );
      }
    }
  }
  
  const distancia = matrix[bLower.length][aLower.length];
  const maxLen = Math.max(aLower.length, bLower.length);
  return 1 - distancia / maxLen;
}

/**
 * Calcula similaridade baseada em palavras-chave compartilhadas
 */
function similaridadePalavrasChave(pergunta, textoBusca) {
  const palavrasPergunta = pergunta.toLowerCase().split(/\s+/).filter(p => p.length > 3);
  const palavrasBusca = textoBusca.toLowerCase().split(/\s+/).filter(p => p.length > 3);
  
  if (palavrasPergunta.length === 0 || palavrasBusca.length === 0) return 0;
  
  const palavrasComuns = palavrasPergunta.filter(p => palavrasBusca.includes(p));
  return palavrasComuns.length / Math.max(palavrasPergunta.length, palavrasBusca.length);
}

/**
 * Busca uma pergunta na FAQ
 * @param {string} texto Pergunta do usuário
 * @param {Array} faq Lista de objetos {pergunta, resposta}
 * @param {number} limite Número máximo de resultados
 * @returns {Array} Resultados ordenados por relevância
 */
function buscarNaFAQ(texto, faq, limite = 3) {
  if (!texto || !faq || faq.length === 0) {
    return [];
  }
  
  const textoBusca = texto.toLowerCase().trim();
  
  const resultados = faq.map((item, index) => {
    const perguntaLower = item.pergunta.toLowerCase();
    
    // 1. Similaridade Levenshtein (compara a pergunta inteira)
    const scoreLevenshtein = similaridadeLevenshtein(textoBusca, perguntaLower);
    
    // 2. Similaridade por palavras-chave
    const scorePalavras = similaridadePalavrasChave(perguntaLower, textoBusca);
    
    // 3. Busca por substring (se o texto de busca está contido na pergunta)
    const scoreSubstring = perguntaLower.includes(textoBusca) ? 0.8 : 0;
    
    // 4. Busca inversa (se palavras da pergunta estão no texto)
    const scoreInverso = similaridadePalavrasChave(textoBusca, perguntaLower);
    
    // Pontuação final (pesos combinados)
    const scoreFinal = Math.max(
      scoreLevenshtein * 0.4,
      scorePalavras * 0.3,
      scoreSubstring * 0.5,
      scoreInverso * 0.3
    );
    
    return {
      pergunta: item.pergunta,
      resposta: item.resposta,
      score: scoreFinal,
      index
    };
  });
  
  // Filtra resultados com score mínimo e ordena por relevância
  return resultados
    .filter(r => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}

/**
 * Extrai sugestões de perguntas da FAQ (aleatório)
 * @param {Array} faq Lista de objetos {pergunta, resposta}
 * @param {number} quantidade Número de sugestões
 * @returns {Array} Lista de perguntas sugeridas
 */
function getSugestoes(faq, quantidade = 4) {
  if (!faq || faq.length === 0) return [];
  
  // Embaralha o array e pega as primeiras N perguntas
  const shuffled = [...faq].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, quantidade).map(item => item.pergunta);
}

module.exports = { buscarNaFAQ, getSugestoes };