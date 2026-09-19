const fs = require('fs');
const os = require('os');
const WindowsInputController = require('./windows');
const LinuxInputController = require('./linux');
const UnsupportedInputController = require('./unsupported');

const BACKEND_ALIASES = {
  win32: 'windows',
  windows: 'windows',
  linux: 'linux',
  chromeos: 'chromeos',
  cros: 'chromeos',
  none: 'unsupported',
  unsupported: 'unsupported'
};

function isCrostini(options = {}) {
  const platform = options.platform || os.platform();
  const env = options.env || process.env;
  const existsSync = options.existsSync || fs.existsSync;

  if (platform !== 'linux') return false;
  if (env.GYROCLOPTER_CHROMEOS === '1') return true;
  if (env.CROS_USER_ID_HASH) return true;

  try {
    return existsSync('/mnt/chromeos');
  } catch (_) {
    return false;
  }
}

function resolveInputBackend(options = {}) {
  const platform = options.platform || os.platform();
  const env = options.env || process.env;
  const requested = env.GYROCLOPTER_INPUT_BACKEND;

  if (requested) {
    const backend = BACKEND_ALIASES[String(requested).toLowerCase()];
    if (!backend) throw new Error(`Unknown GYROCLOPTER_INPUT_BACKEND: ${requested}`);
    return backend;
  }

  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return isCrostini(options) ? 'chromeos' : 'linux';
  return 'unsupported';
}

function createInputController(options = {}) {
  const backend = resolveInputBackend(options);

  if (backend === 'windows') return new WindowsInputController(options);
  if (backend === 'linux') return new LinuxInputController(options);
  if (backend === 'chromeos') {
    const ChromeOSInputController = require('./chromeos');
    return new ChromeOSInputController(options);
  }
  return new UnsupportedInputController(options.platform || os.platform());
}

module.exports = { createInputController, resolveInputBackend, isCrostini };
