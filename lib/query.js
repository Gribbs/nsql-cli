const { NetsuiteApiClient } = require('netsuite-api-client');
const { resolveCredentials, getAllProfiles, isTokenExpired, saveOAuth2Tokens } = require('./config');
const { refreshAccessToken } = require('./oauth2');
const { executeSuiteQL } = require('./netsuite-client');
const debug = require('./debug');

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
  // Validate query is provided
  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }
  
  // Replace placeholders in query
  let finalQuery = replacePlaceholders(query, params);
  
  // Normalize whitespace: replace all whitespace sequences (including newlines) with single spaces
  // This ensures queries from files work correctly with NetSuite's API
  if (finalQuery && typeof finalQuery === 'string') {
    finalQuery = finalQuery.replace(/\s+/g, ' ').trim();
  }
  // Handle dry-run mode (works without credentials)
  if (dryRun) {
    console.log('Dry-run mode: Query will not be executed');
    
    // Try to get credentials info, but don't require it for dry-run
    const { credentials, source, authType } = resolveCredentials(profileName);
    if (credentials) {
      console.log('Credentials source:', source === 'environment' ? 'environment variables' : `profile '${profileName}'`);
      console.log('Auth type:', authType === 'oauth2' ? 'OAuth 2.0' : 'OAuth 1.0 (TBA)');
      console.log('Realm:', credentials.realm || credentials.accountId);
      if (credentials.baseUrl) {
        console.log('Base URL:', credentials.baseUrl);
      }
    } else {
      console.log('Credentials source: (none found)');
    }
    
    console.log('Query:', finalQuery);
    if (params && Object.keys(params).length > 0) {
      console.log('Parameters:', JSON.stringify(params, null, 2));
    }
    return;
  }

  // Resolve credentials (env vars take precedence over profile)
  const { credentials, source, authType } = resolveCredentials(profileName);
  debug.log('Credentials source:', source || 'none');
  debug.log('Auth type:', authType || 'none');

  if (!credentials) {
    console.error('Error: No credentials found.');
    console.error('Set up a profile:');
    console.error('  nsql-cli configure          (interactive setup)');
    console.error('  nsql-cli login              (OAuth 2.0 browser login)');
    console.error('Or provide OAuth 1.0 credentials via environment variables:');
    console.error('  NSQL_CONSUMER_KEY, NSQL_CONSUMER_SECRET, NSQL_TOKEN,');
    console.error('  NSQL_TOKEN_SECRET, NSQL_REALM');
    const availableProfiles = getAllProfiles();
    if (availableProfiles.length > 0) {
      console.error('Or use an existing profile:', availableProfiles.join(', '));
    }
    process.exit(1);
    return;
  }

  // Validate format
  if (format !== 'json' && format !== 'csv') {
    console.error(`Error: Invalid format '${format}'. Supported formats: json, csv`);
    process.exit(1);
    return;
  }

  try {
    let results;
    debug.log('Executing query:', finalQuery);

    if (authType === 'oauth2') {
      results = await executeOAuth2Query(credentials, profileName, finalQuery);
    } else {
      results = await executeOAuth1Query(credentials, finalQuery);
    }
    
    if (format === 'csv') {
      const csvOutput = formatAsCsv(results);
      console.log(csvOutput);
    } else {
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

/**
 * Execute a query using OAuth 1.0 (TBA) via netsuite-api-client
 */
async function executeOAuth1Query(credentials, query) {
  const clientConfig = {
    consumer_key: credentials.consumerKey,
    consumer_secret_key: credentials.consumerSecret,
    token: credentials.token,
    token_secret: credentials.tokenSecret,
    realm: credentials.realm
  };

  if (credentials.baseUrl) {
    clientConfig.base_url = credentials.baseUrl;
  }

  const client = new NetsuiteApiClient(clientConfig);
  return await client.query(query);
}

/**
 * Execute a query using OAuth 2.0 Bearer tokens with automatic refresh
 */
async function executeOAuth2Query(credentials, profileName, query) {
  let { accessToken } = credentials;
  const { accountId, clientId, clientSecret, refreshToken } = credentials;

  debug.log('OAuth 2.0 query for account:', accountId);
  debug.log('Access token:', debug.maskToken(accessToken));
  debug.log('Refresh token:', debug.maskToken(refreshToken));

  if (!accessToken || !refreshToken) {
    console.error(`Error: Profile '${profileName}' has no tokens. Run 'nsql-cli login --profile ${profileName}' first.`);
    process.exit(1);
    return;
  }

  const expired = isTokenExpired(credentials);
  debug.log('Token expired:', expired);
  if (credentials.tokenExpiry) {
    debug.log('Token expiry:', new Date(credentials.tokenExpiry).toISOString());
  }

  if (expired) {
    debug.log('Refreshing access token...');
    try {
      const tokens = await refreshAccessToken(accountId, clientId, clientSecret, refreshToken);
      const tokenExpiry = Date.now() + (tokens.expiresIn * 1000);
      const newRefreshToken = tokens.refreshToken || refreshToken;
      debug.log('Token refreshed. New expiry:', new Date(tokenExpiry).toISOString());
      debug.log('New access token:', debug.maskToken(tokens.accessToken));
      debug.log('Refresh token rotated:', !!tokens.refreshToken && tokens.refreshToken !== refreshToken);
      saveOAuth2Tokens(profileName, {
        accessToken: tokens.accessToken,
        refreshToken: newRefreshToken,
        tokenExpiry,
      });
      accessToken = tokens.accessToken;
    } catch (err) {
      debug.log('Token refresh error:', err.message);
      console.error(`Token refresh failed: ${err.message}`);
      console.error(`Run 'nsql-cli login --profile ${profileName}' to re-authenticate.`);
      process.exit(1);
      return;
    }
  }

  return await executeSuiteQL(accountId, accessToken, query);
}

module.exports = { executeQuery, replacePlaceholders };

