const { NetsuiteApiClient } = require('netsuite-api-client');
const { getProfile, getAllProfiles, CONFIG_FILE } = require('./config');
const fs = require('fs');

/**
 * Convert results to CSV format
 * @param {Object} results - Query results object with items array
 * @returns {string} CSV formatted string
 */
function formatAsCsv(results) {
  if (!results.items || results.items.length === 0) {
    return '';
  }

  // Get all unique keys from all items
  const allKeys = new Set();
  results.items.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });
  const headers = Array.from(allKeys);

  // Create CSV header row
  const headerRow = headers.map(header => escapeCsvValue(header)).join(',');

  // Create CSV data rows
  const dataRows = results.items.map(item => {
    return headers.map(header => {
      const value = item[header];
      if (value === null || value === undefined) {
        return '';
      }
      // Handle nested objects/arrays by JSON-stringifying them
      if (typeof value === 'object') {
        return escapeCsvValue(JSON.stringify(value));
      }
      return escapeCsvValue(String(value));
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Escape CSV value (handle quotes and commas)
 * @param {string} value - Value to escape
 * @returns {string} Escaped CSV value
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Replace placeholders in query with values
 * Supports :placeholder and :placeholderName syntax
 * @param {string} query - The original query with placeholders
 * @param {Object} params - Object with placeholder names as keys and values as values
 * @returns {string} Query with placeholders replaced
 */
function replacePlaceholders(query, params) {
  if (!params || Object.keys(params).length === 0) {
    return query;
  }

  let result = query;
  
  // Replace each placeholder
  for (const [key, value] of Object.entries(params)) {
    // Support both :name and :name: syntax
    const placeholder = `:${key}`;
    let replacement;
    
    const stringValue = String(value);
    
    // Determine if value should be quoted (strings) or not (numbers, booleans)
    // Check if string represents a number (integer or decimal)
    if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(stringValue)) {
      // Numbers should not be quoted
      replacement = stringValue;
    } else if (stringValue === 'true' || stringValue === 'false') {
      // Booleans should not be quoted
      replacement = stringValue;
    } else {
      // Strings: escape single quotes and wrap in quotes
      replacement = `'${stringValue.replace(/'/g, "''")}'`;
    }
    
    // Replace all occurrences of the placeholder
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
  }
  
  return result;
}

/**
 * Execute a SuiteQL query
 * @param {string} query - The SuiteQL query to execute
 * @param {string} profileName - Name of the profile to use (defaults to "default")
 * @param {boolean} dryRun - If true, preview query without executing (defaults to false)
 * @param {string} format - Output format: 'json' or 'csv' (defaults to 'json')
 * @param {Object} params - Optional object with placeholder values to replace in query
 */
async function executeQuery(query, profileName = 'default', dryRun = false, format = 'json', params = {}) {
  // Replace placeholders in query
  const finalQuery = replacePlaceholders(query, params);
  // Handle dry-run mode (works without credentials)
  if (dryRun) {
    console.log('Dry-run mode: Query will not be executed');
    console.log('Profile:', profileName);
    
    // Try to get profile info if config exists, but don't require it
    if (fs.existsSync(CONFIG_FILE)) {
      const profile = getProfile(profileName);
      if (profile) {
        console.log('Realm:', profile.realm);
        if (profile.baseUrl) {
          console.log('Base URL:', profile.baseUrl);
        }
      } else {
        console.log('Realm: (profile not found)');
      }
    } else {
      console.log('Realm: (configuration not found)');
    }
    
    console.log('Query:', finalQuery);
    if (params && Object.keys(params).length > 0) {
      console.log('Parameters:', JSON.stringify(params, null, 2));
    }
    return;
  }

  // Check if config file exists (required for actual execution)
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('Error: Configuration file not found.');
    console.error('Please run "nsql configure" first to set up your credentials.');
    process.exit(1);
  }

  // Get profile
  const profile = getProfile(profileName);
  if (!profile) {
    console.error(`Error: Profile '${profileName}' not found.`);
    const availableProfiles = getAllProfiles();
    console.error('Available profiles:', availableProfiles.length > 0 ? availableProfiles.join(', ') : 'none');
    console.error('Please run "nsql configure" to create a profile.');
    process.exit(1);
  }

  // Initialize NetSuite API client
  // Map camelCase config to the format expected by netsuite-api-client
  const clientConfig = {
    consumer_key: profile.consumerKey,
    consumer_secret_key: profile.consumerSecret,
    token: profile.token,
    token_secret: profile.tokenSecret,
    realm: profile.realm
  };

  // Add base_url if it exists (optional)
  if (profile.baseUrl) {
    clientConfig.base_url = profile.baseUrl;
  }

  // Validate format
  if (format !== 'json' && format !== 'csv') {
    console.error(`Error: Invalid format '${format}'. Supported formats: json, csv`);
    process.exit(1);
    return; // Early return for test compatibility (process.exit is mocked in tests)
  }

  try {
    const client = new NetsuiteApiClient(clientConfig);
    
    // Execute the query
    const results = await client.query(finalQuery);
    
    // Output results in the requested format
    if (format === 'csv') {
      const csvOutput = formatAsCsv(results);
      console.log(csvOutput);
    } else {
      // Default to JSON
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (error) {
    console.error('Error executing query:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

module.exports = { executeQuery, replacePlaceholders };

