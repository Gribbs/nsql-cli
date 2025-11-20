const { configure } = require('../lib/configure');
const inquirer = require('inquirer');
const { getProfile, saveProfile, profileExists, CONFIG_FILE } = require('../lib/config');
const fs = require('fs');

// Mock inquirer
jest.mock('inquirer');

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

// Mock process.exit
const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('configure', () => {
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
    
    // Ensure config directory exists
    const configDir = require('path').dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Clean up config file before each test
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

  afterAll(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    exitSpy.mockRestore();
  });

  describe('creating new profile', () => {
    it('should create a new profile with provided credentials', async () => {
      inquirer.prompt.mockResolvedValue({
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      });

      await configure('new-profile');

      expect(inquirer.prompt).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Creating new profile: new-profile'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("Profile 'new-profile' saved successfully!"));

      const profile = getProfile('new-profile');
      expect(profile).toEqual({
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        token: 'test-token',
        tokenSecret: 'test-token-secret',
        realm: 'test-realm'
      });
    });

    it('should create default profile when no name provided', async () => {
      inquirer.prompt.mockResolvedValue({
        consumerKey: 'default-key',
        consumerSecret: 'default-secret',
        token: 'default-token',
        tokenSecret: 'default-token-secret',
        realm: 'default-realm'
      });

      await configure();

      const profile = getProfile('default');
      expect(profile).toEqual({
        consumerKey: 'default-key',
        consumerSecret: 'default-secret',
        token: 'default-token',
        tokenSecret: 'default-token-secret',
        realm: 'default-realm'
      });
    });
  });

  describe('editing existing profile', () => {
    it('should display existing profile values when editing', async () => {
      const existingProfile = {
        consumerKey: 'existing-key',
        consumerSecret: 'existing-secret',
        token: 'existing-token',
        tokenSecret: 'existing-token-secret',
        realm: 'existing-realm'
      };

      saveProfile('existing-profile', existingProfile);

      inquirer.prompt.mockResolvedValue({
        consumerKey: 'updated-key',
        consumerSecret: 'updated-secret',
        token: 'updated-token',
        tokenSecret: 'updated-token-secret',
        realm: 'updated-realm'
      });

      await configure('existing-profile');

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Editing existing profile: existing-profile'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Current configuration:'));

      const profile = getProfile('existing-profile');
      expect(profile).toEqual({
        consumerKey: 'updated-key',
        consumerSecret: 'updated-secret',
        token: 'updated-token',
        tokenSecret: 'updated-token-secret',
        realm: 'updated-realm'
      });
    });

    it('should mask sensitive values when displaying', async () => {
      const existingProfile = {
        consumerKey: 'verylongkey12345',
        consumerSecret: 'verylongsecret12345',
        token: 'verylongtoken12345',
        tokenSecret: 'verylongtokensecret12345',
        realm: 'realm-value'
      };

      saveProfile('test-profile', existingProfile);

      inquirer.prompt.mockResolvedValue({
        consumerKey: 'new-key',
        consumerSecret: 'new-secret',
        token: 'new-token',
        tokenSecret: 'new-token-secret',
        realm: 'new-realm'
      });

      await configure('test-profile');

      // Check that masked values are displayed
      const logCalls = consoleSpy.log.mock.calls.map(call => call[0]).join('\n');
      expect(logCalls).toContain('****');
    });
  });

  describe('error handling', () => {
    it('should handle TTY errors', async () => {
      const ttyError = new Error('TTY error');
      ttyError.isTtyError = true;
      inquirer.prompt.mockRejectedValue(ttyError);

      await configure('test-profile');

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining("Prompt couldn't be rendered"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle validation errors', async () => {
      inquirer.prompt.mockResolvedValue({
        consumerKey: '',
        consumerSecret: '',
        token: '',
        tokenSecret: '',
        realm: ''
      });

      await configure('test-profile');

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Invalid profile data'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle other errors', async () => {
      const error = new Error('Some error');
      inquirer.prompt.mockRejectedValue(error);

      await configure('test-profile');

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Some error'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('input trimming', () => {
    it('should trim whitespace from input values', async () => {
      inquirer.prompt.mockResolvedValue({
        consumerKey: '  test-key  ',
        consumerSecret: '  test-secret  ',
        token: '  test-token  ',
        tokenSecret: '  test-token-secret  ',
        realm: '  test-realm  '
      });

      await configure('trimmed-profile');

      const profile = getProfile('trimmed-profile');
      expect(profile.consumerKey).toBe('test-key');
      expect(profile.consumerSecret).toBe('test-secret');
      expect(profile.token).toBe('test-token');
      expect(profile.tokenSecret).toBe('test-token-secret');
      expect(profile.realm).toBe('test-realm');
    });
  });
});

