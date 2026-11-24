const { getWindowsStoreIdentity } = require('./windows-store-config');

try {
  const identity = getWindowsStoreIdentity();
  console.log(`Microsoft Store identity is configured for ${identity.identityName}.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
