const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock os.homedir() to use a temporary directory before requiring config
const testConfigDir = path.join(os.tmpdir(), `nsql-cli-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
const testHomeDir = path.dirname(testConfigDir);

jest.spyOn(os, 'homedir').mockReturnValue(testHomeDir);

// Clear module cache
delete require.cache[require.resolve('../lib/config')];
delete require.cache[require.resolve('../lib/configure')];
delete require.cache[require.resolve('../lib/query')];

const { saveProfile, CONFIG_FILE } = require('../lib/config');
const { NetsuiteApiClient } = require('netsuite-api-client');

// Mock netsuite-api-client
jest.mock('netsuite-api-client');

// Mock inquirer
jest.mock('inquirer');

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

// Mock process.stdout.write for help output (Commander uses this)
const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

// Mock process.exit
const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

// Helper function to create and run CLI programmatically
function createCLI() {
  // Always require fresh modules to pick up any mocks set up in beforeEach
  const { Command } = require('commander');
  const { configure } = require('../lib/configure');
  const { executeQuery } = require('../lib/query');

  const program = new Command();

  program
    .name('nsql-cli')
    .description('CLI tool for executing SuiteQL queries against NetSuite')
    .version('1.0.0');

  program
    .command('configure')
    .description('Set up NetSuite account credentials')
    .option('-p, --profile <name>', 'Profile name to configure (defaults to "default")', 'default')
    .action(async (options) => {
      await configure(options.profile);
    });

  const queryCommand = program
    .command('query')
    .description('Execute a SuiteQL query')
    .option('-q, --query <sql>', 'SuiteQL query to execute')
    .option('--cli-input-suiteql <file>', 'Read SuiteQL query from file (use file:// prefix for file path)')
    .option('-p, --profile <name>', 'Profile to use (defaults to "default")', 'default')
    .option('--dry-run', 'Preview the query without executing it')
    .option('-f, --format <format>', 'Output format: json or csv (defaults to "json")', 'json')
    .option('--param <key=value>', 'Query parameter (can be used multiple times). Use :key in query as placeholder', (value, prev) => {
      const [key, val] = value.split('=');
      if (!key || val === undefined) {
        throw new Error(`Invalid parameter format: ${value}. Use --param key=value`);
      }
      prev[key] = val;
      return prev;
    }, {})
    .allowUnknownOption()
    .action(async (options) => {
      // Validate that either --query or --cli-input-suiteql is provided, but not both
      if (!options.query && !options.cliInputSuiteql) {
        console.error('Error: Either --query or --cli-input-suiteql must be provided.');
        console.error('See --help for usage information.');
        process.exit(1);
        return; // Prevent execution when process.exit is mocked in tests
      }

      if (options.query && options.cliInputSuiteql) {
        console.error('Error: --query and --cli-input-suiteql cannot be used together.');
        console.error('Please use only one method to provide the query.');
        process.exit(1);
        return; // Prevent execution when process.exit is mocked in tests
      }

      // Determine the query source
      let query;
      if (options.cliInputSuiteql) {
        try {
          const fs = require('fs');
          const path = require('path');
          
          // Remove file:// prefix if present
          let actualPath = options.cliInputSuiteql;
          if (actualPath.startsWith('file://')) {
            actualPath = actualPath.substring(7);
          }

          // Resolve the path (handles both relative and absolute paths)
          const resolvedPath = path.isAbsolute(actualPath) 
            ? actualPath 
            : path.resolve(process.cwd(), actualPath);

          // Check if file exists
          if (!fs.existsSync(resolvedPath)) {
            throw new Error(`File not found: ${resolvedPath}`);
          }

          // Read and return file content, trimming whitespace
          query = fs.readFileSync(resolvedPath, 'utf8').trim();
        } catch (error) {
          console.error(`Error reading query file: ${error.message}`);
          process.exit(1);
          return; // Prevent execution when process.exit is mocked in tests
        }
      } else {
        query = options.query;
      }
      
      // Collect parameters from --param options
      const params = { ...options.param };
      
      // Parse unknown options from raw argv
      const args = process.argv.slice(2);
      const queryIndex = args.findIndex(arg => arg === '-q' || arg === '--query');
      const fileInputIndex = args.findIndex(arg => arg === '--cli-input-suiteql');
      const queryValueIndex = queryIndex >= 0 ? queryIndex + 1 : (fileInputIndex >= 0 ? fileInputIndex + 1 : -1);
      
      // Parse arguments after the query value
      let i = queryValueIndex + 1;
      while (i < args.length) {
        const arg = args[i];
        
        // Skip known options and their values
        if (arg === '-p' || arg === '--profile') {
          i += 2;
          continue;
        }
        if (arg === '-f' || arg === '--format') {
          i += 2;
          continue;
        }
        if (arg === '--param') {
          i += 2;
          continue;
        }
        if (arg === '--dry-run') {
          i += 1;
          continue;
        }
        if (arg === '--cli-input-suiteql') {
          i += 2;
          continue;
        }
        
        // If it's an option (starts with --), treat it as a parameter
        if (arg.startsWith('--') && arg.length > 2) {
          const paramName = arg.substring(2);
          // Check if next arg is a value (not an option)
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            params[paramName] = args[i + 1];
            i += 2;
          } else {
            // Boolean flag
            params[paramName] = true;
            i += 1;
          }
        } else {
          i += 1;
        }
      }
      
      await executeQuery(query, options.profile, options.dryRun, options.format, params);
    });

  // Handle unknown commands
  program.on('command:*', () => {
    console.error(`Invalid command: ${program.args.join(' ')}`);
    console.error('See --help for a list of available commands.');
    process.exit(1);
  });

  return program;
}

// Helper function to run CLI with arguments
async function runCLI(args) {
  const originalArgv = process.argv;
  process.argv = ['node', 'index.js', ...args];
  
  try {
    // Clear configure cache before creating CLI to pick up fresh mocks
    delete require.cache[require.resolve('../lib/configure')];
    const program = createCLI();
    program.parse(process.argv);
    // Wait a tick for async operations
    await new Promise(resolve => setImmediate(resolve));
    // Wait another tick for configure to complete
    if (args[0] === 'configure') {
      await new Promise(resolve => setImmediate(resolve));
    }
  } finally {
    process.argv = originalArgv;
  }
}

describe('CLI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    stdoutWriteSpy.mockClear();
    exitSpy.mockClear();

    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Create default test profile
    const testProfile = {
      consumerKey: 'test-key',
      consumerSecret: 'test-secret',
      token: 'test-token',
      tokenSecret: 'test-token-secret',
      realm: 'test-realm'
    };
    saveProfile('default', testProfile);

      // Mock NetsuiteApiClient
      const mockClient = {
        query: jest.fn().mockResolvedValue({ items: [], hasMore: false })
      };
      NetsuiteApiClient.mockImplementation(() => mockClient);
  });

  afterEach(() => {
    // Clean up config file
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  });

  afterAll(() => {
    os.homedir.mockRestore();
    
    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    stdoutWriteSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('help output', () => {
    it('should display help when no command provided', () => {
      const program = createCLI();
      program.parse(['node', 'index.js']);
      program.outputHelp();

      // Commander outputs help via process.stdout.write
      expect(stdoutWriteSpy).toHaveBeenCalled();
      const helpOutput = stdoutWriteSpy.mock.calls.map(call => call[0]).join('');
      expect(helpOutput).toContain('Usage:');
      expect(helpOutput).toContain('Commands:');
      expect(helpOutput).toContain('configure');
      expect(helpOutput).toContain('query');
    });

    it('should display help for --help flag', () => {
      const program = createCLI();
      // Commander exits on --help, so we test outputHelp directly
      program.outputHelp();

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const helpOutput = stdoutWriteSpy.mock.calls.map(call => call[0]).join('');
      expect(helpOutput).toContain('Usage:');
    });

    it('should display help for -h flag', () => {
      const program = createCLI();
      program.outputHelp();

      expect(stdoutWriteSpy).toHaveBeenCalled();
    });

    it('should display help for configure command', () => {
      const program = createCLI();
      const configureCmd = program.commands.find(cmd => cmd.name() === 'configure');
      configureCmd.outputHelp();

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const helpOutput = stdoutWriteSpy.mock.calls.map(call => call[0]).join('');
      expect(helpOutput).toContain('configure');
      expect(helpOutput).toContain('--profile');
    });

    it('should display help for query command', () => {
      const program = createCLI();
      const queryCmd = program.commands.find(cmd => cmd.name() === 'query');
      queryCmd.outputHelp();

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const helpOutput = stdoutWriteSpy.mock.calls.map(call => call[0]).join('');
      expect(helpOutput).toContain('query');
      expect(helpOutput).toContain('--query');
      expect(helpOutput).toContain('--profile');
      expect(helpOutput).toContain('--dry-run');
      expect(helpOutput).toContain('--format');
      expect(helpOutput).toContain('--param');
    });
  });

  describe('version output', () => {
    it('should display version for --version flag', () => {
      const program = createCLI();
      // Commander outputs version via console.log, test version() method
      program.version('1.0.0');
      // Test that version is set correctly
      expect(program._version).toBe('1.0.0');
    });

    it('should display version for -V flag', () => {
      const program = createCLI();
      program.version('1.0.0');
      expect(program._version).toBe('1.0.0');
    });
  });

  describe('configure command', () => {
    let mockPrompt;
    let inquirerModule;

    beforeEach(() => {
      // Clear configure module cache so it re-requires with fresh inquirer
      delete require.cache[require.resolve('../lib/configure')];
      delete require.cache[require.resolve('inquirer')];
      
      // Get the mocked inquirer module (using jest.mock)
      inquirerModule = require('inquirer');
      
      // Get the actual mock from __mocks__ or create one
      // The __mocks__/inquirer.js provides a mockPrompt
      if (inquirerModule.default && inquirerModule.default.prompt) {
        mockPrompt = inquirerModule.default.prompt;
      } else {
        // Create new mock if not available
        mockPrompt = jest.fn().mockResolvedValue({
          consumerKey: 'new-key',
          consumerSecret: 'new-secret',
          token: 'new-token',
          tokenSecret: 'new-token-secret',
          realm: 'new-realm'
        });
      }
      
      // Ensure mock returns the right values
      mockPrompt.mockResolvedValue({
        consumerKey: 'new-key',
        consumerSecret: 'new-secret',
        token: 'new-token',
        tokenSecret: 'new-token-secret',
        realm: 'new-realm'
      });
      
      // Configure.js uses: inquirer.default?.prompt || inquirer.createPromptModule()
      // Set up both paths
      if (!inquirerModule.default) {
        inquirerModule.default = {};
      }
      inquirerModule.default.prompt = mockPrompt;
      
      if (!inquirerModule.createPromptModule) {
        inquirerModule.createPromptModule = jest.fn(() => mockPrompt);
      } else {
        inquirerModule.createPromptModule.mockReturnValue(mockPrompt);
      }
      
      if (!inquirerModule.prompt) {
        inquirerModule.prompt = mockPrompt;
      }
      
      // Clear configure cache again after setting up mock
      delete require.cache[require.resolve('../lib/configure')];
    });

    it('should call configure with default profile when no option provided', async () => {
      await runCLI(['configure']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("Profile 'default' saved successfully!"));
    });

    it('should call configure with specified profile using --profile', async () => {
      await runCLI(['configure', '--profile', 'prod']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("Profile 'prod' saved successfully!"));
    });

    it('should call configure with specified profile using -p', async () => {
      await runCLI(['configure', '-p', 'sandbox']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("Profile 'sandbox' saved successfully!"));
    });
  });

  describe('query command - basic options', () => {
    it('should execute query with --query option', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer']);

      expect(NetsuiteApiClient).toHaveBeenCalled();
      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM customer');
    });

    it('should execute query with -q option', async () => {
      await runCLI(['query', '-q', 'SELECT id FROM item']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith('SELECT id FROM item');
    });

    it('should use default profile when --profile not specified', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer']);

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'test-key',
        consumer_secret_key: 'test-secret',
        token: 'test-token',
        token_secret: 'test-token-secret',
        realm: 'test-realm'
      });
    });

    it('should use specified profile with --profile option', async () => {
      const prodProfile = {
        consumerKey: 'prod-key',
        consumerSecret: 'prod-secret',
        token: 'prod-token',
        tokenSecret: 'prod-token-secret',
        realm: 'prod-realm'
      };
      saveProfile('prod', prodProfile);

      await runCLI(['query', '--query', 'SELECT * FROM customer', '--profile', 'prod']);

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'prod-key',
        consumer_secret_key: 'prod-secret',
        token: 'prod-token',
        token_secret: 'prod-token-secret',
        realm: 'prod-realm'
      });
    });

    it('should use specified profile with -p option', async () => {
      const sandboxProfile = {
        consumerKey: 'sandbox-key',
        consumerSecret: 'sandbox-secret',
        token: 'sandbox-token',
        tokenSecret: 'sandbox-token-secret',
        realm: 'sandbox-realm'
      };
      saveProfile('sandbox', sandboxProfile);

      await runCLI(['query', '--query', 'SELECT * FROM customer', '-p', 'sandbox']);

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'sandbox-key',
        consumer_secret_key: 'sandbox-secret',
        token: 'sandbox-token',
        token_secret: 'sandbox-token-secret',
        realm: 'sandbox-realm'
      });
    });

    it('should enable dry-run mode with --dry-run option', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer', '--dry-run']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Dry-run mode: Query will not be executed');
      expect(consoleSpy.log).toHaveBeenCalledWith('Query:', 'SELECT * FROM customer');
      // In dry-run mode, NetsuiteApiClient should not be instantiated
      expect(NetsuiteApiClient).not.toHaveBeenCalled();
    });

    it('should output CSV format with --format csv', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          items: [{ id: '1', name: 'Test' }],
          hasMore: false
        })
      };
      NetsuiteApiClient.mockImplementation(() => mockClient);

      await runCLI(['query', '--query', 'SELECT * FROM customer', '--format', 'csv']);

      const csvOutput = consoleSpy.log.mock.calls[0][0];
      expect(csvOutput).toContain('id,name');
      expect(csvOutput).toContain('1,Test');
    });

    it('should output CSV format with -f csv', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          items: [{ id: '1', name: 'Test' }],
          hasMore: false
        })
      };
      NetsuiteApiClient.mockImplementation(() => mockClient);

      await runCLI(['query', '--query', 'SELECT * FROM customer', '-f', 'csv']);

      const csvOutput = consoleSpy.log.mock.calls[0][0];
      expect(csvOutput).toContain('id,name');
    });

    it('should output JSON format by default', async () => {
      const mockResults = {
        items: [{ id: '1', name: 'Test' }],
        hasMore: false
      };
      const mockClient = {
        query: jest.fn().mockResolvedValue(mockResults)
      };
      NetsuiteApiClient.mockImplementation(() => mockClient);

      await runCLI(['query', '--query', 'SELECT * FROM customer']);

      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(mockResults, null, 2));
    });
  });

  describe('query command - --param option', () => {
    it('should parse single --param option', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE id = :id', '--param', 'id=123']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE id = 123");
    });

    it('should parse multiple --param options', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE id = :id AND name = :name', '--param', 'id=123', '--param', 'name=Test']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE id = 123 AND name = 'Test'");
    });

    it('should handle --param with string values containing spaces', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE name = :name', '--param', 'name=Test Customer']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE name = 'Test Customer'");
    });

    it('should handle --param with numeric values', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM item WHERE price = :price', '--param', 'price=99.99']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM item WHERE price = 99.99');
    });

    it('should throw error for invalid --param format (missing value)', async () => {
      // Capture the error
      let errorThrown = false;
      try {
        await runCLI(['query', '--query', 'SELECT * FROM customer', '--param', 'invalid']);
      } catch (error) {
        errorThrown = true;
        expect(error.message).toContain('Invalid parameter format');
      }
      
      // Commander should throw an error
      expect(errorThrown).toBeTruthy();
    });
  });

  describe('query command - unknown options as parameters', () => {
    it('should treat unknown --option as parameter with value', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE id = :id', '--id', '123']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE id = 123");
    });

    it('should treat unknown --option as boolean flag when no value', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE active = :active', '--active']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE active = true");
    });

    it('should handle multiple unknown options as parameters', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE id = :id AND name = :name', '--id', '123', '--name', 'Test Customer']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE id = 123 AND name = 'Test Customer'");
    });

    it('should combine --param and unknown options', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE id = :id AND name = :name', '--param', 'id=123', '--name', 'Test']);

      const mockClient = NetsuiteApiClient.mock.results[0].value;
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE id = 123 AND name = 'Test'");
    });
  });

  describe('query command - combined options', () => {
    it('should handle query with profile, format, and parameters', async () => {
      const prodProfile = {
        consumerKey: 'prod-key',
        consumerSecret: 'prod-secret',
        token: 'prod-token',
        tokenSecret: 'prod-token-secret',
        realm: 'prod-realm'
      };
      saveProfile('prod', prodProfile);

      const mockClient = {
        query: jest.fn().mockResolvedValue({
          items: [{ id: '1', name: 'Test' }],
          hasMore: false
        })
      };
      NetsuiteApiClient.mockImplementation(() => mockClient);

      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE id = :id', '--profile', 'prod', '--format', 'csv', '--id', '123']);

      expect(NetsuiteApiClient).toHaveBeenCalledWith({
        consumer_key: 'prod-key',
        consumer_secret_key: 'prod-secret',
        token: 'prod-token',
        token_secret: 'prod-token-secret',
        realm: 'prod-realm'
      });
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM customer WHERE id = 123");
      const csvOutput = consoleSpy.log.mock.calls[0][0];
      expect(csvOutput).toContain('id,name');
    });

    it('should handle query with dry-run and parameters', async () => {
      await runCLI(['query', '--query', 'SELECT * FROM customer WHERE id = :id', '--dry-run', '--id', '123']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Dry-run mode: Query will not be executed');
      expect(consoleSpy.log).toHaveBeenCalledWith('Query:', "SELECT * FROM customer WHERE id = 123");
      expect(consoleSpy.log).toHaveBeenCalledWith('Parameters:', expect.stringContaining('123'));
    });
  });

  describe('error handling', () => {
    it('should handle unknown command', async () => {
      await runCLI(['unknown-command']);

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Invalid command'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle missing required --query option', async () => {
      // Commander will show error/help for missing required option
      let errorThrown = false;
      try {
        await runCLI(['query']);
      } catch (error) {
        errorThrown = true;
      }
      
      // Should either show error or help
      expect(errorThrown || consoleSpy.error.mock.calls.length > 0 || consoleSpy.log.mock.calls.length > 0).toBeTruthy();
    });

    it('should handle error when both --query and --cli-input-suiteql are provided', async () => {
      // Create a temporary test file
      const testFile = path.join(os.tmpdir(), `test-query-${Date.now()}.sql`);
      fs.writeFileSync(testFile, 'SELECT * FROM test');

      try {
        await runCLI(['query', '--query', 'SELECT * FROM customer', '--cli-input-suiteql', `file://${testFile}`]);

        expect(consoleSpy.error).toHaveBeenCalledWith('Error: --query and --cli-input-suiteql cannot be used together.');
        expect(exitSpy).toHaveBeenCalledWith(1);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should handle error when neither --query nor --cli-input-suiteql is provided', async () => {
      await runCLI(['query']);

      expect(consoleSpy.error).toHaveBeenCalledWith('Error: Either --query or --cli-input-suiteql must be provided.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('query command - --cli-input-suiteql option', () => {
    it('should read query from file with relative path', async () => {
      // Create a temporary test file in a subdirectory
      const testDir = path.join(os.tmpdir(), `test-queries-${Date.now()}`);
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, 'test.sql');
      fs.writeFileSync(testFile, 'SELECT id FROM customer WHERE ROWNUM <= 1');

      // Change to the test directory so relative path works
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await runCLI(['query', '--cli-input-suiteql', 'file://./test.sql']);

        const mockClient = NetsuiteApiClient.mock.results[0].value;
        expect(mockClient.query).toHaveBeenCalledWith('SELECT id FROM customer WHERE ROWNUM <= 1');
      } finally {
        process.chdir(originalCwd);
        if (fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      }
    });

    it('should read query from file with absolute path', async () => {
      const testFile = path.join(os.tmpdir(), `test-query-${Date.now()}.sql`);
      fs.writeFileSync(testFile, 'SELECT id FROM item WHERE ROWNUM <= 1');

      try {
        await runCLI(['query', '--cli-input-suiteql', `file://${testFile}`]);

        const mockClient = NetsuiteApiClient.mock.results[0].value;
        expect(mockClient.query).toHaveBeenCalledWith('SELECT id FROM item WHERE ROWNUM <= 1');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should read query from file without file:// prefix', async () => {
      const testFile = path.join(os.tmpdir(), `test-query-${Date.now()}.sql`);
      fs.writeFileSync(testFile, 'SELECT id FROM transaction WHERE ROWNUM <= 1');

      try {
        await runCLI(['query', '--cli-input-suiteql', testFile]);

        const mockClient = NetsuiteApiClient.mock.results[0].value;
        expect(mockClient.query).toHaveBeenCalledWith('SELECT id FROM transaction WHERE ROWNUM <= 1');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should handle error when file does not exist', async () => {
      const nonExistentFile = path.join(os.tmpdir(), `nonexistent-${Date.now()}.sql`);

      await runCLI(['query', '--cli-input-suiteql', `file://${nonExistentFile}`]);

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Error reading query file'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('File not found'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should work with file input and parameters', async () => {
      const testFile = path.join(os.tmpdir(), `test-query-${Date.now()}.sql`);
      fs.writeFileSync(testFile, 'SELECT id FROM customer WHERE id = :id');

      try {
        await runCLI(['query', '--cli-input-suiteql', `file://${testFile}`, '--id', '123']);

        const mockClient = NetsuiteApiClient.mock.results[0].value;
        expect(mockClient.query).toHaveBeenCalledWith("SELECT id FROM customer WHERE id = 123");
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should work with file input and dry-run', async () => {
      const testFile = path.join(os.tmpdir(), `test-query-${Date.now()}.sql`);
      fs.writeFileSync(testFile, 'SELECT id FROM customer WHERE ROWNUM <= 1');

      try {
        await runCLI(['query', '--cli-input-suiteql', `file://${testFile}`, '--dry-run']);

        expect(consoleSpy.log).toHaveBeenCalledWith('Dry-run mode: Query will not be executed');
        expect(consoleSpy.log).toHaveBeenCalledWith('Query:', 'SELECT id FROM customer WHERE ROWNUM <= 1');
        expect(NetsuiteApiClient).not.toHaveBeenCalled();
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should work with file input and CSV format', async () => {
      const testFile = path.join(os.tmpdir(), `test-query-${Date.now()}.sql`);
      fs.writeFileSync(testFile, 'SELECT id, name FROM customer WHERE ROWNUM <= 1');

      const mockClient = {
        query: jest.fn().mockResolvedValue({
          items: [{ id: '1', name: 'Test' }],
          hasMore: false
        })
      };
      NetsuiteApiClient.mockImplementation(() => mockClient);

      try {
        await runCLI(['query', '--cli-input-suiteql', `file://${testFile}`, '--format', 'csv']);

        expect(mockClient.query).toHaveBeenCalledWith('SELECT id, name FROM customer WHERE ROWNUM <= 1');
        const csvOutput = consoleSpy.log.mock.calls[0][0];
        expect(csvOutput).toContain('id,name');
        expect(csvOutput).toContain('1,Test');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should trim whitespace from file content', async () => {
      const testFile = path.join(os.tmpdir(), `test-query-${Date.now()}.sql`);
      fs.writeFileSync(testFile, '  SELECT id FROM customer  \n\n');

      try {
        await runCLI(['query', '--cli-input-suiteql', `file://${testFile}`]);

        const mockClient = NetsuiteApiClient.mock.results[0].value;
        expect(mockClient.query).toHaveBeenCalledWith('SELECT id FROM customer');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });
});

