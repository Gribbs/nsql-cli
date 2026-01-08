module.exports = {
  testEnvironment: 'node',
  maxWorkers: process.env.CI ? 1 : '50%', // Run serially in CI to prevent test isolation issues
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(inquirer|netsuite-api-client)/)'
  ],
  moduleNameMapper: {
    '^inquirer$': '<rootDir>/__tests__/__mocks__/inquirer.js',
    '^netsuite-api-client$': '<rootDir>/__tests__/__mocks__/netsuite-api-client.js'
  }
};

