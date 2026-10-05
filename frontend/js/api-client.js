/**
 * api-client.js
 *
 * Cliente de API para comunicação com o backend do Chatbot Charles v3.0.
 *
 * Arquitetura: Camada de comunicação
 * - Gerencia todas as chamadas HTTP para o backend
 * - Suporte a SSE (Server-Sent Events) para streaming
 * - Upload de arquivos multimodais
 * - Tratamento de erros centralizado
 * - Autenticação Microsoft Entra ID (Azure AD)
 */

// API_BASE dinâmico: usa a mesma origem da página (host + porta)
// Isso permite acessar o chatbot de qualquer máquina na rede local.
// Ex: http://192.168.1.100:3000 → API em http://192.168.1.100:3000/api
const API_BASE = `${window.location.origin}/api`;
const TIMEOUT = 60000;

// ============ AUTENTICAÇÃO MICROSOFT ENTRA ID ============

let authToken = null;
let authUser = null;

/**
 * Obtém o token de acesso atual
 */
function getAuthToken() {
  return authToken;
}

/**
 * Define o token de acesso
 */
function setAuthToken(token) {
  authToken = token;
}

/**
 * Obtém informações do usuário autenticado
 */
function getAuthUser() {
  return authUser;
}

/**
 * Define informações do usuário autenticado
 */
function setAuthUser(user) {
  authUser = user;
}

/**
 * Verifica se o usuário está autenticado
 */
function isAuthenticated() {
  return !!authToken;
}

/**
 * Limpa a autenticação (logout)
 */
function clearAuth() {
  authToken = null;
  authUser = null;
}

/**
 * Obtém o header de autorização
 */
function getAuthHeader() {
  if (!authToken) return {};
  return {
    'Authorization': `Bearer ${authToken}`
  };
}

/**
 * Processa erro de autenticação
 */
function handleAuthError(error, callbacks = {}) {
  if (error.message?.includes('401') || error.message?.includes('403')) {
    clearAuth();
    if (callbacks.onAuthError) {
      callbacks.onAuthError();
    } else {
      console.error('[Auth] Sessão expirada ou inválida. Redirecionando para login...');
      window.location.href = '/';
    }
  }
}

// ============ CLIENTE HTTP GENÉRICO ============

const apiClient = {
  async get(endpoint, options = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('A requisição excedeu o tempo limite');
      }
      handleAuthError(error, options.callbacks);
      throw error;
    }
  },

  async post(endpoint, data, options = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(data),
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return { success: true };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('A requisição excedeu o tempo limite');
      }
      handleAuthError(error, options.callbacks);
      throw error;
    }
  },

  async delete(endpoint, options = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('A requisição excedeu o tempo limite');
      }
      handleAuthError(error, options.callbacks);
      throw error;
    }
  },

  /**
   * FASE 5: Envia uma requisição POST com streaming SSE
   * @param {string} endpoint
   * @param {Object} data
   * @param {Object} callbacks - { onToken, onMetadata, onRouting, onContext, onToolCall, onDone, onError }
   */
  async postStream(endpoint, data, callbacks = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        handleAuthError(error, callbacks);
        throw error;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                if (currentEvent === 'token' && callbacks.onToken) {
                  callbacks.onToken(parsed.token);
                } else if (currentEvent === 'metadata' && callbacks.onMetadata) {
                  callbacks.onMetadata(parsed);
                } else if (currentEvent === 'routing' && callbacks.onRouting) {
                  callbacks.onRouting(parsed);
                } else if (currentEvent === 'context' && callbacks.onContext) {
                  callbacks.onContext(parsed);
                } else if (currentEvent === 'tool_call' && callbacks.onToolCall) {
                  callbacks.onToolCall(parsed);
                } else if (currentEvent === 'done' && callbacks.onDone) {
                  callbacks.onDone(parsed);
                } else if (currentEvent === 'error' && callbacks.onError) {
                  callbacks.onError(parsed.error);
                }
              } catch {}
            }
          }
        }
      }

      if (buffer && buffer.length > 0) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                if (currentEvent === 'token' && callbacks.onToken) {
                  callbacks.onToken(parsed.token);
                } else if (currentEvent === 'metadata' && callbacks.onMetadata) {
                  callbacks.onMetadata(parsed);
                } else if (currentEvent === 'routing' && callbacks.onRouting) {
                  callbacks.onRouting(parsed);
                } else if (currentEvent === 'context' && callbacks.onContext) {
                  callbacks.onContext(parsed);
                } else if (currentEvent === 'tool_call' && callbacks.onToolCall) {
                  callbacks.onToolCall(parsed);
                } else if (currentEvent === 'done' && callbacks.onDone) {
                  callbacks.onDone(parsed);
                } else if (currentEvent === 'error' && callbacks.onError) {
                  callbacks.onError(parsed.error);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError(error.message);
      }
      throw error;
    }
  },

  /**
   * FASE 6: Upload de arquivo
   * @param {File} file
   */
  async uploadFile(file, options = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          ...getAuthHeader()
        },
        body: formData,
        ...options
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      handleAuthError(error, options.callbacks);
      throw error;
    }
  }
};

