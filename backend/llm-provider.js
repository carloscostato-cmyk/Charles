/**
 * llm-provider.js
 * 
 * Provider abstraction layer para mÃºltiplas LLMs.
 * Inspirado no conceito do LiteLLM - interface unificada para diferentes provedores.
 * Suporta: Groq, OpenRouter, Google Gemini
 * 
 * Arquitetura: Provider Pattern
 * - Cada provedor implementa a mesma interface (chat)
 * - FÃ¡cil adicionar novos provedores
 * - ConfigurÃ¡vel via variÃ¡veis de ambiente
 */

const OpenAI = require('openai');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ConfiguraÃ§Ã£o TLS: verificaÃ§Ã£o ativa por padrÃ£o (seguro).
// SÃ³ desativa com ALLOW_INSECURE_TLS=true (proxy corporativo com inspeÃ§Ã£o SSL).
const allowInsecureTls = process.env.ALLOW_INSECURE_TLS === 'true';
const httpsAgent = new https.Agent({
  rejectUnauthorized: !allowInsecureTls
});
if (allowInsecureTls) {
  console.warn('[LLM-Provider] âš ï¸ TLS verification disabled (ALLOW_INSECURE_TLS=true)');
}

// ============ CONFIGURAÃ‡Ã•ES DOS PROVEDORES ============

const PROVIDER_CONFIG = {
  groq: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    description: 'GrÃ¡tis, rÃ¡pido (~500 tok/s), Llama 3, Mixtral, Gemma'
  },
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    description: 'Agrega vÃ¡rios modelos, alguns gratuitos'
  },
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKeyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-1.5-flash',
    description: 'Google Gemini API (visÃ£o computacional nativa)'
  }
};

// ============ PROVIDER BASE ============

/**
 * Classe base abstrata para provedores de LLM
 */
class BaseProvider {
  constructor(config) {
    this.name = config.name;
    this.model = config.defaultModel;
    
    // Suporte a múltiplas chaves separadas por vírgula no .env (ex: GROQ_API_KEYS)
    const pluralEnvName = config.apiKeyEnv + 'S';
    const rawKeys = process.env[pluralEnvName] || process.env[config.apiKeyEnv] || '';
    
    this.apiKeys = rawKeys.split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0 && k !== 'sua_chave_groq_aqui');
      
    this.currentKeyIndex = 0;
    this.disponivel = this.apiKeys.length > 0;
  }

  get apiKey() {
    return this.apiKeys[this.currentKeyIndex] || '';
  }

  /**
   * Rotaciona para a próxima chave de API disponível.
   * @returns {boolean} true se conseguiu rotacionar.
   */
  rotateKey() {
    if (this.apiKeys.length <= 1) {
      return false;
    }
    
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.log(`[LLM-Provider] 🔄 Rotacionando chave do ${this.name} (Índice atual: ${this.currentKeyIndex + 1}/${this.apiKeys.length})`);
    return true;
  }

  /**
   * Envia uma mensagem para o LLM e retorna a resposta
   * @param {string} systemPrompt - Prompt do sistema
   * @param {string} mensagem - Mensagem do usuÃ¡rio
   * @param {number} timeoutMs - Timeout em milissegundos
   * @returns {Promise<string>} - Resposta do LLM
   */
  async chat(systemPrompt, mensagem, timeoutMs = 15000) {
    throw new Error('MÃ©todo chat() deve ser implementado pelo provedor');
  }

  /**
   * Streaming chat - retorna async iterable de chunks
   * @param {string} systemPrompt
   * @param {Array} messages - Array de {role, content}
   * @param {Object} options - {tools, tool_choice, signal, max_tokens, temperature, model}
   * @returns {AsyncIterable} Stream de chunks
   */
  async chatStream(systemPrompt, messages, options = {}) {
    throw new Error('MÃ©todo chatStream() deve ser implementado pelo provedor');
  }

  /**
   * Analisa imagem com visÃ£o computacional
   * @param {string} imagePath - Caminho da imagem
   * @param {string} prompt - Prompt de anÃ¡lise
   * @returns {Promise<string>} AnÃ¡lise da imagem
   */
  async analyzeImage(imagePath, prompt = 'Descreva esta imagem em detalhes') {
    throw new Error('MÃ©todo analyzeImage() nÃ£o suportado por este provedor');
  }

  /**
   * Retorna o status do provedor
   */
  getStatus() {
    return {
      nome: this.name,
      modelo: this.model,
      disponivel: this.disponivel
    };
  }
}

