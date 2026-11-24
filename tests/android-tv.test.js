const {keyFor}=require('../platforms/tv/android-tv/keys');
const {resolveInputBackend,describeInputBackend}=require('../input');
test('Android TV is explicitly selected and exposes focus rather than pointer',()=>{
  expect(resolveInputBackend({platform:'linux',env:{}})).toBe('linux');
  expect(resolveInputBackend({adapterId:'google-tv',env:{}})).toBe('android-tv');
  expect(describeInputBackend({adapterId:'android-tv',env:{}}).capabilities).toEqual(['focus.directional','focus.select','navigation.back','navigation.home','media']);
});
test('only allowed Android remote keys are mapped',()=>{
  expect(keyFor({type:'focus',direction:'up'})).toBe('DPAD_UP');
  expect(keyFor({type:'select'})).toBe('DPAD_CENTER');
  expect(keyFor({type:'back'})).toBe('BACK');
  expect(keyFor({type:'media',command:'play-pause'})).toBe('MEDIA_PLAY_PAUSE');
  expect(keyFor({type:'focus',direction:'home'})).toBeNull();
  expect(keyFor({type:'move',dx:1,dy:2})).toBeNull();
});
