const packageMetadata = require('./package.json');
const { loadLocalWindowsStoreIdentity } = require('./scripts/windows-store-config');

const storeIdentity = loadLocalWindowsStoreIdentity();

module.exports = {
  ...packageMetadata.build,
  artifactName: '${name}-${version}-windows-store-${arch}.${ext}',
  win: {
    target: [{
      target: 'appx',
      arch: ['x64']
    }]
  },
  appx: {
    applicationId: 'Gyroclopter',
    identityName: storeIdentity.identityName,
    publisher: storeIdentity.publisher,
    publisherDisplayName: storeIdentity.publisherDisplayName,
    displayName: 'Gyroclopter',
    backgroundColor: '#101827',
    languages: ['en-US'],
    capabilities: ['runFullTrust']
  }
};