// ============ PROVEDOR GROQ ============

/**
 * Provedor Groq - usa API compatÃ­vel com OpenAI
 * GrÃ¡tis, rÃ¡pido, suporta Llama 3, Mixtral, Gemma
 */
class GroqProvider extends BaseProvider {
  constructor() {
    super(PROVIDER_CONFIG.groq);
    
    if (this.disponivel) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: PROVIDER_CONFIG.groq.baseURL,
        httpAgent: httpsAgent
      });
    }
  }

  async chat(systemPrompt, mensagem, timeoutMs = 15000) {
    if (!this.disponivel) {
      throw new Error('GROQ_API_KEY não configurada ou inválida');
    }

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: mensagem }
          ],
          temperature: 0.4,
          max_tokens: 700,
          top_p: 0.9
        }, { signal: controller.signal });

        clearTimeout(timeoutId);
        const texto = response.choices?.[0]?.message?.content?.trim();
        
        if (!texto) {
          throw new Error('Resposta vazia do Groq');
        }

        return texto;
      } catch (error) {
        clearTimeout(timeoutId);
        
        const isRotatableError = error.status === 429 || error.status === 401 || error.status === 403;
        
        if (isRotatableError && this.apiKeys.length > 1 && attempts < maxAttempts - 1) {
          console.warn(`[GroqProvider] Erro ${error.status} na chave. Rotacionando...`);
          this.rotateKey();
          this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: PROVIDER_CONFIG.groq.baseURL,
            httpAgent: httpsAgent
          });
          attempts++;
          continue;
        }

        if (error.name === 'AbortError') {
          throw new Error('Timeout - Groq demorou muito para responder');
        }
        
        // Log completo do erro para debug
        console.error('[GroqProvider] Erro completo:', {
          status: error.status,
          message: error.message,
          code: error.code,
          type: error.type,
          body: error.error?.message || error.error
        });
        
        // Tratamento amigável para todos os tipos de erro
        if (error.status === 401) {
          throw new Error('Chave de API do Groq inválida ou expirada. Verifique a configuração.');
        }
        
        if (error.status === 403) {
          throw new Error('Acesso negado ao Groq. Verifique as permissões da chave.');
        }
        
        if (error.status === 429) {
          throw new Error('Limite de requisições do Groq excedido. Aguarde alguns instantes e tente novamente.');
        }
        
        if (error.status === 500 || error.status === 502 || error.status === 503) {
          throw new Error('Servidor do Groq temporariamente indisponível. Tente novamente.');
        }
        
        // Erros de conexão
        if (error.message?.includes('Connection') || error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
          throw new Error('Erro de conexão com a API do Groq. Verifique sua internet.');
        }
        
        // Qualquer outro erro - mensagem genérica amigável
        console.error('[GroqProvider] Erro não tratado:', error.message);
        throw new Error('Serviço de IA temporariamente indisponível. Usando base de conhecimento local.');
      }
    }
  }

  /**
   * Streaming chat - retorna async iterable de chunks do Groq
   * @param {string} systemPrompt
   * @param {Array} messages - Array de {role, content}
   * @param {Object} options - {tools, tool_choice, signal, max_tokens, temperature, model}
   * @returns {AsyncIterable} Stream de chunks
   */
  async chatStream(systemPrompt, messages, options = {}) {
    if (!this.disponivel) {
      throw new Error('GROQ_API_KEY não configurada ou inválida');
    }

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      try {
        const allMessages = [
          { role: 'system', content: systemPrompt },
          ...messages
        ];

        const params = {
          model: options.model || this.model,
          messages: allMessages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1500,
          top_p: options.top_p || 0.9,
          stream: true
        };

        // Adiciona tools se fornecidos
        if (options.tools && options.tools.length > 0) {
          params.tools = options.tools;
          params.tool_choice = options.tool_choice || 'auto';
        }

        const requestOptions = {};
        if (options.signal) {
          requestOptions.signal = options.signal;
        }

        const stream = await this.client.chat.completions.create(params, requestOptions);
        return stream;
      } catch (error) {
        const isRotatableError = error.status === 429 || error.status === 401 || error.status === 403;
        
        if (isRotatableError && this.apiKeys.length > 1 && attempts < maxAttempts - 1) {
          console.warn(`[GroqProvider] Erro stream ${error.status} na chave. Rotacionando...`);
          this.rotateKey();
          this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: PROVIDER_CONFIG.groq.baseURL,
            httpAgent: httpsAgent
          });
          attempts++;
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Groq nÃ£o suporta anÃ¡lise de imagens
   */
  async analyzeImage(imagePath, prompt = 'Descreva esta imagem em detalhes') {
    throw new Error('Groq nÃ£o suporta anÃ¡lise de imagens. Use Gemini ou OpenRouter com modelos vision.');
  }
}

