const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  readConfig,
  writeConfig,
  getProfile,
  saveProfile,
  profileExists,
  getAllProfiles,
  validateProfile,
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
  });

  afterAll(() => {
    // Restore original config if it existed
    if (originalConfigContent !== null) {
      fs.writeFileSync(CONFIG_FILE, originalConfigContent, 'utf8');
    } else if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
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
});
