const inquirer = require('inquirer');
const { getProfile, saveProfile, profileExists, getAllProfiles, validateProfile, saveOAuth2Profile, decryptOAuth2Profile } = require('./config');

// Inquirer v9+ uses default.prompt or createPromptModule()
const prompt = inquirer.default?.prompt || inquirer.createPromptModule();

const AUTH_TYPES = {
  OAUTH2: 'oauth2',
  OAUTH1: 'oauth1',
};

/**
 * Configure a NetSuite profile
 * @param {string} profileName - Name of the profile to configure
 */
async function configure(profileName = 'default') {
  const exists = profileExists(profileName);
  let existingProfile = null;
  let existingAuthType = null;

  if (exists) {
    existingProfile = getProfile(profileName);
    existingAuthType = existingProfile.authType || 'oauth1';
  }

  try {
    const { authType } = await prompt([
      {
        type: 'list',
        name: 'authType',
        message: 'Authentication method:',
        choices: [
          {
            name: 'OAuth 2.0 - Browser login (recommended)',
            value: AUTH_TYPES.OAUTH2,
          },
          {
            name: 'OAuth 1.0 / TBA - Token-based (legacy)',
            value: AUTH_TYPES.OAUTH1,
          },
        ],
        default: existingAuthType === 'oauth2' ? AUTH_TYPES.OAUTH2 : AUTH_TYPES.OAUTH1,
      },
    ]);

    if (authType === AUTH_TYPES.OAUTH2) {
      await configureOAuth2(profileName, existingProfile);
    } else {
      await configureOAuth1(profileName, existingProfile);
    }
  } catch (error) {
    if (error.isTtyError) {
      console.error('\nError: Prompt couldn\'t be rendered in the current environment');
      process.exit(1);
    } else {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  }
}

/**
 * Configure an OAuth 2.0 profile (credentials only -- login is separate)
 */
async function configureOAuth2(profileName, existingProfile) {
  const isExistingOAuth2 = existingProfile?.authType === 'oauth2';
  let decrypted = null;

  if (isExistingOAuth2) {
    decrypted = decryptOAuth2Profile(existingProfile);
    console.log(`\nEditing OAuth 2.0 profile: ${profileName}`);
    console.log('Current configuration:');
    console.log(`  Account ID: ${decrypted.accountId}`);
    console.log(`  Client ID:  ${maskValue(decrypted.clientId)}`);
    console.log(`  Client Secret: ${maskValue(decrypted.clientSecret)}`);
    if (decrypted.accessToken) {
      const expiry = decrypted.tokenExpiry
        ? new Date(decrypted.tokenExpiry).toLocaleString()
        : 'unknown';
      console.log(`  Token expires: ${expiry}`);
    }
    console.log('\nEnter new values (press Enter to keep current value):\n');
  } else {
    console.log(`\nConfiguring OAuth 2.0 profile: ${profileName}`);
    console.log('You will need your NetSuite Integration Record details.\n');
  }

  const answers = await prompt([
    {
      type: 'input',
      name: 'accountId',
      message: `Account ID${isExistingOAuth2 ? ` [${decrypted.accountId}]` : ' (e.g. TSTDRV1234567 or 1234567_SB1)'}:`,
      default: '',
      filter: (input) => input.trim() || (isExistingOAuth2 ? decrypted.accountId : ''),
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth2 ? decrypted.accountId : '');
        return value.length > 0 || 'Account ID is required';
      },
    },
    {
      type: 'input',
      name: 'clientId',
      message: `Client ID${isExistingOAuth2 ? ` [${maskValue(decrypted.clientId)}]` : ''}:`,
      default: '',
      filter: (input) => input.trim() || (isExistingOAuth2 ? decrypted.clientId : ''),
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth2 ? decrypted.clientId : '');
        return value.length > 0 || 'Client ID is required';
      },
    },
    {
      type: 'password',
      name: 'clientSecret',
      message: `Client Secret${isExistingOAuth2 ? ` [${maskValue(decrypted.clientSecret)}]` : ''}:`,
      mask: '*',
      default: '',
      filter: (input) => input.trim() || (isExistingOAuth2 ? decrypted.clientSecret : ''),
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth2 ? decrypted.clientSecret : '');
        return value.length > 0 || 'Client Secret is required';
      },
    },
  ]);

  const profileData = {
    accountId: answers.accountId,
    clientId: answers.clientId,
    clientSecret: answers.clientSecret,
  };

  if (!validateProfile({ ...profileData, authType: 'oauth2' })) {
    throw new Error('Invalid profile data: Account ID, Client ID, and Client Secret are required');
  }

  saveOAuth2Profile(profileName, profileData);
  console.log(`\nProfile '${profileName}' saved (OAuth 2.0).`);
  console.log(`Run 'nsql-cli login --profile ${profileName}' to authenticate via browser.`);
}