// ============ PROVEDOR OPENROUTER ============

/**
 * Provedor OpenRouter - agrega mÃºltiplos modelos
 * Usa API compatÃ­vel com OpenAI
 */
class OpenRouterProvider extends BaseProvider {
  constructor() {
    super(PROVIDER_CONFIG.openrouter);
    
    if (this.disponivel) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: PROVIDER_CONFIG.openrouter.baseURL,
        httpAgent: httpsAgent
      });
    }
  }

  async chat(systemPrompt, mensagem, timeoutMs = 15000) {
    if (!this.disponivel) {
      throw new Error('OPENROUTER_API_KEY não configurada');
    }

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: mensagem }
          ],
          temperature: 0.4,
          max_tokens: 700,
          top_p: 0.9
        }, { 
          signal: controller.signal,
          headers: {
            'HTTP-Referer': 'https://chatonus.local',
            'X-Title': 'Chatbot Charles'
          }
        });

        clearTimeout(timeoutId);
        const texto = response.choices?.[0]?.message?.content?.trim();
        
        if (!texto) {
          throw new Error('Resposta vazia do OpenRouter');
        }

        return texto;
      } catch (error) {
        clearTimeout(timeoutId);
        
        const isRotatableError = error.status === 429 || error.status === 401 || error.status === 403;
        
        if (isRotatableError && this.apiKeys.length > 1 && attempts < maxAttempts - 1) {
          console.warn(`[OpenRouterProvider] Erro ${error.status} na chave. Rotacionando...`);
          this.rotateKey();
          this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: PROVIDER_CONFIG.openrouter.baseURL,
            httpAgent: httpsAgent
          });
          attempts++;
          continue;
        }

        if (error.name === 'AbortError') {
          throw new Error('Timeout - OpenRouter demorou muito para responder');
        }
        throw error;
      }
    }
  }

  /**
   * Streaming chat - retorna async iterable de chunks do OpenRouter
   * @param {string} systemPrompt
   * @param {Array} messages - Array de {role, content}
   * @param {Object} options - {tools, tool_choice, signal, max_tokens, temperature, model}
   * @returns {AsyncIterable} Stream de chunks
   */
  async chatStream(systemPrompt, messages, options = {}) {
    if (!this.disponivel) {
      throw new Error('OPENROUTER_API_KEY não configurada');
    }

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      try {
        const allMessages = [
          { role: 'system', content: systemPrompt },
          ...messages
        ];

        const params = {
          model: options.model || this.model,
          messages: allMessages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1500,
          top_p: options.top_p || 0.9,
          stream: true
        };

        if (options.tools && options.tools.length > 0) {
          params.tools = options.tools;
          params.tool_choice = options.tool_choice || 'auto';
        }

        const requestOptions = {
          headers: {
            'HTTP-Referer': 'https://chatonus.local',
            'X-Title': 'Chatbot Charles'
          }
        };
        if (options.signal) {
          requestOptions.signal = options.signal;
        }

        const stream = await this.client.chat.completions.create(params, requestOptions);
        return stream;
      } catch (error) {
        const isRotatableError = error.status === 429 || error.status === 401 || error.status === 403;
        
        if (isRotatableError && this.apiKeys.length > 1 && attempts < maxAttempts - 1) {
          console.warn(`[OpenRouterProvider] Erro stream ${error.status} na chave. Rotacionando...`);
          this.rotateKey();
          this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: PROVIDER_CONFIG.openrouter.baseURL,
            httpAgent: httpsAgent
          });
          attempts++;
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * OpenRouter pode suportar visÃ£o se o modelo for compatÃ­vel
   */
  async analyzeImage(imagePath, prompt = 'Descreva esta imagem em detalhes') {
    if (!this.disponivel) {
      throw new Error('OPENROUTER_API_KEY não configurada');
    }

    // Converte imagem para base64
    const imageBase64 = fs.readFileSync(imagePath).toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.4,
          max_tokens: 1000,
          top_p: 0.9
        }, { 
          signal: controller.signal,
          headers: {
            'HTTP-Referer': 'https://chatonus.local',
            'X-Title': 'Chatbot Charles'
          }
        });

        clearTimeout(timeoutId);
        const texto = response.choices?.[0]?.message?.content?.trim();
        return texto || 'Não foi possível analisar a imagem.';
      } catch (error) {
        clearTimeout(timeoutId);

        const isRotatableError = error.status === 429 || error.status === 401 || error.status === 403;
        
        if (isRotatableError && this.apiKeys.length > 1 && attempts < maxAttempts - 1) {
          console.warn(`[OpenRouterProvider] Erro ${error.status} na chave. Rotacionando...`);
          this.rotateKey();
          this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: PROVIDER_CONFIG.openrouter.baseURL,
            httpAgent: httpsAgent
          });
          attempts++;
          continue;
        }

        if (error.name === 'AbortError') {
          throw new Error('Timeout - OpenRouter demorou muito para responder');
        }
        throw error;
      }
    }
  }
}