/**
 * API do Chatbot Charles v3.0
 */
const chatAPI = {
  // ============ AUTENTICAÇÃO ============

  setToken(token) {
    setAuthToken(token);
  },

  getUser() {
    return getAuthUser();
  },

  setUser(user) {
    setAuthUser(user);
  },

  isAuthenticated() {
    return isAuthenticated();
  },

  logout() {
    clearAuth();
  },

  // ============ ENDPOINTS BÁSICOS ============

  async getStatus() {
    return apiClient.get('/status');
  },

  async enviarMensagem(mensagem, userId) {
    return apiClient.post('/chat', { mensagem, userId });
  },

  async enviarMensagemStream(mensagem, userId, callbacks = {}) {
    const enhancedCallbacks = {
      ...callbacks,
      onError: (error) => {
        handleAuthError({ message: error }, callbacks);
        if (callbacks.onError) {
          callbacks.onError(error);
        }
      }
    };
    return apiClient.postStream('/chat/stream', { mensagem, userId }, enhancedCallbacks);
  },

  async getSugestoes(quantidade = 4) {
    return apiClient.get(`/sugestoes?q=${quantidade}`);
  },

  /**
   * Saudação de abertura de sessão (GET /api/chat/welcome).
   * O backend monta a saudação conforme o horário real e personaliza
   * com o nome do usuário autenticado (Entra ID).
   * @returns {Promise<{mensagem:string, saudacao:string, periodo:string, comNome:boolean}>}
   */
  async getWelcome() {
    return apiClient.get('/chat/welcome');
  },

  async getFAQ() {
    return apiClient.get('/faq');
  },

  async getProviders() {
    return apiClient.get('/providers');
  },

  async getAgentes() {
    return apiClient.get('/agentes');
  },

  async getGuardians() {
    return apiClient.get('/guardians');
  },

  async resetConversa() {
    return apiClient.post('/chat/reset', {});
  },

  // ============ FASE 1: RAG ============

  async getRAGStats() {
    return apiClient.get('/rag/stats');
  },

  async indexFileRAG(filePath) {
    return apiClient.post('/rag/index', { filePath });
  },

  async indexURLRAG(url) {
    return apiClient.post('/rag/index-url', { url });
  },

  async indexTextRAG(text, metadata) {
    return apiClient.post('/rag/index-text', { text, metadata });
  },

  async searchRAG(query, topK = 5) {
    return apiClient.post('/rag/search', { query, topK });
  },

  async clearRAG() {
    return apiClient.delete('/rag/clear');
  },

  // ============ FASE 2: TOOLS ============

  async getTools() {
    return apiClient.get('/tools');
  },

  async getToolsStats() {
    return apiClient.get('/tools/stats');
  },

  async executeTool(tool, params = {}) {
    return apiClient.post('/tools/execute', { tool, params });
  },

  // ============ FASE 4: MEMORY ============

  async getMemoryStats() {
    return apiClient.get('/memory/stats');
  },

  async getMemoryFacts(userId = 'default') {
    return apiClient.get(`/memory/facts?userId=${userId}`);
  },

  async resetMemory(userId = 'default') {
    return apiClient.post('/memory/reset', { userId });
  },

  // ============ FASE 6: MULTIMODALIDADE ============

  async uploadFile(file, options = {}) {
    return apiClient.uploadFile(file, options);
  },

  async getSupportedTypes() {
    return apiClient.get('/upload/supported-types');
  },

  // ============ FASE 7: OBSERVABILIDADE ============

  async getDashboard() {
    return apiClient.get('/observability/dashboard');
  },

  async getTraces(limit = 20) {
    return apiClient.get(`/observability/traces?limit=${limit}`);
  },

  async getObservabilityStats(hours = 24) {
    return apiClient.get(`/observability/stats?hours=${hours}`);
  },

  // ============ FASE 8: SMART MODEL SELECTION ============

  async getComplexity(query) {
    return apiClient.get(`/model/complexity?q=${encodeURIComponent(query)}`);
  }
};

// ============ EXPORTAÇÕES ============

window.apiClient = apiClient;
window.chatAPI = chatAPI;
window.auth = {
  getToken: getAuthToken,
  setToken: setAuthToken,
  getUser: getAuthUser,
  setUser: setAuthUser,
  isAuthenticated: isAuthenticated,
  logout: clearAuth,
  getHeader: getAuthHeader
};