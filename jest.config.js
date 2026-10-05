const path = require('path');

/**
 * jest.config.js
 *
 * Configuração de testes para Charles AI v4
 * Protege código crítico com testes automatizados
 */

module.exports = {
  testEnvironment: 'node',
  rootDir: './',
  testMatch: ['**/__tests__/**/*.test.js', '**/**.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/\\.kilo/',
    'setup.js',
    'routing-test.js'
  ],
  collectCoverageFrom: [
    'backend/**/*.js',
    '!backend/node_modules/**',
    '!backend/__tests__/**',
    '!backend/test-*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 25,
      lines: 20,
      statements: 20
    }
  },
  testTimeout: 30000,
  bail: 0,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/backend/__tests__/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/$1'
  }
};
