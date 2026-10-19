const { loadLocalWindowsStoreIdentity } = require('./windows-store-config');

try {
  const identity = loadLocalWindowsStoreIdentity();
  console.log(`Microsoft Store identity is configured for ${identity.identityName}.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