// ============ PROVEDOR LOCAL (FALLBACK INTELIGENTE) ============

/**
 * Provedor local que responde usando apenas Knowledge Base
 * Usado quando nÃ£o hÃ¡ chaves de API vÃ¡lidas
 */
class LocalProvider extends BaseProvider {
  constructor() {
    super({ 
      name: 'Local Fallback', 
      defaultModel: 'local-knowledge', 
      apiKeyEnv: 'NONE' 
    });
    this.disponivel = true; // Sempre disponÃ­vel
  }

  async chat(systemPrompt, mensagem, timeoutMs = 5000) {
    // Simula processamento
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const pergunta = mensagem.toLowerCase();
    
    // Respostas inteligentes bÃ¡sicas baseadas em padrÃµes
    if (/onde|localizaÃ§Ã£o|endereÃ§o|fica/i.test(pergunta) && /data center|datacenter/i.test(pergunta)) {
      return "Baseado na nossa base de conhecimento, temos data centers em vÃ¡rias cidades do Brasil. Para informaÃ§Ãµes especÃ­ficas sobre localizaÃ§Ã£o, consulte nossa equipe tÃ©cnica.";
    }
    
    if (/telefone|contato|ligar/i.test(pergunta)) {
      return "Você pode encontrar os contatos no diretório interno da Claro. Qual unidade você precisa?.";
    }
    
    if (/capacidade|infraestrutura|servidor/i.test(pergunta)) {
      return "Nossos data centers oferecem infraestrutura completa com alta disponibilidade, seguranÃ§a fÃ­sica e conectividade dedicada.";
    }
    
    if (/saudaÃ§Ã£o|oi|olÃ¡|bom dia|boa tarde/i.test(pergunta)) {
      return "OlÃ¡! Sou Charles, especialista em Data Centers da Claro. Como posso ajudar vocÃª hoje?";
    }
    
    // Resposta genÃ©rica baseada no contexto do system prompt
    if (systemPrompt.includes('FAQ') || systemPrompt.includes('Data Center')) {
      return "Não tenho essa informação na base de conhecimento, mas posso te ajudar com outros tópicos sobre Data Center Claro. Qual seria sua pergunta?";
    }
    
    return "Desculpe, nÃ£o consegui processar sua pergunta no momento. Tente reformular ou seja mais especÃ­fico sobre data centers.";
  }

