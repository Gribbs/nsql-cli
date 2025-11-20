const { NetsuiteApiClient } = require('netsuite-api-client');
const { getProfile, getAllProfiles, CONFIG_FILE } = require('./config');
const fs = require('fs');

/**
 * Execute a SuiteQL query
 * @param {string} query - The SuiteQL query to execute
 * @param {string} profileName - Name of the profile to use (defaults to "default")
 */
async function executeQuery(query, profileName = 'default') {
  // Check if config file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('Error: Configuration file not found.');
    console.error('Please run "suiteql-cli configure" first to set up your credentials.');
    process.exit(1);
  }

  // Get profile
  const profile = getProfile(profileName);
  if (!profile) {
    console.error(`Error: Profile '${profileName}' not found.`);
    const availableProfiles = getAllProfiles();
    console.error('Available profiles:', availableProfiles.length > 0 ? availableProfiles.join(', ') : 'none');
    console.error('Please run "suiteql-cli configure" to create a profile.');
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

  try {
    const client = new NetsuiteApiClient(clientConfig);
    
    // Execute the query
    const results = await client.query(query);
    
    // Output results as JSON
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error executing query:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

module.exports = { executeQuery };

