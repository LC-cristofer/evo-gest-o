/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch:       ['**/tests/**/*.test.js'],
  setupFiles:      ['dotenv/config'],
  testTimeout:     30000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/seed.js',
    '!src/config/migrate.js',
  ],
  coverageThreshold: {
    global: {
      branches:   50,
      functions:  60,
      lines:      60,
      statements: 60,
    },
  },
  verbose: true,
};