  /**
   * Local provider nÃ£o suporta visÃ£o
   */
  async analyzeImage(imagePath, prompt = 'Descreva esta imagem em detalhes') {
    throw new Error('Local Provider nÃ£o suporta anÃ¡lise de imagens. Configure Gemini ou OpenRouter com API key.');
  }
}

/**
 * Provedor Google Gemini - usa API direta do Google
 * Mantido como fallback para quem jÃ¡ tem a chave
 */
class GeminiProvider extends BaseProvider {
  constructor() {
    super(PROVIDER_CONFIG.gemini);
  }

  async chat(systemPrompt, mensagem, timeoutMs = 15000) {
    if (!this.disponivel) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: mensagem }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 700
      }
    };

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

      try {
        const response = await fetch(`${endpoint}?key=${encodeURIComponent(this.apiKey)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));
        clearTimeout(timeoutId);

        if (!response.ok) {
          const isRotatableError = response.status === 429 || response.status === 401 || response.status === 403;
          
          if (isRotatableError && this.apiKeys.length > 1 && attempts < maxAttempts - 1) {
            console.warn(`[GeminiProvider] Erro ${response.status} na chave. Rotacionando...`);
            this.rotateKey();
            attempts++;
            continue;
          }

          const message = data?.error?.message || `HTTP ${response.status}`;
          throw new Error(`Erro do Gemini: ${message}`);
        }

        const texto = data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim();

        if (!texto) {
          throw new Error('Resposta vazia do Gemini');
        }

        return texto;
      } catch (error) {
        clearTimeout(timeoutId);

        // Fetch throws TypeError on network errors
        if (error.name === 'AbortError') {
          throw new Error('Timeout - Gemini demorou muito para responder');
        }
        
        // Se já tentamos rotacionar e ainda recebemos erro e temos mais tentativas, e é um erro que foi jogado ali dentro...
        // Fetch erros de API (como 401/429) são tratados no `if (!response.ok)` acima, então se chegou aqui é TypeError (rede)
        throw error;
      }
    }
  }

  /**
   * Gemini com visÃ£o computacional - analisa imagens
   * @param {string} imagePath - Caminho da imagem
   * @param {string} prompt - Prompt de anÃ¡lise
   * @returns {Promise<string>} AnÃ¡lise da imagem
   */
  async analyzeImage(imagePath, prompt = 'Descreva esta imagem em detalhes. Se for um diagrama, explique sua estrutura e elementos.') {
    if (!this.disponivel) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    // Lê a imagem e converte para base64
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 1000
      }
    };

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

      try {
        const response = await fetch(`${endpoint}?key=${encodeURIComponent(this.apiKey)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));
        clearTimeout(timeoutId);

        if (!response.ok) {
          const isRotatableError = response.status === 429 || response.status === 401 || response.status === 403;
          
          if (isRotatableError && this.apiKeys.length > 1 && attempts < maxAttempts - 1) {
            console.warn(`[GeminiProvider] Erro Vision ${response.status} na chave. Rotacionando...`);
            this.rotateKey();
            attempts++;
            continue;
          }

          const message = data?.error?.message || `HTTP ${response.status}`;
          throw new Error(`Erro do Gemini Vision: ${message}`);
        }

        const texto = data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim();

        if (!texto) {
          throw new Error('Resposta vazia do Gemini Vision');
        }

        return texto;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('Timeout - Gemini Vision demorou muito para responder');
        }
        
        if (attempts >= maxAttempts - 1 || !(error instanceof TypeError)) {
          console.error('[GeminiProvider] Erro na análise de imagem:', error.message);
          throw new Error('Não foi possível analisar a imagem no momento.');
        }
        
        throw error;
      }
    }
  }
}

