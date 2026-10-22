const WebSocket=require('ws');
const ChromeOSInputController=require('../input/chromeos');
const {isUsableIpv4}=require('../input/chromeos');
const {resolveInputBackend}=require('../input');

describe('ChromeOS input bridge',()=>{
  test('selects ChromeOS when explicitly requested',()=>{
    expect(resolveInputBackend({
      platform:'linux',
      env:{GYROCLOPTER_INPUT_BACKEND:'chromeos'},
      existsSync:()=>false
    })).toBe('chromeos');
  });

  test('validates host addresses supplied by setup',()=>{
    expect(isUsableIpv4('192.168.1.42')).toBe(true);
    expect(isUsableIpv4('10.0.0.7')).toBe(true);
    expect(isUsableIpv4('127.0.0.1')).toBe(false);
    expect(isUsableIpv4('169.254.1.4')).toBe(false);
    expect(isUsableIpv4('not-an-ip')).toBe(false);
  });

  test('relays stable input commands to localhost bridge clients',(done)=>{
    const controller=new ChromeOSInputController({bridgePort:0});
    controller.server.on('listening',()=>{
      const ws=new WebSocket(`ws://127.0.0.1:${controller.port}`);
      ws.on('message',(raw)=>{
        const message=JSON.parse(raw.toString());
        if(message.type!=='input') return;
        try {
          expect(message.command).toBe('MOVE 12 -4');
          expect(controller.available).toBe(true);
          ws.close(); controller.dispose(); done();
        } catch(err) { ws.close(); controller.dispose(); done(err); }
      });
      ws.on('open',()=>controller.sendCommand('MOVE 12 -4'));
      ws.on('error',(err)=>{controller.dispose(); done(err);});
    });
  });

  test('reports the Chromebook address supplied by the extension',(done)=>{
    const controller=new ChromeOSInputController({bridgePort:0});
    controller.once('host-address',(ip)=>{
      try {
        expect(ip).toBe('192.168.50.21');
        controller.dispose(); done();
      } catch(err) { controller.dispose(); done(err); }
    });
    controller.server.on('listening',()=>{
      const ws=new WebSocket(`ws://127.0.0.1:${controller.port}`);
      ws.on('open',()=>ws.send(JSON.stringify({
        type:'hello',client:'gyroclopter-chromeos',hostIp:'192.168.50.21'
      })));
      ws.on('error',(err)=>{controller.dispose(); done(err);});
    });
  });
});
