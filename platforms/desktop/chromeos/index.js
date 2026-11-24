module.exports = {
  id: 'chromeos',
  aliases: ['cros'],
  family: 'desktop',
  scope: 'system-semantic',
  capabilities: ['target.semantic', 'focus.select', 'focus.context', 'scroll.vertical'],
  // Experimental: never select this merely because a Linux container looks like Crostini.
  create: options => new (require('./input'))(options)
};
