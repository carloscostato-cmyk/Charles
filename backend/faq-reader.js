/**
 * faq-reader.js
 * 
 * Responsável por ler o arquivo Excel (FQ_DATA_CENTER.xls) 
 * e extrair as perguntas e respostas da FAQ.
 * 
 * Arquitetura: Componente de leitura de dados
 * - Lê arquivos .xls e .xlsx
 * - Extrai perguntas e respostas de forma automática
 * - Suporta diferentes estruturas de planilha
 */

const XLSX = require('xlsx');
const path = require('path');

/**
 * Caminho do arquivo FAQ
 * Localizado na raiz do projeto
 */
const FAQ_FILE_PATH = path.join(__dirname, '..', 'FQ_DATA_CENTER.xls');

/**
 * Lê o arquivo Excel e retorna um array de objetos {pergunta, resposta}
 * @returns {Array<{pergunta: string, resposta: string}>}
 */
function lerFAQ() {
  try {
    // Lê o arquivo Excel
    const workbook = XLSX.readFile(FAQ_FILE_PATH);
    
    // Pega a primeira planilha disponível
    const primeiraAba = workbook.SheetNames[0];
    const planilha = workbook.Sheets[primeiraAba];
    
    // Converte para JSON (array de objetos)
    const dados = XLSX.utils.sheet_to_json(planilha, { header: 1 });
    
    // Processa os dados para extrair perguntas e respostas
    const faq = [];
    
    // Pula o cabeçalho (primeira linha) e processa as demais
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      
      // Pula linhas vazias
      if (!linha || linha.length < 2) continue;
      
      // A primeira coluna é a pergunta, a segunda é a resposta
      const pergunta = String(linha[0] || '').trim();
      const resposta = String(linha[1] || '').trim();
      
      if (pergunta && resposta) {
        faq.push({ pergunta, resposta });
      }
    }
    
    console.log(`[FAQ-Reader] ${faq.length} perguntas carregadas do arquivo ${FAQ_FILE_PATH}`);
    return faq;
    
  } catch (error) {
    console.error('[FAQ-Reader] Erro ao ler arquivo FAQ:', error.message);
    console.error('[FAQ-Reader] Verifique se o arquivo FQ_DATA_CENTER.xls existe na raiz do projeto');
    return [];
  }
}

/**
 * Retorna a estrutura do arquivo Excel (nomes das colunas)
 * @returns {Array<string>}
 */
function getEstruturaFAQ() {
  try {
    const workbook = XLSX.readFile(FAQ_FILE_PATH);
    const primeiraAba = workbook.SheetNames[0];
    const planilha = workbook.Sheets[primeiraAba];
    const dados = XLSX.utils.sheet_to_json(planilha, { header: 1 });
    
    if (dados.length > 0) {
      return dados[0].map(col => String(col).trim());
    }
    return [];
  } catch (error) {
    return [];
  }
}

module.exports = { lerFAQ, getEstruturaFAQ };