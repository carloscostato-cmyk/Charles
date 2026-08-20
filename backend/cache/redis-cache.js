/**
 * cache/redis-cache.js
 *
 * Camada de cache unificada para Charles v4.2.
 * - Usa Redis quando disponível (REDIS_URL / REDIS_HOST).
 * - Fallback para cache em memória com LRU quando Redis não está disponível.
 * - Aplicações: respostas LLM, contexto RAG, resultados de busca.
 */

const crypto = require('crypto');

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_MEMORY_ITEMS = 1000;

function hashKey(prefix, input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return `${prefix}:${crypto.createHash('sha1').update(str).digest('hex')}`;
}

class InMemoryCache {
  constructor(maxItems = MAX_MEMORY_ITEMS) {
    this.maxItems = maxItems;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return null;
    const entry = this.map.get(key);
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    if (this.map.size >= this.maxItems && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

class RedisCache {
  constructor() {
    this.client = null;
    this.available = false;
  }

  async connect() {
    try {
      const redisModule = require('redis');
      const url = process.env.REDIS_URL || process.env.REDIS_HOST ? `${process.env.REDIS_REDIS_HOST || 'redis://127.0.0.1:6379'}` : null;
      
      if (!url) return false;
      
      this.client = redisModule.createClient({
        url,
        socket: {
          reconnectStrategy: false
        }
      });
      this.client.on('error', (err) => {
        console.warn('[Cache] Redis erro:', err.message);
        this.available = false;
      });
      await this.client.connect();
      this.available = true;
      console.log('[Cache] ✅ Redis conectado');
      return true;
    } catch (error) {
      console.warn('[Cache] Redis indisponível, usando cache em memória:', error.message);
      this.available = false;
      return false;
    }
  }

  async get(key) {
    if (!this.available || !this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async set(key, value, ttlMs = DEFAULT_TTL_MS) {
    if (!this.available || !this.client) return;
    try {
      await this.client.setEx(key, Math.ceil(ttlMs / 1000), JSON.stringify(value));
    } catch {}
  }

  async del(key) {
    if (!this.available || !this.client) return;
    try {
      await this.client.del(key);
    } catch {}
  }

  async clear() {
    if (!this.available || !this.client) return;
    try {
      await this.client.flushDb();
    } catch {}
  }
}

class CacheManager {
  constructor() {
    this.redis = new RedisCache();
    this.memory = new InMemoryCache();
    this.useRedis = false;
    this.stats = { hits: 0, misses: 0, redisHits: 0, memoryHits: 0 };
  }

  async initialize() {
    this.useRedis = await this.redis.connect();
    if (!this.useRedis) {
      console.log('[Cache] Usando cache em memória (LRU)');
    }
  }

  async get(key) {
    if (this.useRedis) {
      const value = await this.redis.get(key);
      if (value !== null) {
        this.stats.hits++;
        this.stats.redisHits++;
        return value;
      }
    }
    const memValue = this.memory.get(key);
    if (memValue !== null) {
      this.stats.hits++;
      this.stats.memoryHits++;
      return memValue;
    }
    this.stats.misses++;
    return null;
  }

  async set(key, value, ttlMs = DEFAULT_TTL_MS) {
    if (this.useRedis) {
      await this.redis.set(key, value, ttlMs);
    }
    this.memory.set(key, value, ttlMs);
  }

  async del(key) {
    if (this.useRedis) {
      await this.redis.del(key);
    }
    this.memory.del(key);
  }

  async clear() {
    if (this.useRedis) {
      await this.redis.clear();
    }
    this.memory.clear();
    this.stats = { hits: 0, misses: 0, redisHits: 0, memoryHits: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      backend: this.useRedis ? 'redis' : 'memory',
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
      redisHits: this.stats.redisHits,
      memoryHits: this.stats.memoryHits
    };
  }
}

let instance = null;

function getCacheManager() {
  if (!instance) {
    instance = new CacheManager();
  }
  return instance;
}

module.exports = {
  getCacheManager,
  CacheManager,
  hashKey,
  DEFAULT_TTL_MS
};
