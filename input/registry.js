'use strict';

// Definitions are local, trusted code; no dynamic loading from user input.
function createAdapterRegistry(definitions) {
  const names = new Map();
  const ids = new Map();
  const capabilities = new Set(['pointer.relative','button.primary','button.secondary','scroll.vertical','drag','focus.directional','focus.select','focus.context','target.semantic','navigation.back','navigation.home','media','power','text']);
  for (const definition of definitions) {
    const { id, family, scope, create, match, priority = 0, aliases = [], capabilities: declared = [] } = definition;
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id) || typeof create !== 'function' ||
        !['desktop','tv','bridge','browser','unsupported'].includes(family) ||
        !['system','system-semantic','browser','app','none'].includes(scope) ||
        !Number.isFinite(priority) || (match !== undefined && (typeof match !== 'function' || family !== 'desktop')) ||
        declared.some(value => !capabilities.has(value))) {
      throw new Error('Invalid adapter definition: ' + id);
    }
    const entry = Object.freeze({ id, family, scope, create, match, priority, capabilities: Object.freeze([...new Set(declared)]) });
    ids.set(id, entry);
    for (const name of [id, ...aliases]) {
      if (!/^[a-z][a-z0-9-]*$/.test(name) || names.has(name)) throw new Error('Duplicate or invalid adapter alias: ' + name);
      names.set(name, entry);
    }
  }
  if (!ids.has('unsupported')) throw new Error('Missing unsupported adapter');
  const native = [...ids.values()].filter(entry => entry.match).sort((a,b) => b.priority - a.priority);
  function resolve(options = {}) {
    const requested = options.adapterId ?? options.env?.GYROCLOPTER_INPUT_BACKEND;
    if (requested) {
      const entry = names.get(String(requested).toLowerCase());
      if (!entry) throw new Error('Unknown GYROCLOPTER_INPUT_BACKEND: ' + requested);
      return entry;
    }
    const matches = native.filter(entry => entry.match(options));
    if (matches.length > 1 && matches[0].priority === matches[1].priority) {
      throw new Error('Ambiguous native input adapter: ' + matches[0].id + ', ' + matches[1].id);
    }
    return matches[0] || ids.get('unsupported');
  }
  function describe(entry) {
    return { id: entry.id, family: entry.family, scope: entry.scope, capabilities: [...entry.capabilities] };
  }
  return Object.freeze({
    resolve: options => resolve(options).id,
    describe: options => describe(resolve(options)),
    list: () => [...ids.values()].map(describe),
    create(options) {
      const entry = resolve(options);
      const controller = entry.create(options);
      if (!controller || typeof controller.name !== 'string' || typeof controller.available !== 'boolean' ||
          typeof controller.sendCommand !== 'function' || typeof controller.dispose !== 'function') {
        if (typeof controller?.dispose === 'function') controller.dispose();
        throw new Error('Invalid input controller: ' + entry.id);
      }
      return controller;
    }
  });
}

module.exports = { createAdapterRegistry };
