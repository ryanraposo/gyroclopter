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

function resolveInputBackend(options = {}) {
  const platform = options.platform || os.platform();
  const env = options.env || process.env;
  const requested = env.GYROCLOPTER_INPUT_BACKEND;

  if (requested) {
    const backend = BACKEND_ALIASES[String(requested).toLowerCase()];
    if (!backend) {
      throw new Error(`Unknown GYROCLOPTER_INPUT_BACKEND: ${requested}`);
    }
    return backend;
  }

  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
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

module.exports = {
  createInputController,
  resolveInputBackend
};