// ============ SMART MODEL SELECTION (FASE 8) ============

/**
 * Classifica a complexidade de uma pergunta
 * @param {string} query
 * @returns {{level: string, score: number, reasoning: string}}
 */
function classifyComplexity(query) {
  const lower = query.toLowerCase();
  let score = 0;

  // Complexidade por tamanho
  if (query.length > 200) score += 3;
  else if (query.length > 100) score += 2;
  else if (query.length > 50) score += 1;

  // Complexidade por palavras analÃ­ticas
  const analyticalWords = ['analise', 'compare', 'avalie', 'explique', 'descreva', 'resuma', 'sintetize', 'justifique', 'argumente'];
  for (const word of analyticalWords) {
    if (lower.includes(word)) score += 2;
  }

  // Complexidade por palavras tÃ©cnicas
  const technicalWords = ['arquitetura', 'infraestrutura', 'protocolo', 'topologia', 'redundancia', 'cluster', 'virtualizacao', 'containerizacao'];
  for (const word of technicalWords) {
    if (lower.includes(word)) score += 1;
  }

  // Complexidade por mÃºltiplas perguntas
  if (lower.includes(' e ') && lower.includes('?')) score += 1;

  // SaudaÃ§Ãµes e perguntas simples = baixa complexidade
  if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigado|valeu)\b/i.test(lower)) {
    return { level: 'LOW', score: 0, reasoning: 'SaudaÃ§Ã£o ou mensagem simples' };
  }

  // Perguntas de cÃ¡lculo = baixa complexidade
  if (/\d+\s*[+\-*/]\s*\d+/.test(query)) {
    return { level: 'LOW', score: 1, reasoning: 'CÃ¡lculo matemÃ¡tico simples' };
  }

  // Classifica
  let level, reasoning;
  if (score <= 1) {
    level = 'LOW';
    reasoning = 'Pergunta simples - modelo econÃ´mico recomendado';
  } else if (score <= 4) {
    level = 'MEDIUM';
    reasoning = 'Pergunta analÃ­tica - modelo intermediÃ¡rio recomendado';
  } else {
    level = 'HIGH';
    reasoning = 'RaciocÃ­nio complexo - modelo premium recomendado';
  }

  return { level, score, reasoning };
}

/**
 * Modelos por nÃ­vel de complexidade
 */
const MODELS_BY_COMPLEXITY = {
  LOW: {
    groq: 'llama-3.1-8b-instant',
    openrouter: 'meta-llama/llama-3.1-8b-instruct',
    gemini: 'gemini-1.5-flash'
  },
  MEDIUM: {
    groq: 'llama-3.3-70b-versatile',
    openrouter: 'meta-llama/llama-3.3-70b-instruct',
    gemini: 'gemini-1.5-flash'
  },
  HIGH: {
    groq: 'llama-3.3-70b-versatile',
    openrouter: 'meta-llama/llama-3.3-70b-instruct',
    gemini: 'gemini-1.5-pro'
  }
};

