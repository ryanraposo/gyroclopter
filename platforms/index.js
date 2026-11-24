const { createAdapterRegistry } = require('../input/registry');
const windows = require('./desktop/windows');
const linux = require('./desktop/linux');
const macos = require('./desktop/macos');
const chromeos = require('./desktop/chromeos');
const androidTv = require('./tv/android-tv');

const registry = createAdapterRegistry([
  windows,
  linux,
  macos,
  chromeos,
  androidTv,
  {
    id: 'unsupported', family: 'unsupported', scope: 'none', aliases: ['none'],
    create: options => new (require('../input/unsupported'))(options.platform)
  }
]);

module.exports = { registry };
