const KEYS = Object.freeze({
  up:'DPAD_UP',down:'DPAD_DOWN',left:'DPAD_LEFT',right:'DPAD_RIGHT',
  select:'DPAD_CENTER',back:'BACK',home:'HOME',
  'play-pause':'MEDIA_PLAY_PAUSE',play:'MEDIA_PLAY',pause:'MEDIA_PAUSE',stop:'MEDIA_STOP',
  next:'MEDIA_NEXT',previous:'MEDIA_PREVIOUS','volume-up':'VOLUME_UP','volume-down':'VOLUME_DOWN',mute:'VOLUME_MUTE'
});
function keyFor(action) {
  if (!action) return null;
  if (action.type === 'focus') return Object.hasOwn(KEYS,action.direction) && ['up','down','left','right'].includes(action.direction) ? KEYS[action.direction] : null;
  if (action.type === 'media') return ['play-pause','play','pause','stop','next','previous','volume-up','volume-down','mute'].includes(action.command) ? KEYS[action.command] : null;
  return ['select','back','home'].includes(action.type) ? KEYS[action.type] : null;
}
module.exports = {keyFor};