/**
 * Configure an OAuth 1.0 / TBA profile (legacy)
 */
async function configureOAuth1(profileName, existingProfile) {
  const isExistingOAuth1 = existingProfile && existingProfile.authType !== 'oauth2';

  if (isExistingOAuth1) {
    console.log(`\nEditing existing profile: ${profileName}`);
    console.log('Current configuration:');
    console.log(`  Consumer Key: ${maskValue(existingProfile.consumerKey)}`);
    console.log(`  Consumer Secret: ${maskValue(existingProfile.consumerSecret)}`);
    console.log(`  Token: ${maskValue(existingProfile.token)}`);
    console.log(`  Token Secret: ${maskValue(existingProfile.tokenSecret)}`);
    console.log(`  Realm: ${existingProfile.realm}`);
    console.log('\nEnter new values (press Enter to keep current value):\n');
  } else {
    console.log(`\nCreating new profile: ${profileName}\n`);
  }

  const questions = [
    {
      type: 'input',
      name: 'consumerKey',
      message: `Consumer Key${isExistingOAuth1 ? ` [${maskValue(existingProfile.consumerKey)}]` : ''}:`,
      default: '',
      filter: (input) => {
        const trimmed = input.trim();
        return trimmed || (isExistingOAuth1 ? existingProfile.consumerKey : '');
      },
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth1 ? existingProfile.consumerKey : '');
        return value.length > 0 || 'Consumer Key is required';
      }
    },
    {
      type: 'input',
      name: 'consumerSecret',
      message: `Consumer Secret${isExistingOAuth1 ? ` [${maskValue(existingProfile.consumerSecret)}]` : ''}:`,
      default: '',
      filter: (input) => {
        const trimmed = input.trim();
        return trimmed || (isExistingOAuth1 ? existingProfile.consumerSecret : '');
      },
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth1 ? existingProfile.consumerSecret : '');
        return value.length > 0 || 'Consumer Secret is required';
      }
    },
    {
      type: 'input',
      name: 'token',
      message: `Token${isExistingOAuth1 ? ` [${maskValue(existingProfile.token)}]` : ''}:`,
      default: '',
      filter: (input) => {
        const trimmed = input.trim();
        return trimmed || (isExistingOAuth1 ? existingProfile.token : '');
      },
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth1 ? existingProfile.token : '');
        return value.length > 0 || 'Token is required';
      }
    },
    {
      type: 'input',
      name: 'tokenSecret',
      message: `Token Secret${isExistingOAuth1 ? ` [${maskValue(existingProfile.tokenSecret)}]` : ''}:`,
      default: '',
      filter: (input) => {
        const trimmed = input.trim();
        return trimmed || (isExistingOAuth1 ? existingProfile.tokenSecret : '');
      },
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth1 ? existingProfile.tokenSecret : '');
        return value.length > 0 || 'Token Secret is required';
      }
    },
    {
      type: 'input',
      name: 'realm',
      message: `Realm${isExistingOAuth1 ? ` [${existingProfile.realm}]` : ''}:`,
      default: '',
      filter: (input) => {
        const trimmed = input.trim();
        return trimmed || (isExistingOAuth1 ? existingProfile.realm : '');
      },
      validate: (input) => {
        const value = input.trim() || (isExistingOAuth1 ? existingProfile.realm : '');
        return value.length > 0 || 'Realm is required';
      }
    }
  ];

  const answers = await prompt(questions);

  const profileData = {
    consumerKey: answers.consumerKey.trim(),
    consumerSecret: answers.consumerSecret.trim(),
    token: answers.token.trim(),
    tokenSecret: answers.tokenSecret.trim(),
    realm: answers.realm.trim()
  };

  if (!validateProfile(profileData)) {
    throw new Error('Invalid profile data: all fields are required');
  }

  saveProfile(profileName, profileData);
  console.log(`\nProfile '${profileName}' saved successfully!`);
}

/**
 * Mask sensitive values for display (AWS CLI style: shows last 4 chars)
 * @param {string} value - Value to mask
 * @returns {string} Masked value
 */
function maskValue(value) {
  if (!value || value.length === 0) {
    return '****';
  }
  if (value.length <= 4) {
    return '****';
  }
  const lastChars = value.substring(value.length - 4);
  return '*'.repeat(Math.max(12, value.length - 4)) + lastChars;
}

module.exports = { configure };
