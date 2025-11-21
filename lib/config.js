const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.nsql-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Ensure the config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Read the configuration file
 * @returns {Object} Configuration object with profiles
 */
function readConfig() {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read config file: ${error.message}`);
  }
}

/**
 * Write the configuration file
 * @param {Object} config - Configuration object with profiles
 */
function writeConfig(config) {
  ensureConfigDir();
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to write config file: ${error.message}`);
  }
}

/**
 * Get a specific profile from the config
 * @param {string} profileName - Name of the profile (defaults to "default")
 * @returns {Object|null} Profile configuration or null if not found
 */
function getProfile(profileName = 'default') {
  const config = readConfig();
  return config[profileName] || null;
}

/**
 * Save a profile to the config
 * @param {string} profileName - Name of the profile
 * @param {Object} profileData - Profile configuration data
 */
function saveProfile(profileName, profileData) {
  const config = readConfig();
  config[profileName] = profileData;
  writeConfig(config);
}

/**
 * Check if a profile exists
 * @param {string} profileName - Name of the profile
 * @returns {boolean} True if profile exists
 */
function profileExists(profileName) {
  const config = readConfig();
  return profileName in config;
}

/**
 * Get all profile names
 * @returns {string[]} Array of profile names
 */
function getAllProfiles() {
  const config = readConfig();
  return Object.keys(config);
}

/**
 * Validate profile data structure
 * @param {Object} profileData - Profile configuration data
 * @returns {boolean} True if valid
 */
function validateProfile(profileData) {
  const requiredFields = ['consumerKey', 'consumerSecret', 'token', 'tokenSecret', 'realm'];
  return requiredFields.every(field => profileData[field] && typeof profileData[field] === 'string');
}

module.exports = {
  readConfig,
  writeConfig,
  getProfile,
  saveProfile,
  profileExists,
  getAllProfiles,
  validateProfile,
  CONFIG_FILE
};

