const fs = require('fs');
const path = require('path');

const LOCAL_CONFIG_PATH = path.join(__dirname, '..', 'store-config.local.json');
const STORE_ENVIRONMENT_VARIABLES = [
  'WINDOWS_STORE_IDENTITY_NAME',
  'WINDOWS_STORE_PUBLISHER',
  'WINDOWS_STORE_PUBLISHER_DISPLAY_NAME'
];

/**
 * Reads and validates the package identity assigned by Microsoft Partner Center.
 *
 * @param {NodeJS.ProcessEnv} env environment values to read
 * @returns {{identityName: string, publisher: string, publisherDisplayName: string}}
 */
function loadWindowsStoreIdentity(env = process.env) {
  const missing = STORE_ENVIRONMENT_VARIABLES.filter(name => !env[name] || !env[name].trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing Microsoft Store configuration: ${missing.join(', ')}. ` +
      'Copy these exact values from Partner Center > Product management > Product identity.'
    );
  }

  const identityName = env.WINDOWS_STORE_IDENTITY_NAME.trim();
  const publisher = env.WINDOWS_STORE_PUBLISHER.trim();
  const publisherDisplayName = env.WINDOWS_STORE_PUBLISHER_DISPLAY_NAME.trim();

  if (!/^[A-Za-z0-9.-]{3,50}$/.test(identityName)) {
    throw new Error('WINDOWS_STORE_IDENTITY_NAME must be 3-50 letters, numbers, periods, or hyphens.');
  }
  if (!/^CN=.+/.test(publisher)) {
    throw new Error('WINDOWS_STORE_PUBLISHER must be the Partner Center publisher value beginning with CN=.');
  }
  if (publisherDisplayName.length > 256) {
    throw new Error('WINDOWS_STORE_PUBLISHER_DISPLAY_NAME must be no more than 256 characters.');
  }

  return { identityName, publisher, publisherDisplayName };
}

/**
 * Loads the private, gitignored Partner Center identity file.
 *
 * @param {string} configPath path to the local JSON file
 * @returns {{identityName: string, publisher: string, publisherDisplayName: string}}
 */
function loadLocalWindowsStoreIdentity(configPath = LOCAL_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing local Microsoft Store configuration at ${configPath}. ` +
      'Create store-config.local.json using the values from Partner Center.'
    );
  }

  let localConfig;
  try {
    localConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${configPath}: ${err.message}`);
  }

  return loadWindowsStoreIdentity(localConfig);
}

module.exports = {
  LOCAL_CONFIG_PATH,
  STORE_ENVIRONMENT_VARIABLES,
  loadLocalWindowsStoreIdentity,
  loadWindowsStoreIdentity
};
