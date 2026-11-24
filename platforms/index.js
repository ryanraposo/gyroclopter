const { createAdapterRegistry } = require('../input/registry');
const windows = require('./desktop/windows');
const linux = require('./desktop/linux');

const registry = createAdapterRegistry([
  windows,
  linux,
  {
    id: 'unsupported', family: 'unsupported', scope: 'none', aliases: ['none'],
    create: options => new (require('../input/unsupported'))(options.platform)
  }
]);

module.exports = { registry };
