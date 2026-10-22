const relay = require('../web-pilot/dev-server');

describe('Web Pilot relay protocol', () => {
  test('accepts the tiny pointer protocol', () => {
    expect(relay.validateInput({ type:'down' })).toEqual({ type:'down' });
    expect(relay.validateInput({ type:'move', dx:12, dy:-4 })).toEqual({ type:'move', dx:12, dy:-4 });
  });
  test('rejects arbitrary commands and extreme movement', () => {
    expect(relay.validateInput({ type:'eval', code:'alert(1)' })).toBeNull();
    expect(relay.validateInput({ type:'move', dx:999, dy:0 })).toBeNull();
  });
});
