#!/usr/bin/env node

const { Command } = require('commander');
const { configure } = require('./lib/configure');
const { executeQuery } = require('./lib/query');
const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');

const program = new Command();

program
  .name('nsql-cli')
  .description('CLI tool for executing SuiteQL queries against NetSuite')
  .version(version);

program
  .command('configure')
  .description('Set up NetSuite account credentials')
  .option('-p, --profile <name>', 'Profile name to configure (defaults to "default")', 'default')
  .action(async (options) => {
    await configure(options.profile);
  });

/**
 * Read SQL query from a file
 * @param {string} filePath - File path (with or without file:// prefix)
 * @returns {string} SQL query content
 */
function readQueryFromFile(filePath) {
  // Remove file:// prefix if present
  let actualPath = filePath;
  if (filePath.startsWith('file://')) {
    actualPath = filePath.substring(7); // Remove 'file://' prefix
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
  const content = fs.readFileSync(resolvedPath, 'utf8');
  return content.trim();
}

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
        query = readQueryFromFile(options.cliInputSuiteql);
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
    // Commander stores unknown options in program.args or we can parse them manually
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

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

