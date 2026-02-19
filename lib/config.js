const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const debug = require('./debug');

const CONFIG_DIR = path.join(os.homedir(), '.nsql-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const KEY_FILE = path.join(CONFIG_DIR, '.encryption-key');

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

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
 * Validate profile data structure. Supports both OAuth 1.0 and OAuth 2.0 profiles.
 * @param {Object} profileData - Profile configuration data
 * @returns {boolean} True if valid
 */
function validateProfile(profileData) {
  if (profileData.authType === 'oauth2') {
    const requiredFields = ['accountId', 'clientId', 'clientSecret'];
    return requiredFields.every(field => profileData[field] && typeof profileData[field] === 'string');
  }
  const requiredFields = ['consumerKey', 'consumerSecret', 'token', 'tokenSecret', 'realm'];
  return requiredFields.every(field => profileData[field] && typeof profileData[field] === 'string');
}

/**
 * Get credentials from environment variables
 * @returns {Object|null} Credentials object if ALL env vars are set, null otherwise
 */
function getEnvCredentials() {
  const envCreds = {
    consumerKey: process.env.NSQL_CONSUMER_KEY,
    consumerSecret: process.env.NSQL_CONSUMER_SECRET,
    token: process.env.NSQL_TOKEN,
    tokenSecret: process.env.NSQL_TOKEN_SECRET,
    realm: process.env.NSQL_REALM,
  };

  // Return credentials only if ALL are set
  const allSet = Object.values(envCreds).every((v) => v && v.length > 0);
  return allSet ? envCreds : null;
}

/**
 * Resolve credentials with precedence.
 * Priority: 1. OAuth2 env vars 2. OAuth1 env vars 3. Profile from config file
 * @param {string} profileName - Name of the profile to use as fallback
 * @returns {Object} Object with credentials, source, and authType
 */
function resolveCredentials(profileName = 'default') {
  debug.log('Resolving credentials for profile:', profileName);

  // Priority 1: OAuth 1.0 environment variables (all must be set)
  const envCreds = getEnvCredentials();
  if (envCreds) {
    debug.log('Using OAuth 1.0 environment variables');
    return { credentials: envCreds, source: 'environment', authType: 'oauth1' };
  }

  // Priority 2: Profile from config file
  const profile = getProfile(profileName);
  if (profile) {
    const authType = profile.authType || 'oauth1';
    debug.log('Found profile. Auth type:', authType);
    if (authType === 'oauth2') {
      debug.log('Decrypting OAuth 2.0 profile');
      const decrypted = decryptOAuth2Profile(profile);
      return { credentials: decrypted, source: 'profile', authType: 'oauth2' };
    }
    return { credentials: profile, source: 'profile', authType: 'oauth1' };
  }

  debug.log('No credentials found');
  return { credentials: null, source: null, authType: null };
}

// --- Encryption utilities ---

/**
 * Get or create a machine-local encryption key.
 * Stored in ~/.nsql-cli/.encryption-key with restricted permissions.
 */
function getEncryptionKey() {
  ensureConfigDir();
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  }
  const key = crypto.randomBytes(32).toString('hex').slice(0, 32);
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  return key;
}

/**
 * Encrypt a string with AES-256-CBC.
 * @param {string} text
 * @returns {string} iv:encrypted in hex
 */
function encrypt(text) {
  if (!text) return text;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a string encrypted with encrypt().
 * @param {string} text - iv:encrypted in hex
 * @returns {string}
 */
function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  const key = getEncryptionKey();
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key, 'utf8'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- OAuth 2.0 profile management ---

/**
 * Save an OAuth 2.0 profile with its initial configuration (before login).
 * Encrypts clientSecret.
 * @param {string} profileName
 * @param {Object} profileData - { accountId, clientId, clientSecret }
 */
function saveOAuth2Profile(profileName, profileData) {
  const config = readConfig();
  config[profileName] = {
    authType: 'oauth2',
    accountId: profileData.accountId,
    clientId: profileData.clientId,
    clientSecret: encrypt(profileData.clientSecret),
    realm: profileData.accountId,
  };
  writeConfig(config);
}

/**
 * Save OAuth 2.0 tokens to an existing profile. Encrypts refreshToken.
 * @param {string} profileName
 * @param {Object} tokens - { accessToken, refreshToken, expiresIn, tokenExpiry }
 */
function saveOAuth2Tokens(profileName, tokens) {
  const config = readConfig();
  const profile = config[profileName];
  if (!profile) {
    throw new Error(`Profile '${profileName}' not found`);
  }
  profile.accessToken = tokens.accessToken;
  profile.refreshToken = encrypt(tokens.refreshToken);
  profile.tokenExpiry = tokens.tokenExpiry;
  writeConfig(config);
}

/**
 * Decrypt sensitive fields in an OAuth 2.0 profile for use.
 * @param {Object} profile - Raw profile from config
 * @returns {Object} Profile with decrypted fields
 */
function decryptOAuth2Profile(profile) {
  return {
    ...profile,
    clientSecret: decrypt(profile.clientSecret),
    refreshToken: profile.refreshToken ? decrypt(profile.refreshToken) : null,
  };
}

/**
 * Check if an OAuth 2.0 profile's access token is expired or about to expire.
 * @param {Object} profile - Profile data
 * @returns {boolean} True if the token is expired or will expire within 5 minutes
 */
function isTokenExpired(profile) {
  if (!profile.tokenExpiry || !profile.accessToken) {
    return true;
  }
  return Date.now() >= (profile.tokenExpiry - TOKEN_EXPIRY_BUFFER_MS);
}

module.exports = {
  readConfig,
  writeConfig,
  getProfile,
  saveProfile,
  profileExists,
  getAllProfiles,
  validateProfile,
  getEnvCredentials,
  resolveCredentials,
  saveOAuth2Profile,
  saveOAuth2Tokens,
  decryptOAuth2Profile,
  isTokenExpired,
  encrypt,
  decrypt,
  CONFIG_DIR,
  CONFIG_FILE,
};

