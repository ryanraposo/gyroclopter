module.exports = {
  id: 'windows',
  aliases: ['win32'],
  family: 'desktop',
  scope: 'system',
  capabilities: ['pointer.relative', 'button.primary', 'button.secondary', 'scroll.vertical', 'drag'],
  match: options => options.platform === 'win32',
  create: options => new (require('./input'))(options)
};
