const os = require('os');
const { registry } = require('../platforms');

function normalize(options = {}) {
  return { ...options, platform: options.platform || os.platform(), env: options.env || process.env };
}

function resolveInputBackend(options = {}) {
  return registry.resolve(normalize(options));
}

function createInputController(options = {}) {
  return registry.create(normalize(options));
}

function describeInputBackend(options = {}) {
  return registry.describe(normalize(options));
}

function listInputBackends() {
  return registry.list();
}

module.exports = { resolveInputBackend, createInputController, describeInputBackend, listInputBackends };
