const packageMetadata = require('./package.json');
const { getWindowsStoreIdentity } = require('./scripts/windows-store-config');

const storeIdentity = getWindowsStoreIdentity();
const publisherDisplayName = storeIdentity.publisherDisplayName
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

module.exports = {
  ...packageMetadata.build,
  artifactName: '${name}-${version}-windows-store-${arch}.${ext}',
  extraMetadata: { gyroclopterEdition: 'store' },
  extraResources: [
    ...packageMetadata.build.extraResources,
    { from: 'build/windows-store/gyroclopter-mouse.exe', to: 'native/gyroclopter-mouse.exe' }
  ],
  directories: { ...packageMetadata.build.directories, output: 'dist/store' },
  publish: null,
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
    publisherDisplayName,
    setBuildNumber: false,
    displayName: 'Gyroclopter',
    backgroundColor: '#101827',
    languages: ['en-US'],
    capabilities: ['runFullTrust']
  }
};