/**
 * Seleciona o modelo ideal baseado na complexidade da pergunta
 * @param {string} query
 * @returns {{model: string, provider: string, complexity: Object}}
 */
function selectSmartModel(query) {
  const complexity = classifyComplexity(query);
  const providerName = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
  const models = MODELS_BY_COMPLEXITY[complexity.level] || MODELS_BY_COMPLEXITY.MEDIUM;
  const model = models[providerName] || models.groq;

  console.log(`[SmartModel] Complexidade: ${complexity.level} (score: ${complexity.score}) â†’ ${providerName}/${model}`);

  return { model, provider: providerName, complexity };
}

/**
 * Fallback automÃ¡tico entre provedores
 * @param {string} preferredProvider
 * @returns {string[]} Lista de provedores em ordem de fallback
 */
function getFallbackChain(preferredProvider) {
  const all = ['groq', 'openrouter', 'gemini', 'local'];
  const chain = [preferredProvider];
  
  // Adiciona outros providers, priorizando os que tÃªm chave vÃ¡lida
  for (const p of all) {
    if (p !== preferredProvider) {
      const provider = new PROVIDERS[p]();
      if (provider.disponivel) {
        chain.push(p);
      }
    }
  }
  
  // Sempre adiciona local no final como Ãºltimo recurso
  if (!chain.includes('local')) {
    chain.push('local');
  }
  
  return chain;
}

// ============ FÃBRICA DE PROVEDORES ============

/**
 * Mapa de provedores disponÃ­veis
 */
const PROVIDERS = {
  groq: GroqProvider,
  openrouter: OpenRouterProvider,
  gemini: GeminiProvider,
  local: LocalProvider
};

/**
 * Provedor ativo (singleton)
 */
let providerAtivo = null;

/**
 * Cria ou retorna o provedor ativo baseado na configuraÃ§Ã£o
 * @param {string} providerName - Nome do provedor (groq, openrouter, gemini, local)
 * @returns {BaseProvider} InstÃ¢ncia do provedor
 */
function getProvider(providerName) {
  const nome = (providerName || process.env.LLM_PROVIDER || 'groq').toLowerCase();
  
  // Se jÃ¡ temos um provider ativo e Ã© o mesmo, retorna ele
  if (providerAtivo && providerAtivo.constructor.name.toLowerCase().includes(nome)) {
    return providerAtivo;
  }
  
  // Tenta criar o provider solicitado
  const ProviderClass = PROVIDERS[nome];
  if (ProviderClass) {
    const testProvider = new ProviderClass();
    if (testProvider.disponivel) {
      providerAtivo = testProvider;
      console.log(`[LLM-Provider] Provedor ativo: ${providerAtivo.name} (modelo: ${providerAtivo.model})`);
      return providerAtivo;
    } else {
      console.warn(`[LLM-Provider] ${testProvider.name} nÃ£o disponÃ­vel (chave API invÃ¡lida ou ausente)`);
    }
  }
  
  // Fallback: tenta encontrar qualquer provider que funcione
  console.log(`[LLM-Provider] Procurando provider alternativo...`);
  const fallbackChain = getFallbackChain(nome);
  
  for (const fallbackName of fallbackChain) {
    const FallbackClass = PROVIDERS[fallbackName];
    if (FallbackClass) {
      const fallbackProvider = new FallbackClass();
      if (fallbackProvider.disponivel) {
        providerAtivo = fallbackProvider;
        console.log(`[LLM-Provider] âœ… Usando fallback: ${providerAtivo.name} (modelo: ${providerAtivo.model})`);
        return providerAtivo;
      }
    }
  }
  
  // Ãšltimo recurso: provider local sempre funciona
  console.warn(`[LLM-Provider] âš ï¸ Nenhum provider externo disponÃ­vel - usando Local Provider`);
  providerAtivo = new LocalProvider();
  return providerAtivo;
}

