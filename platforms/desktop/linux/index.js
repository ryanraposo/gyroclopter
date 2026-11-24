module.exports = {
  id: 'linux',
  family: 'desktop',
  scope: 'system',
  capabilities: ['pointer.relative', 'button.primary', 'button.secondary', 'scroll.vertical', 'drag'],
  match: options => options.platform === 'linux',
  create: options => new (require('./input'))(options)
};
