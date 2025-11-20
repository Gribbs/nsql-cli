const inquirer = require('inquirer');
const { getProfile, saveProfile, profileExists, getAllProfiles, validateProfile } = require('./config');

// Inquirer v9+ uses default.prompt or createPromptModule()
const prompt = inquirer.default?.prompt || inquirer.createPromptModule();

/**
 * Configure a NetSuite profile
 * @param {string} profileName - Name of the profile to configure
 */
async function configure(profileName = 'default') {
  const exists = profileExists(profileName);
  let existingProfile = null;

  if (exists) {
    existingProfile = getProfile(profileName);
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
      message: 'Consumer Key:',
      default: existingProfile?.consumerKey || '',
      validate: (input) => input.trim().length > 0 || 'Consumer Key is required'
    },
    {
      type: 'input',
      name: 'consumerSecret',
      message: 'Consumer Secret:',
      default: existingProfile?.consumerSecret || '',
      validate: (input) => input.trim().length > 0 || 'Consumer Secret is required'
    },
    {
      type: 'input',
      name: 'token',
      message: 'Token:',
      default: existingProfile?.token || '',
      validate: (input) => input.trim().length > 0 || 'Token is required'
    },
    {
      type: 'input',
      name: 'tokenSecret',
      message: 'Token Secret:',
      default: existingProfile?.tokenSecret || '',
      validate: (input) => input.trim().length > 0 || 'Token Secret is required'
    },
    {
      type: 'input',
      name: 'realm',
      message: 'Realm:',
      default: existingProfile?.realm || '',
      validate: (input) => input.trim().length > 0 || 'Realm is required'
    }
  ];

  try {
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
    console.log(`\n✓ Profile '${profileName}' saved successfully!`);
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
 * Mask sensitive values for display
 * @param {string} value - Value to mask
 * @returns {string} Masked value
 */
function maskValue(value) {
  if (!value || value.length <= 4) {
    return '****';
  }
  return value.substring(0, 2) + '****' + value.substring(value.length - 2);
}

module.exports = { configure };