/**
 * Retorna o status de todos os provedores configurados
 * @returns {Array} Lista de status dos provedores
 */
function getProvidersStatus() {
  const status = [];
  
  for (const [nome, ProviderClass] of Object.entries(PROVIDERS)) {
    const provider = new ProviderClass();
    status.push({
      id: nome,
      ...provider.getStatus()
    });
  }
  
  return status;
}

/**
 * Lista os provedores disponÃ­veis
 * @returns {Object} Provedores disponÃ­veis
 */
function getProvidersDisponiveis() {
  return Object.entries(PROVIDER_CONFIG).map(([id, config]) => ({
    id,
    nome: config.name,
    modelo: config.defaultModel,
    descricao: config.description
  }));
}

// ============ ANÃLISE DE IMAGEM (VISÃƒO COMPUTACIONAL) ============

/**
 * Analisa uma imagem usando o provider mais adequado
 * @param {string} imagePath - Caminho da imagem
 * @param {string} prompt - Prompt de anÃ¡lise
 * @returns {Promise<{success: boolean, analysis: string, provider: string}>}
 */
async function analyzeImage(imagePath, prompt = null) {
  if (!fs.existsSync(imagePath)) {
    return {
      success: false,
      analysis: 'Arquivo de imagem nÃ£o encontrado.',
      provider: 'none'
    };
  }

  const defaultPrompt = 'VocÃª Ã© Charles, especialista em Data Centers. Analise esta imagem em detalhes. ' +
    'Se for um diagrama de arquitetura, identifique componentes, conexÃµes e fluxos. ' +
    'Se for uma foto de infraestrutura, descreva equipamentos, estado e possÃ­veis problemas. ' +
    'Se contiver texto ou dados, extraia e interprete as informaÃ§Ãµes. ' +
    'ForneÃ§a uma anÃ¡lise executiva com: 1) Resumo do que foi identificado, 2) Elementos tÃ©cnicos relevantes, ' +
    '3) PossÃ­veis riscos ou alertas, 4) RecomendaÃ§Ãµes se aplicÃ¡vel.';

  const analysisPrompt = prompt || defaultPrompt;

  // Tenta providers que suportam visÃ£o (ordem de preferÃªncia)
  const visionProviders = ['gemini', 'openrouter'];
  
  for (const providerName of visionProviders) {
    const ProviderClass = PROVIDERS[providerName];
    if (!ProviderClass) continue;

    const provider = new ProviderClass();
    if (!provider.disponivel) continue;

    try {
      console.log(`[Vision] Tentando anÃ¡lise com ${providerName}...`);
      const analysis = await provider.analyzeImage(imagePath, analysisPrompt);
      
      return {
        success: true,
        analysis: analysis,
        provider: providerName
      };
    } catch (error) {
      console.warn(`[Vision] ${providerName} falhou: ${error.message}`);
      continue;
    }
  }

  // Nenhum provider de visÃ£o disponÃ­vel
  return {
    success: false,
    analysis: 'Nenhum provedor de visÃ£o computacional disponÃ­vel. ' +
      'Configure GEMINI_API_KEY ou OPENROUTER_API_KEY para anÃ¡lise de imagens.',
    provider: 'none'
  };
}

module.exports = {
  getProvider,
  getProvidersStatus,
  getProvidersDisponiveis,
  classifyComplexity,
  selectSmartModel,
  getFallbackChain,
  analyzeImage,
  MODELS_BY_COMPLEXITY,
  PROVIDER_CONFIG,
  GROQ_MODEL: PROVIDER_CONFIG.groq.defaultModel,
  OPENROUTER_MODEL: PROVIDER_CONFIG.openrouter.defaultModel,
  GEMINI_MODEL: PROVIDER_CONFIG.gemini.defaultModel,
  PROVIDERS
};




