const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock os.homedir() to use a temporary directory before requiring config
const testConfigDir = path.join(os.tmpdir(), `suiteql-cli-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
const testHomeDir = path.dirname(testConfigDir);

jest.spyOn(os, 'homedir').mockReturnValue(testHomeDir);

// Clear module cache and require modules after mocking
delete require.cache[require.resolve('../lib/config')];
delete require.cache[require.resolve('../lib/query')];

const { executeQuery, replacePlaceholders } = require('../lib/query');
const { NetsuiteApiClient } = require('netsuite-api-client');
const { getProfile, saveProfile, CONFIG_FILE } = require('../lib/config');

// Mock netsuite-api-client
jest.mock('netsuite-api-client');

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

// Mock process.exit
const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('query', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    exitSpy.mockClear();

    // Ensure config directory exists and is clean
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    
    // Clear module cache to ensure fresh state
    delete require.cache[require.resolve('../lib/config')];
    delete require.cache[require.resolve('../lib/query')];

    // Create mock client instance
    mockClient = {
      query: jest.fn()
    };
    NetsuiteApiClient.mockImplementation(() => mockClient);
  });

  afterEach(() => {
    // Clean up config file after each test
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    // Clear module cache
    delete require.cache[require.resolve('../lib/config')];
    delete require.cache[require.resolve('../lib/query')];
  });

  afterAll(() => {
    // Restore original homedir mock
    os.homedir.mockRestore();
    
    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    exitSpy.mockRestore();
  });

  describe('successful query execution', () => {
    beforeEach(() => {
      // Ensure config directory exists
      const configDir = require('path').dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Create test profile
      const testProfile = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      };
      saveProfile('default', testProfile);
    });

    it('should execute query and output JSON results', async () => {
      const mockResults = {
        items: [
          { id: '1', name: 'Test Item 1' },
          { id: '2', name: 'Test Item 2' }
        ],
        hasMore: false,
        totalResults: 2
      };

      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT id, name FROM item', 'default');

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'test-key',
        consumer_secret_key: 'test-secret',
        token: 'test-token',
        token_secret: 'test-token-secret',
        realm: 'test-realm'
      });

      expect(mockClient.query).toHaveBeenCalledWith('SELECT id, name FROM item');
      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(mockResults, null, 2));
    });

    it('should use default profile when no profile specified', async () => {
      const mockResults = { items: [] };
      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT * FROM customer');

      expect(NetsuiteApiClient).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should use specified profile', async () => {
      const prodProfile = {
        consumerKey: 'prod-key',
        consumerSecret: 'prod-secret',
        token: 'prod-token',
        tokenSecret: 'prod-token-secret',
        realm: 'prod-realm'
      };
      saveProfile('prod', prodProfile);

      const mockResults = { items: [] };
      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT * FROM customer', 'prod');

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'prod-key',
        consumer_secret_key: 'prod-secret',
        token: 'prod-token',
        token_secret: 'prod-token-secret',
        realm: 'prod-realm'
      });
    });

    it('should include baseUrl in config if present', async () => {
      const profileWithBaseUrl = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm',
        baseUrl: 'https://test.suitetalk.api.netsuite.com'
      };
      saveProfile('with-baseurl', profileWithBaseUrl);

      const mockResults = { items: [] };
      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT * FROM customer', 'with-baseurl');

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'test-key',
        consumer_secret_key: 'test-secret',
        token: 'test-token',
        token_secret: 'test-token-secret',
        realm: 'test-realm',
        base_url: 'https://test.suitetalk.api.netsuite.com'
      });
    });

    it('should output CSV format when format is csv', async () => {
      const mockResults = {
        items: [
          { id: '1', name: 'Test Item 1', quantity: 100 },
          { id: '2', name: 'Test Item 2', quantity: 200 }
        ],
        hasMore: false,
        totalResults: 2
      };

      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT id, name, quantity FROM item', 'default', false, 'csv');

      expect(mockClient.query).toHaveBeenCalled();
      const csvOutput = consoleSpy.log.mock.calls[0][0];
      expect(csvOutput).toContain('id,name,quantity');
      expect(csvOutput).toContain('1,Test Item 1,100');
      expect(csvOutput).toContain('2,Test Item 2,200');
    });

    it('should handle CSV format with nested objects', async () => {
      const mockResults = {
        items: [
          { id: '1', name: 'Test Item', metadata: { category: 'A', tags: ['tag1', 'tag2'] } }
        ],
        hasMore: false,
        totalResults: 1
      };

      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT id, name, metadata FROM item', 'default', false, 'csv');

      expect(mockClient.query).toHaveBeenCalled();
      const csvOutput = consoleSpy.log.mock.calls[0][0];
      expect(csvOutput).toContain('id,name,metadata');
      expect(csvOutput).toContain('1,Test Item');
      // Nested object should be JSON-stringified and properly escaped
      expect(csvOutput).toContain('category');
      expect(csvOutput).toContain('tag1');
      expect(csvOutput).toContain('tag2');
    });

    it('should handle CSV format with empty results', async () => {
      const mockResults = {
        items: [],
        hasMore: false,
        totalResults: 0
      };

      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT * FROM item WHERE id = -1', 'default', false, 'csv');

      expect(mockClient.query).toHaveBeenCalled();
      const csvOutput = consoleSpy.log.mock.calls[0][0];
      expect(csvOutput).toBe('');
    });

    it('should handle CSV format with special characters', async () => {
      const mockResults = {
        items: [
          { id: '1', name: 'Item with, comma', description: 'Item with "quotes"' }
        ],
        hasMore: false,
        totalResults: 1
      };

      mockClient.query.mockResolvedValue(mockResults);

      await executeQuery('SELECT id, name, description FROM item', 'default', false, 'csv');

      expect(mockClient.query).toHaveBeenCalled();
      const csvOutput = consoleSpy.log.mock.calls[0][0];
      expect(csvOutput).toContain('id,name,description');
      // Values with commas and quotes should be properly escaped
      expect(csvOutput).toMatch(/"Item with, comma"/);
      expect(csvOutput).toMatch(/"Item with ""quotes"""/);
    });
  });

  describe('dry-run mode', () => {
    it('should work without credentials', async () => {
      // Remove config file if it exists
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }

      await executeQuery('SELECT id, name FROM item', 'default', true);

      expect(consoleSpy.log).toHaveBeenCalledWith('Dry-run mode: Query will not be executed');
      expect(consoleSpy.log).toHaveBeenCalledWith('Credentials source: (none found)');
      expect(consoleSpy.log).toHaveBeenCalledWith('Query:', 'SELECT id, name FROM item');
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should display query and profile info without executing', async () => {
      // Ensure config directory exists
      const configDir = require('path').dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Create test profile
      const testProfile = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      };
      saveProfile('default', testProfile);

      await executeQuery('SELECT id, name FROM item', 'default', true);

      expect(consoleSpy.log).toHaveBeenCalledWith('Dry-run mode: Query will not be executed');
      expect(consoleSpy.log).toHaveBeenCalledWith('Credentials source:', "profile 'default'");
      expect(consoleSpy.log).toHaveBeenCalledWith('Realm:', 'test-realm');
      expect(consoleSpy.log).toHaveBeenCalledWith('Query:', 'SELECT id, name FROM item');
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should display baseUrl in dry-run if present', async () => {
      // Ensure config directory exists
      const configDir = require('path').dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const profileWithBaseUrl = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm',
        baseUrl: 'https://test.suitetalk.api.netsuite.com'
      };
      saveProfile('with-baseurl', profileWithBaseUrl);

      await executeQuery('SELECT * FROM customer', 'with-baseurl', true);

      expect(consoleSpy.log).toHaveBeenCalledWith('Base URL:', 'https://test.suitetalk.api.netsuite.com');
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should handle dry-run with non-existent profile gracefully', async () => {
      // Ensure config directory exists but don't create the profile
      const configDir = require('path').dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Create a different profile but not the one we're querying
      const testProfile = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      };
      saveProfile('other-profile', testProfile);

      await executeQuery('SELECT * FROM customer', 'nonexistent', true);

      expect(consoleSpy.log).toHaveBeenCalledWith('Dry-run mode: Query will not be executed');
      expect(consoleSpy.log).toHaveBeenCalledWith('Credentials source: (none found)');
      expect(consoleSpy.log).toHaveBeenCalledWith('Query:', 'SELECT * FROM customer');
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('environment variable authentication', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment variables before each test
      process.env = { ...originalEnv };
      delete process.env.NSQL_CONSUMER_KEY;
      delete process.env.NSQL_CONSUMER_SECRET;
      delete process.env.NSQL_TOKEN;
      delete process.env.NSQL_TOKEN_SECRET;
      delete process.env.NSQL_REALM;

      // Ensure config directory exists and is clean
      const configDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }

      // Mock successful query response
      mockClient.query.mockResolvedValue({
        items: [{ id: 1, name: 'Test' }]
      });
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should use environment variables when all are set', async () => {
      process.env.NSQL_CONSUMER_KEY = 'env-consumer-key';
      process.env.NSQL_CONSUMER_SECRET = 'env-consumer-secret';
      process.env.NSQL_TOKEN = 'env-token';
      process.env.NSQL_TOKEN_SECRET = 'env-token-secret';
      process.env.NSQL_REALM = 'env-realm';

      await executeQuery('SELECT * FROM customer', 'default', false);

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'env-consumer-key',
        consumer_secret_key: 'env-consumer-secret',
        token: 'env-token',
        token_secret: 'env-token-secret',
        realm: 'env-realm'
      });
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM customer');
    });

    it('should prefer environment variables over profile', async () => {
      // Set up both profile and environment variables
      const profileData = {
        consumerKey: 'profile-key',
        consumerSecret: 'profile-secret',
        token: 'profile-token',
        tokenSecret: 'profile-token-secret',
        realm: 'profile-realm'
      };
      saveProfile('default', profileData);

      process.env.NSQL_CONSUMER_KEY = 'env-consumer-key';
      process.env.NSQL_CONSUMER_SECRET = 'env-consumer-secret';
      process.env.NSQL_TOKEN = 'env-token';
      process.env.NSQL_TOKEN_SECRET = 'env-token-secret';
      process.env.NSQL_REALM = 'env-realm';

      await executeQuery('SELECT * FROM customer', 'default', false);

      // Should use environment credentials, not profile
      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'env-consumer-key',
        consumer_secret_key: 'env-consumer-secret',
        token: 'env-token',
        token_secret: 'env-token-secret',
        realm: 'env-realm'
      });
    });

    it('should fall back to profile when env vars are incomplete', async () => {
      const profileData = {
        consumerKey: 'profile-key',
        consumerSecret: 'profile-secret',
        token: 'profile-token',
        tokenSecret: 'profile-token-secret',
        realm: 'profile-realm'
      };
      saveProfile('default', profileData);

      // Set only some env vars (incomplete)
      process.env.NSQL_CONSUMER_KEY = 'env-consumer-key';
      process.env.NSQL_CONSUMER_SECRET = 'env-consumer-secret';
      // Missing NSQL_TOKEN, NSQL_TOKEN_SECRET, NSQL_REALM

      await executeQuery('SELECT * FROM customer', 'default', false);

      // Should use profile credentials since env vars are incomplete
      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'profile-key',
        consumer_secret_key: 'profile-secret',
        token: 'profile-token',
        token_secret: 'profile-token-secret',
        realm: 'profile-realm'
      });
    });

    it('should show error when no credentials are available', async () => {
      // No env vars set and no profile configured
      await executeQuery('SELECT * FROM customer', 'default', false);

      expect(consoleSpy.error).toHaveBeenCalledWith('Error: No credentials found.');
      expect(consoleSpy.error).toHaveBeenCalledWith('Or provide OAuth 1.0 credentials via environment variables:');
      expect(consoleSpy.error).toHaveBeenCalledWith('  NSQL_CONSUMER_KEY, NSQL_CONSUMER_SECRET, NSQL_TOKEN,');
      expect(consoleSpy.error).toHaveBeenCalledWith('  NSQL_TOKEN_SECRET, NSQL_REALM');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show available profiles in error message when they exist', async () => {
      const profileData = {
        consumerKey: 'profile-key',
        consumerSecret: 'profile-secret',
        token: 'profile-token',
        tokenSecret: 'profile-token-secret',
        realm: 'profile-realm'
      };
      saveProfile('production', profileData);

      // Request a non-existent profile with no env vars
      await executeQuery('SELECT * FROM customer', 'nonexistent', false);

      expect(consoleSpy.error).toHaveBeenCalledWith('Error: No credentials found.');
      expect(consoleSpy.error).toHaveBeenCalledWith('Or use an existing profile:', 'production');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show credentials source as environment in dry-run mode', async () => {
      process.env.NSQL_CONSUMER_KEY = 'env-consumer-key';
      process.env.NSQL_CONSUMER_SECRET = 'env-consumer-secret';
      process.env.NSQL_TOKEN = 'env-token';
      process.env.NSQL_TOKEN_SECRET = 'env-token-secret';
      process.env.NSQL_REALM = 'env-realm';

      await executeQuery('SELECT * FROM customer', 'default', true);

      expect(consoleSpy.log).toHaveBeenCalledWith('Dry-run mode: Query will not be executed');
      expect(consoleSpy.log).toHaveBeenCalledWith('Credentials source:', 'environment variables');
      expect(consoleSpy.log).toHaveBeenCalledWith('Realm:', 'env-realm');
      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe('format validation', () => {
    beforeEach(() => {
      // Ensure config directory exists
      const configDir = require('path').dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Create test profile
      const testProfile = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      };
      saveProfile('default', testProfile);
    });

    it('should reject invalid format', async () => {
      await executeQuery('SELECT * FROM customer', 'default', false, 'invalid');

      expect(consoleSpy.error).toHaveBeenCalledWith("Error: Invalid format 'invalid'. Supported formats: json, csv");
      expect(exitSpy).toHaveBeenCalledWith(1);
      // Note: Since process.exit is mocked, the code continues, but in production it would exit
      // We verify that the error was logged and exit was called
    });
  });

  describe('error handling', () => {
    it('should handle query execution errors', async () => {
      // Ensure config directory exists
      const configDir = require('path').dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const testProfile = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      };
      saveProfile('default', testProfile);

      const error = new Error('Query execution failed');
      mockClient.query.mockRejectedValue(error);

      await executeQuery('SELECT * FROM invalid_table');

      expect(consoleSpy.error).toHaveBeenCalledWith('Error executing query:', 'Query execution failed');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle API errors with response details', async () => {
      // Ensure config directory exists
      const configDir = require('path').dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const testProfile = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      };
      saveProfile('default', testProfile);

      const error = new Error('API Error');
      error.response = {
        status: 401,
        data: { error: 'Unauthorized' }
      };
      mockClient.query.mockRejectedValue(error);

      await executeQuery('SELECT * FROM customer');

      expect(consoleSpy.error).toHaveBeenCalledWith('Error executing query:', 'API Error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Response status:', 401);
      expect(consoleSpy.error).toHaveBeenCalledWith('Response data:', expect.stringContaining('Unauthorized'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('placeholder replacement', () => {
    it('should replace numeric string placeholders without quotes', () => {
      const query = 'SELECT * FROM customer WHERE id = :id AND limit = :limit';
      const params = { id: '123', limit: '5' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe("SELECT * FROM customer WHERE id = 123 AND limit = 5");
    });

    it('should replace actual number placeholders without quotes', () => {
      const query = 'SELECT * FROM customer WHERE id = :id';
      const params = { id: 123 };
      const result = replacePlaceholders(query, params);
      expect(result).toBe('SELECT * FROM customer WHERE id = 123');
    });

    it('should replace string placeholders with quotes', () => {
      const query = 'SELECT * FROM customer WHERE name = :name';
      const params = { name: 'Test Customer' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe("SELECT * FROM customer WHERE name = 'Test Customer'");
    });

    it('should escape single quotes in string values', () => {
      const query = "SELECT * FROM customer WHERE name = :name";
      const params = { name: "O'Brien" };
      const result = replacePlaceholders(query, params);
      expect(result).toBe("SELECT * FROM customer WHERE name = 'O''Brien'");
    });

    it('should replace boolean string placeholders without quotes', () => {
      const query = 'SELECT * FROM customer WHERE active = :active';
      const params = { active: 'true' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe('SELECT * FROM customer WHERE active = true');
    });

    it('should handle decimal numbers', () => {
      const query = 'SELECT * FROM item WHERE price = :price';
      const params = { price: '99.99' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe('SELECT * FROM item WHERE price = 99.99');
    });

    it('should handle negative numbers', () => {
      const query = 'SELECT * FROM transaction WHERE amount = :amount';
      const params = { amount: '-100' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe('SELECT * FROM transaction WHERE amount = -100');
    });

    it('should replace multiple placeholders', () => {
      const query = 'SELECT * FROM customer WHERE id = :id AND name = :name AND limit = :limit';
      const params = { id: '123', name: 'Test', limit: '10' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe("SELECT * FROM customer WHERE id = 123 AND name = 'Test' AND limit = 10");
    });

    it('should replace same placeholder multiple times', () => {
      const query = 'SELECT * FROM customer WHERE id = :id OR parent_id = :id';
      const params = { id: '123' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe('SELECT * FROM customer WHERE id = 123 OR parent_id = 123');
    });

    it('should return query unchanged if no params provided', () => {
      const query = 'SELECT * FROM customer WHERE id = :id';
      const result = replacePlaceholders(query, {});
      expect(result).toBe(query);
    });

    it('should return query unchanged if params is null or undefined', () => {
      const query = 'SELECT * FROM customer WHERE id = :id';
      expect(replacePlaceholders(query, null)).toBe(query);
      expect(replacePlaceholders(query, undefined)).toBe(query);
    });

    it('should handle empty string values', () => {
      const query = 'SELECT * FROM customer WHERE name = :name';
      const params = { name: '' };
      const result = replacePlaceholders(query, params);
      expect(result).toBe("SELECT * FROM customer WHERE name = ''");
    });

    it('should handle string that looks like number but has leading zeros', () => {
      const query = 'SELECT * FROM customer WHERE code = :code';
      const params = { code: '00123' };
      const result = replacePlaceholders(query, params);
      // Numbers with leading zeros are treated as numbers (SQL will interpret as 123)
      // If leading zeros need to be preserved, user should ensure it's not numeric format
      expect(result).toBe('SELECT * FROM customer WHERE code = 00123');
    });
  });
});

