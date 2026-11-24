module.exports = {
  id: 'windows',
  aliases: ['win32'],
  family: 'desktop',
  scope: 'system',
  capabilities: ['pointer.relative', 'button.primary', 'button.secondary', 'scroll.vertical', 'drag'],
  match: options => options.platform === 'win32',
  create: options => {
    const env = options.env || process.env;
    if (env.GYROCLOPTER_WINDOWS_HELPER) return new (require('./store-input'))(options);
    return new (require('./input'))(options);
  }
};
