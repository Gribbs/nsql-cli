const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock os.homedir() to use a temporary directory before requiring config
const testConfigDir = path.join(os.tmpdir(), `suiteql-cli-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
const testHomeDir = path.dirname(testConfigDir);

jest.spyOn(os, 'homedir').mockReturnValue(testHomeDir);

// Clear module cache and require config after mocking
delete require.cache[require.resolve('../lib/config')];
const {
  readConfig,
  writeConfig,
  getProfile,
  saveProfile,
  profileExists,
  getAllProfiles,
  validateProfile,
  getEnvCredentials,
  resolveCredentials,
  saveOAuth2Profile,
  saveOAuth2Tokens,
  isTokenExpired,
  encrypt,
  decrypt,
  CONFIG_FILE
} = require('../lib/config');

describe('config', () => {
  let originalConfigContent = null;
  const configExists = fs.existsSync(CONFIG_FILE);

  beforeAll(() => {
    // Backup original config if it exists
    if (configExists) {
      originalConfigContent = fs.readFileSync(CONFIG_FILE, 'utf8');
    }
  });

  beforeEach(() => {
    // Clean up config file before each test - but ensure directory exists
    const configDir = require('path').dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    // Clear module cache to ensure fresh config state
    delete require.cache[require.resolve('../lib/config')];
  });

  afterAll(() => {
    // Restore original homedir mock
    os.homedir.mockRestore();
    
    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('readConfig', () => {
    it('should return empty object when config file does not exist', () => {
      const config = readConfig();
      expect(config).toEqual({});
    });

    it('should read and parse existing config file', () => {
      const testConfig = {
        default: {
          consumerKey: 'test-key',
          consumerSecret: 'test-secret',
          token: 'test-token',
          tokenSecret: 'test-token-secret',
          realm: 'test-realm'
        }
      };
      
      writeConfig(testConfig);
      const config = readConfig();
      expect(config).toEqual(testConfig);
    });

    it('should throw error when config file is invalid JSON', () => {
      fs.writeFileSync(CONFIG_FILE, 'invalid json', 'utf8');
      
      expect(() => readConfig()).toThrow('Failed to read config file');
    });
  });

  describe('writeConfig', () => {
    it('should create config directory and write config file', () => {
      const testConfig = {
        default: {
          consumerKey: 'test-key',
          consumerSecret: 'test-secret',
          token: 'test-token',
          tokenSecret: 'test-token-secret',
          realm: 'test-realm'
        }
      };
      
      writeConfig(testConfig);
      
      expect(fs.existsSync(CONFIG_FILE)).toBe(true);
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      expect(JSON.parse(content)).toEqual(testConfig);
    });

    it('should overwrite existing config file', () => {
      const initialConfig = { 
        default: { 
          consumerKey: 'old',
          consumerSecret: 'old-secret',
          token: 'old-token',
          tokenSecret: 'old-token-secret',
          realm: 'old-realm'
        } 
      };
      const newConfig = { 
        default: { 
          consumerKey: 'new',
          consumerSecret: 'new-secret',
          token: 'new-token',
          tokenSecret: 'new-token-secret',
          realm: 'new-realm'
        } 
      };
      
      writeConfig(initialConfig);
      writeConfig(newConfig);
      
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      expect(JSON.parse(content)).toEqual(newConfig);
    });
  });

  describe('getProfile', () => {
    it('should return null when profile does not exist', () => {
      const profile = getProfile('nonexistent');
      expect(profile).toBeNull();
    });

    it('should return default profile when no profile name specified', () => {
      const testConfig = {
        default: {
          consumerKey: 'test-key',
          consumerSecret: 'test-secret',
          token: 'test-token',
          tokenSecret: 'test-token-secret',
          realm: 'test-realm'
        }
      };
      
      writeConfig(testConfig);
      const profile = getProfile();
      expect(profile).toEqual(testConfig.default);
    });

    it('should return specified profile', () => {
      const testConfig = {
        prod: {
          consumerKey: 'prod-key',
          consumerSecret: 'prod-secret',
          token: 'prod-token',
          tokenSecret: 'prod-token-secret',
          realm: 'prod-realm'
        }
      };
      
      writeConfig(testConfig);
      const profile = getProfile('prod');
      expect(profile).toEqual(testConfig.prod);
    });
  });

  describe('saveProfile', () => {
    it('should save a new profile', () => {
      const profileData = {
        consumerKey: 'new-key',
        consumerSecret: 'new-secret',
        token: 'new-token',
        tokenSecret: 'new-token-secret',
        realm: 'new-realm'
      };
      
      saveProfile('new-profile', profileData);
      
      const config = readConfig();
      expect(config['new-profile']).toEqual(profileData);
    });

    it('should update an existing profile', () => {
      const initialData = {
        consumerKey: 'old-key',
        consumerSecret: 'old-secret',
        token: 'old-token',
        tokenSecret: 'old-token-secret',
        realm: 'old-realm'
      };
      
      const updatedData = {
        consumerKey: 'new-key',
        consumerSecret: 'new-secret',
        token: 'new-token',
        tokenSecret: 'new-token-secret',
        realm: 'new-realm'
      };
      
      saveProfile('test-profile', initialData);
      saveProfile('test-profile', updatedData);
      
      const profile = getProfile('test-profile');
      expect(profile).toEqual(updatedData);
    });

    it('should preserve other profiles when updating one', () => {
      const profile1 = {
        consumerKey: 'key1',
        consumerSecret: 'secret1',
        token: 'token1',
        tokenSecret: 'token-secret1',
        realm: 'realm1'
      };
      
      const profile2 = {
        consumerKey: 'key2',
        consumerSecret: 'secret2',
        token: 'token2',
        tokenSecret: 'token-secret2',
        realm: 'realm2'
      };
      
      saveProfile('profile1', profile1);
      saveProfile('profile2', profile2);
      saveProfile('profile1', { ...profile1, consumerKey: 'updated-key' });
      
      const config = readConfig();
      expect(config.profile1.consumerKey).toBe('updated-key');
      expect(config.profile2).toEqual(profile2);
    });
  });

  describe('profileExists', () => {
    it('should return false when profile does not exist', () => {
      expect(profileExists('nonexistent')).toBe(false);
    });

    it('should return true when profile exists', () => {
      const profileData = {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      };
      
      saveProfile('test-profile', profileData);
      expect(profileExists('test-profile')).toBe(true);
    });
  });

  describe('getAllProfiles', () => {
    it('should return empty array when no profiles exist', () => {
      const profiles = getAllProfiles();
      expect(profiles).toEqual([]);
    });

    it('should return all profile names', () => {
      // Ensure clean state - delete config file first
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }
      delete require.cache[require.resolve('../lib/config')];
      
      saveProfile('profile1', {
        consumerKey: 'key1',
        consumerSecret: 'secret1',
        token: 'token1',
        tokenSecret: 'token-secret1',
        realm: 'realm1'
      });
      
      saveProfile('profile2', {
        consumerKey: 'key2',
        consumerSecret: 'secret2',
        token: 'token2',
        tokenSecret: 'token-secret2',
        realm: 'realm2'
      });
      
      const profiles = getAllProfiles();
      expect(profiles).toContain('profile1');
      expect(profiles).toContain('profile2');
      expect(profiles.length).toBe(2);
    });
  });

  describe('validateProfile', () => {
    it('should return true for valid profile', () => {
      const validProfile = {
        consumerKey: 'key',
        consumerSecret: 'secret',
        token: 'token',
        tokenSecret: 'token-secret',
        realm: 'realm'
      };
      
      expect(validateProfile(validProfile)).toBe(true);
    });

    it('should return false when required field is missing', () => {
      const invalidProfile = {
        consumerKey: 'key',
        consumerSecret: 'secret',
        token: 'token',
        tokenSecret: 'token-secret'
        // realm is missing
      };
      
      expect(validateProfile(invalidProfile)).toBe(false);
    });

    it('should return false when field is empty string', () => {
      const invalidProfile = {
        consumerKey: '',
        consumerSecret: 'secret',
        token: 'token',
        tokenSecret: 'token-secret',
        realm: 'realm'
      };
      
      expect(validateProfile(invalidProfile)).toBe(false);
    });

    it('should return false when field is not a string', () => {
      const invalidProfile = {
        consumerKey: 123,
        consumerSecret: 'secret',
        token: 'token',
        tokenSecret: 'token-secret',
        realm: 'realm'
      };
      
      expect(validateProfile(invalidProfile)).toBe(false);
    });

    it('should return false when field is null', () => {
      const invalidProfile = {
        consumerKey: null,
        consumerSecret: 'secret',
        token: 'token',
        tokenSecret: 'token-secret',
        realm: 'realm'
      };
      
      expect(validateProfile(invalidProfile)).toBe(false);
    });
  });

  describe('getEnvCredentials', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment variables before each test
      process.env = { ...originalEnv };
      delete process.env.NSQL_CONSUMER_KEY;
      delete process.env.NSQL_CONSUMER_SECRET;
      delete process.env.NSQL_TOKEN;
      delete process.env.NSQL_TOKEN_SECRET;
      delete process.env.NSQL_REALM;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return null when no environment variables are set', () => {
      const credentials = getEnvCredentials();
      expect(credentials).toBeNull();
    });

    it('should return null when only some environment variables are set', () => {
      process.env.NSQL_CONSUMER_KEY = 'test-key';
      process.env.NSQL_CONSUMER_SECRET = 'test-secret';
      // Missing NSQL_TOKEN, NSQL_TOKEN_SECRET, NSQL_REALM
      
      const credentials = getEnvCredentials();
      expect(credentials).toBeNull();
    });

    it('should return null when any environment variable is empty string', () => {
      process.env.NSQL_CONSUMER_KEY = 'test-key';
      process.env.NSQL_CONSUMER_SECRET = 'test-secret';
      process.env.NSQL_TOKEN = 'test-token';
      process.env.NSQL_TOKEN_SECRET = 'test-token-secret';
      process.env.NSQL_REALM = ''; // Empty string
      
      const credentials = getEnvCredentials();
      expect(credentials).toBeNull();
    });

    it('should return credentials when all environment variables are set', () => {
      process.env.NSQL_CONSUMER_KEY = 'env-consumer-key';
      process.env.NSQL_CONSUMER_SECRET = 'env-consumer-secret';
      process.env.NSQL_TOKEN = 'env-token';
      process.env.NSQL_TOKEN_SECRET = 'env-token-secret';
      process.env.NSQL_REALM = 'env-realm';
      
      const credentials = getEnvCredentials();
      expect(credentials).toEqual({
        consumerKey: 'env-consumer-key',
        consumerSecret: 'env-consumer-secret',
        token: 'env-token',
        tokenSecret: 'env-token-secret',
        realm: 'env-realm'
      });
    });
  });

  describe('resolveCredentials', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment variables before each test
      process.env = { ...originalEnv };
      delete process.env.NSQL_CONSUMER_KEY;
      delete process.env.NSQL_CONSUMER_SECRET;
      delete process.env.NSQL_TOKEN;
      delete process.env.NSQL_TOKEN_SECRET;
      delete process.env.NSQL_REALM;
      
      // Clean up config file
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return null credentials when neither env vars nor profile exist', () => {
      const result = resolveCredentials('default');
      expect(result.credentials).toBeNull();
      expect(result.source).toBeNull();
    });

    it('should return profile credentials when env vars are not set', () => {
      const profileData = {
        consumerKey: 'profile-key',
        consumerSecret: 'profile-secret',
        token: 'profile-token',
        tokenSecret: 'profile-token-secret',
        realm: 'profile-realm'
      };
      saveProfile('default', profileData);
      
      const result = resolveCredentials('default');
      expect(result.credentials).toEqual(profileData);
      expect(result.source).toBe('profile');
    });

    it('should return env credentials when all env vars are set (precedence over profile)', () => {
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
      
      const result = resolveCredentials('default');
      expect(result.credentials).toEqual({
        consumerKey: 'env-consumer-key',
        consumerSecret: 'env-consumer-secret',
        token: 'env-token',
        tokenSecret: 'env-token-secret',
        realm: 'env-realm'
      });
      expect(result.source).toBe('environment');
    });

    it('should fall back to profile when env vars are incomplete', () => {
      const profileData = {
        consumerKey: 'profile-key',
        consumerSecret: 'profile-secret',
        token: 'profile-token',
        tokenSecret: 'profile-token-secret',
        realm: 'profile-realm'
      };
      saveProfile('default', profileData);
      
      // Set only some env vars
      process.env.NSQL_CONSUMER_KEY = 'env-consumer-key';
      process.env.NSQL_CONSUMER_SECRET = 'env-consumer-secret';
      // Missing other env vars
      
      const result = resolveCredentials('default');
      expect(result.credentials).toEqual(profileData);
      expect(result.source).toBe('profile');
    });

    it('should use specified profile name', () => {
      const productionProfile = {
        consumerKey: 'prod-key',
        consumerSecret: 'prod-secret',
        token: 'prod-token',
        tokenSecret: 'prod-token-secret',
        realm: 'prod-realm'
      };
      saveProfile('production', productionProfile);
      
      const result = resolveCredentials('production');
      expect(result.credentials).toEqual(productionProfile);
      expect(result.source).toBe('profile');
    });

    it('should return authType oauth1 for legacy profiles', () => {
      const profileData = {
        consumerKey: 'key',
        consumerSecret: 'secret',
        token: 'token',
        tokenSecret: 'token-secret',
        realm: 'realm'
      };
      saveProfile('default', profileData);

      const result = resolveCredentials('default');
      expect(result.authType).toBe('oauth1');
    });

    it('should return authType oauth2 for OAuth2 profiles', () => {
      saveOAuth2Profile('oauth2-profile', {
        accountId: 'TSTDRV123',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      });

      const result = resolveCredentials('oauth2-profile');
      expect(result.authType).toBe('oauth2');
      expect(result.credentials.accountId).toBe('TSTDRV123');
      expect(result.credentials.clientId).toBe('client-id');
      expect(result.credentials.clientSecret).toBe('client-secret');
    });
  });

  describe('validateProfile - OAuth2', () => {
    it('should return true for valid OAuth2 profile', () => {
      const validProfile = {
        authType: 'oauth2',
        accountId: 'TSTDRV123',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };
      expect(validateProfile(validProfile)).toBe(true);
    });

    it('should return false for OAuth2 profile missing accountId', () => {
      const invalidProfile = {
        authType: 'oauth2',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };
      expect(validateProfile(invalidProfile)).toBe(false);
    });

    it('should return false for OAuth2 profile with empty clientId', () => {
      const invalidProfile = {
        authType: 'oauth2',
        accountId: 'TSTDRV123',
        clientId: '',
        clientSecret: 'client-secret',
      };
      expect(validateProfile(invalidProfile)).toBe(false);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should round-trip a string', () => {
      const original = 'my-secret-value';
      const encrypted = encrypt(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain(':');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should return null/undefined for falsy input', () => {
      expect(encrypt(null)).toBeNull();
      expect(encrypt(undefined)).toBeUndefined();
      expect(decrypt(null)).toBeNull();
      expect(decrypt(undefined)).toBeUndefined();
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const original = 'same-value';
      const enc1 = encrypt(original);
      const enc2 = encrypt(original);
      expect(enc1).not.toBe(enc2);
      expect(decrypt(enc1)).toBe(original);
      expect(decrypt(enc2)).toBe(original);
    });
  });

  describe('saveOAuth2Profile and saveOAuth2Tokens', () => {
    it('should save an OAuth2 profile with encrypted clientSecret', () => {
      saveOAuth2Profile('test-oauth2', {
        accountId: 'TSTDRV123',
        clientId: 'client-id',
        clientSecret: 'super-secret',
      });

      const raw = getProfile('test-oauth2');
      expect(raw.authType).toBe('oauth2');
      expect(raw.accountId).toBe('TSTDRV123');
      expect(raw.clientId).toBe('client-id');
      expect(raw.clientSecret).not.toBe('super-secret');
      expect(raw.clientSecret).toContain(':');
      expect(raw.realm).toBe('TSTDRV123');
    });

    it('should save tokens with encrypted refreshToken', () => {
      saveOAuth2Profile('tokens-test', {
        accountId: 'TSTDRV123',
        clientId: 'client-id',
        clientSecret: 'secret',
      });

      saveOAuth2Tokens('tokens-test', {
        accessToken: 'access-jwt',
        refreshToken: 'refresh-value',
        tokenExpiry: 1700000000000,
      });

      const raw = getProfile('tokens-test');
      expect(raw.accessToken).toBe('access-jwt');
      expect(raw.refreshToken).not.toBe('refresh-value');
      expect(raw.refreshToken).toContain(':');
      expect(raw.tokenExpiry).toBe(1700000000000);
    });

    it('should throw when saving tokens for non-existent profile', () => {
      expect(() => {
        saveOAuth2Tokens('nonexistent', {
          accessToken: 'token',
          refreshToken: 'refresh',
          tokenExpiry: 1700000000000,
        });
      }).toThrow("Profile 'nonexistent' not found");
    });
  });

  describe('isTokenExpired', () => {
    it('should return true when no accessToken', () => {
      expect(isTokenExpired({ tokenExpiry: Date.now() + 60000 })).toBe(true);
    });

    it('should return true when no tokenExpiry', () => {
      expect(isTokenExpired({ accessToken: 'token' })).toBe(true);
    });

    it('should return true when token is expired', () => {
      expect(isTokenExpired({
        accessToken: 'token',
        tokenExpiry: Date.now() - 1000,
      })).toBe(true);
    });

    it('should return true when token expires within 5 minutes', () => {
      expect(isTokenExpired({
        accessToken: 'token',
        tokenExpiry: Date.now() + (2 * 60 * 1000),
      })).toBe(true);
    });

    it('should return false when token has more than 5 minutes left', () => {
      expect(isTokenExpired({
        accessToken: 'token',
        tokenExpiry: Date.now() + (10 * 60 * 1000),
      })).toBe(false);
    });
  });
});
