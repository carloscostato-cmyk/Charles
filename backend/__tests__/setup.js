/**
 * setup.js - Configuração global de testes
 * 
 * Preparação do ambiente antes de rodar testes
 */

// Mock de variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.LLM_PROVIDER = 'groq';
process.env.PORT = 3000;

// Suprimes logs excessivos durante testes
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

global.testMode = true;

// Permite logs com prefixo [TEST] durante testes
console.log = function(...args) {
  if (global.testMode && typeof args[0] === 'string' && !args[0].includes('[')) {
    return originalLog('[TEST]', ...args);
  }
  return originalLog(...args);
};

console.warn = function(...args) {
  if (!global.testMode || (typeof args[0] === 'string' && !args[0].includes('DeprecationWarning'))) {
    return originalWarn(...args);
  }
};

console.error = function(...args) {
  if (global.testMode) {
    return originalError('[TEST ERROR]', ...args);
  }
  return originalError(...args);
};

// Timeout global
jest.setTimeout(10000);

// Cleanup após todos os testes
afterAll(() => {
  global.testMode = false;
});
