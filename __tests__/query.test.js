const { executeQuery } = require('../lib/query');
const { NetsuiteApiClient } = require('netsuite-api-client');
const { getProfile, saveProfile, CONFIG_FILE } = require('../lib/config');
const fs = require('fs');

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
  let originalConfigContent = null;
  const configExists = fs.existsSync(CONFIG_FILE);

  beforeAll(() => {
    // Backup original config if it exists
    if (configExists) {
      originalConfigContent = fs.readFileSync(CONFIG_FILE, 'utf8');
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    exitSpy.mockClear();

    // Create mock client instance
    mockClient = {
      query: jest.fn()
    };
    NetsuiteApiClient.mockImplementation(() => mockClient);
  });

  afterAll(() => {
    // Restore original config if it existed
    if (originalConfigContent !== null) {
      fs.writeFileSync(CONFIG_FILE, originalConfigContent, 'utf8');
    }
  });

  afterAll(() => {
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
});

