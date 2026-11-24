const { createAdapterRegistry } = require('../input/registry');
const { resolveInputBackend, describeInputBackend, listInputBackends } = require('../input');

const controller = () => ({ name: 'fixture', available: false, sendCommand() {}, dispose() {} });
const unsupported = { id: 'unsupported', family: 'unsupported', scope: 'none', aliases: ['none'], create: controller };
const linux = { id: 'linux', family: 'desktop', scope: 'system', match: o => o.platform === 'linux', create: controller };
const tv = { id: 'tv-fixture', family: 'tv', scope: 'system', capabilities: ['focus.directional'], create: controller };

describe('platform adapter registry', () => {
  test('existing desktop defaults and explicit overrides are unchanged', () => {
    expect(resolveInputBackend({ platform: 'win32', env: {} })).toBe('windows');
    expect(resolveInputBackend({ platform: 'linux', env: {} })).toBe('linux');
    expect(resolveInputBackend({ platform: 'linux', env: { GYROCLOPTER_INPUT_BACKEND: 'none' } })).toBe('unsupported');
    expect(describeInputBackend({ platform: 'linux', env: {} })).toMatchObject({ id: 'linux', family: 'desktop', scope: 'system' });
    expect(listInputBackends().some(x => x.id === 'linux')).toBe(true);
  });

  test('remote targets are selected explicitly and capabilities are isolated', () => {
    const registry = createAdapterRegistry([unsupported, linux, tv]);
    expect(registry.resolve({ platform: 'linux' })).toBe('linux');
    expect(registry.resolve({ platform: 'unknown' })).toBe('unsupported');
    expect(registry.resolve({ adapterId: 'tv-fixture' })).toBe('tv-fixture');
    expect(registry.describe({ adapterId: 'tv-fixture' }).capabilities).toEqual(['focus.directional']);
    expect(registry.create({ adapterId: 'tv-fixture' }).name).toBe('fixture');
    expect(() => registry.resolve({ adapterId: 'missing' })).toThrow('Unknown GYROCLOPTER_INPUT_BACKEND');
    expect(() => createAdapterRegistry([unsupported, { ...tv, match: () => true }])).toThrow('Invalid adapter definition');
  });

  test('specialized local match wins, duplicate ids and ambiguous matches fail', () => {
    const specialized = { ...linux, id: 'special-linux', priority: 10, match: o => o.special === true };
    expect(createAdapterRegistry([unsupported, linux, specialized]).resolve({ platform: 'linux', special: true })).toBe('special-linux');
    expect(() => createAdapterRegistry([unsupported, linux, linux])).toThrow();
    expect(() => createAdapterRegistry([unsupported, linux, { ...linux, id: 'other' }]).resolve({ platform: 'linux' })).toThrow('Ambiguous native');
  });

  test('factory rejects malformed controllers', () => {
    const registry = createAdapterRegistry([unsupported, { ...tv, create: () => ({}) }]);
    expect(() => registry.create({ adapterId: 'tv-fixture' })).toThrow('Invalid input controller');
  });
});
