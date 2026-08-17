class BackendOrchestrator {
  constructor() {
    this.apiEndpoint = '/api/chat';
    this.timeout = 30000;
    this.retryAttempts = 3;
  }

  async processVoiceText(text, userId = 'default') {
    if (!text || typeof text !== 'string') {
      throw new Error('Texto inválido');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${window.location.origin}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mensagem: text, userId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout na chamada ao backend');
      }
      throw error;
    }
  }

  validateResponse(response) {
    if (!response || !response.resposta) {
      return { valid: false, error: 'Resposta vazia do backend' };
    }
    return { valid: true, response };
  }

  async retryWithDelay(fn, delay = 1000) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === this.retryAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
}

module.exports = { BackendOrchestrator };