const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadLocalWindowsStoreIdentity,
  loadWindowsStoreIdentity
} = require('../scripts/windows-store-config');

describe('Microsoft Store build configuration', () => {
  const validEnvironment = {
    WINDOWS_STORE_IDENTITY_NAME: '12345RyanRaposo.Gyroclopter',
    WINDOWS_STORE_PUBLISHER: 'CN=00000000-0000-0000-0000-000000000000',
    WINDOWS_STORE_PUBLISHER_DISPLAY_NAME: 'Ryan Raposo'
  };

  test('maps the exact Partner Center identity values', () => {
    expect(loadWindowsStoreIdentity(validEnvironment)).toEqual({
      identityName: '12345RyanRaposo.Gyroclopter',
      publisher: 'CN=00000000-0000-0000-0000-000000000000',
      publisherDisplayName: 'Ryan Raposo'
    });
  });

  test('lists missing values before a package build starts', () => {
    expect(() => loadWindowsStoreIdentity({})).toThrow(
      'WINDOWS_STORE_IDENTITY_NAME, WINDOWS_STORE_PUBLISHER, WINDOWS_STORE_PUBLISHER_DISPLAY_NAME'
    );
  });

  test('rejects an invalid package identity name', () => {
    expect(() => loadWindowsStoreIdentity({
      ...validEnvironment,
      WINDOWS_STORE_IDENTITY_NAME: 'Gyroclopter Store Package!'
    })).toThrow('WINDOWS_STORE_IDENTITY_NAME must be 3-50');
  });

  test('rejects a publisher value that is not a certificate subject', () => {
    expect(() => loadWindowsStoreIdentity({
      ...validEnvironment,
      WINDOWS_STORE_PUBLISHER: 'Ryan Raposo'
    })).toThrow('WINDOWS_STORE_PUBLISHER must be the Partner Center publisher value');
  });

  test('loads identity values from a private local JSON file', () => {
    const configPath = path.join(os.tmpdir(), `gyroclopter-store-${process.pid}.json`);
    fs.writeFileSync(configPath, JSON.stringify(validEnvironment));

    try {
      expect(loadLocalWindowsStoreIdentity(configPath).identityName).toBe(
        '12345RyanRaposo.Gyroclopter'
      );
    } finally {
      fs.unlinkSync(configPath);
    }
  });
});
