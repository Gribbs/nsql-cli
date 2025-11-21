#!/usr/bin/env node

const { Command } = require('commander');
const { configure } = require('./lib/configure');
const { executeQuery } = require('./lib/query');

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
  .requiredOption('-q, --query <sql>', 'SuiteQL query to execute')
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
    // Collect parameters from --param options
    const params = { ...options.param };
    
    // Parse unknown options from raw argv
    // Commander stores unknown options in program.args or we can parse them manually
    const args = process.argv.slice(2);
    const queryIndex = args.findIndex(arg => arg === '-q' || arg === '--query');
    const queryValueIndex = queryIndex >= 0 ? queryIndex + 1 : -1;
    
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
    
    await executeQuery(options.query, options.profile, options.dryRun, options.format, params);
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

