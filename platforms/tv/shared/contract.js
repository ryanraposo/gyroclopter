const capabilities = Object.freeze({focus:'focus.directional', select:'focus.select', back:'navigation.back', home:'navigation.home', media:'media', move:'pointer.relative', down:'button.primary', up:'button.primary', right:'button.secondary', scroll:'scroll.vertical'});
function action(value) {
  if (!value || !Object.hasOwn(capabilities, value.type)) return null;
  const {type} = value;
  if (type === 'focus') return ['up','down','left','right'].includes(value.direction) ? {type,direction:value.direction} : null;
  if (type === 'media') return ['play-pause','play','pause','stop','next','previous','volume-up','volume-down','mute'].includes(value.command) ? {type,command:value.command} : null;
  const valid = n => Number.isSafeInteger(n) && Math.abs(n) <= 4096;
  if (type === 'move') return valid(value.dx) && valid(value.dy) ? {type,dx:value.dx,dy:value.dy} : null;
  if (type === 'scroll') return valid(value.delta) ? {type,delta:value.delta} : null;
  return {type};
}
function negotiate(declared, observed) {
  if (!Array.isArray(declared) || !Array.isArray(observed)) return [];
  const known = new Set([...Object.values(capabilities),'drag']);
  return [...new Set(observed)].filter(v => known.has(v) && declared.includes(v));
}
module.exports = {capabilities,action,negotiate};
