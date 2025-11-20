#!/usr/bin/env node

const { Command } = require('commander');
const { configure } = require('./lib/configure');
const { executeQuery } = require('./lib/query');

const program = new Command();

program
  .name('suiteql-cli')
  .description('CLI tool for executing SuiteQL queries against NetSuite')
  .version('1.0.0');

program
  .command('configure')
  .description('Set up NetSuite account credentials')
  .option('-p, --profile <name>', 'Profile name to configure (defaults to "default")', 'default')
  .action(async (options) => {
    await configure(options.profile);
  });

program
  .command('query')
  .description('Execute a SuiteQL query')
  .requiredOption('-q, --query <sql>', 'SuiteQL query to execute')
  .option('-p, --profile <name>', 'Profile to use (defaults to "default")', 'default')
  .action(async (options) => {
    await executeQuery(options.query, options.profile);
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

