/**
 * sse-handler.js
 *
 * Handler para Server-Sent Events (SSE).
 * Implementa streaming token-by-token REAL via SDK LLM (stream: true).
 * Os tokens são emitidos ao cliente conforme chegam do provedor LLM.
 *
 * FASE 1 EVOLUÇÃO - Streaming Real (substitui buffer simulado)
 */

/**
 * Classe para gerenciar conexões SSE
 */
class SSEHandler {
  /**
   * Configura headers SSE para uma resposta
   * @param {Object} res - Response object do Express
   */
  setupSSE(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
  }

  /**
   * Envia um evento SSE
   * @param {Object} res - Response object
   * @param {string} event - Nome do evento
   * @param {Object} data - Dados do evento
   */
  sendEvent(res, event, data) {
    try {
      const eventData = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${event}\n`);
      res.write(`data: ${eventData}\n\n`);
      // Força flush para evitar buffering em servidores/reverse-proxies
      if (typeof res.flush === 'function') res.flush();
    } catch (e) {
      // Conexão já fechada
    }
  }

  /**
   * Envia um token (chunk de texto) para o cliente
   * @param {Object} res
   * @param {string} token
   */
  sendToken(res, token) {
    this.sendEvent(res, 'token', { token });
  }

  /**
   * Envia metadados do processamento
   * @param {Object} res
   * @param {Object} metadata
   */
  sendMetadata(res, metadata) {
    this.sendEvent(res, 'metadata', metadata);
  }

  /**
   * Envia informação de ferramenta executada
   * @param {Object} res
   * @param {Object} toolInfo
   */
  sendToolCall(res, toolInfo) {
    this.sendEvent(res, 'tool_call', toolInfo);
  }

  /**
   * Envia informação de roteamento
   * @param {Object} res
   * @param {Object} routingInfo
   */
  sendRouting(res, routingInfo) {
    this.sendEvent(res, 'routing', routingInfo);
  }

  /**
   * Envia informação de contexto recuperado
   * @param {Object} res
   * @param {Object} contextInfo
   */
  sendContext(res, contextInfo) {
    this.sendEvent(res, 'context', contextInfo);
  }

  /**
   * Envia evento de "pensando" para feedback visual no frontend
   * @param {Object} res
   * @param {string} stage - Estágio atual (ex: 'buscando', 'analisando', 'escrevendo')
   * @param {string} phrase - Frase humana opcional para TTS imediato
   */
  sendThinking(res, stage, phrase = '') {
    this.sendEvent(res, 'thinking', { stage, phrase });
  }

  /**
   * Finaliza a conexão SSE
   * @param {Object} res
   * @param {Object} finalData
   */
  end(res, finalData = {}) {
    this.sendEvent(res, 'done', finalData);
    try {
      res.end();
    } catch (e) {
      // Conexão já fechada
    }
  }

  /**
   * Envia um erro via SSE
   * @param {Object} res
   * @param {string} errorMessage
   */
  sendError(res, errorMessage) {
    this.sendEvent(res, 'error', { error: errorMessage });
    try {
      res.end();
    } catch (e) {
      // Conexão já fechada
    }
  }

  /**
   * Processa um stream real do LLM e emite tokens via SSE conforme chegam.
   * Suporta detecção de tool_calls no stream.
   *
   * @param {Object} res - Response object do Express
   * @param {AsyncIterable} stream - Stream retornado pelo SDK OpenAI (stream: true)
   * @returns {Object} - { fullText, toolCalls } acumulados do stream
   */
  async processRealStream(res, stream) {
    let fullText = '';
    const toolCalls = [];
    let currentToolCall = null;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      const finishReason = chunk.choices?.[0]?.finish_reason;

      if (!delta) continue;

      // Conteúdo de texto - emite token imediatamente
      if (delta.content) {
        fullText += delta.content;
        this.sendToken(res, delta.content);
      }

      // Tool calls - acumula argumentos
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            // Início de nova tool call ou continuação
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = {
                id: tc.id || '',
                type: 'function',
                function: {
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || ''
                }
              };
            } else {
              // Acumula argumentos parciais
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      }

      // Finalização
      if (finishReason === 'tool_calls') {
        // LLM quer chamar ferramentas
        break;
      }

      if (finishReason === 'stop') {
        break;
      }
    }

    return { fullText, toolCalls: toolCalls.filter(Boolean) };
  }

  /**
   * Simula streaming token-by-token de uma resposta completa (FALLBACK)
   * Usado quando streaming real não está disponível (ex: LocalProvider).
   * @param {Object} res
   * @param {string} text
   * @param {number} delayMs - Delay entre tokens (ms)
   */
  async streamText(res, text, delayMs = 30) {
    const tokens = this._tokenize(text);

    for (const token of tokens) {
      this.sendToken(res, token);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Divide texto em tokens para streaming simulado (fallback)
   * @param {string} text
   * @returns {string[]}
   */
  _tokenize(text) {
    const tokens = [];
    const regex = /(\s+|[^\s]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    return tokens;
  }

  /**
   * Cria um heartbeat para manter conexão viva
   * @param {Object} res
   * @returns {NodeJS.Timeout}
   */
  startHeartbeat(res) {
    return setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        // Conexão fechada
      }
    }, 15000);
  }

  /**
   * Para o heartbeat
   * @param {NodeJS.Timeout} interval
   */
  stopHeartbeat(interval) {
    if (interval) clearInterval(interval);
  }
}

// Singleton
let instance = null;

function getSSEHandler() {
  if (!instance) {
    instance = new SSEHandler();
  }
  return instance;
}

module.exports = { getSSEHandler, SSEHandler };