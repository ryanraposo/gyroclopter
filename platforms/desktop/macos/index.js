module.exports = {
  id: 'macos', aliases: ['darwin'], family: 'desktop', scope: 'system',
  capabilities: ['pointer.relative', 'button.primary', 'button.secondary', 'scroll.vertical', 'drag'],
  match: options => options.platform === 'darwin',
  create: options => new (require('./input').MacMouseController)(options)
};
