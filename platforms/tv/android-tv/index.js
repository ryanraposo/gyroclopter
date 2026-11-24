const {EventEmitter}=require('node:events');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const path=require('node:path');
const {endpoint}=require('../shared/discovery');
const {TvSession}=require('../shared/session');
const {keyFor}=require('./keys');

const CAPABILITIES=['focus.directional','focus.select','navigation.back','navigation.home','media'];
class AndroidTransport extends EventEmitter {
  constructor({env=process.env,spawnProcess=spawn}={}) {
    super();
    const {host}=endpoint(env.GYROCLOPTER_ANDROIDTV_HOST,6466);
    const state=env.GYROCLOPTER_ANDROIDTV_CREDENTIALS;
    if(!state || !path.isAbsolute(state)) throw Error('Set GYROCLOPTER_ANDROIDTV_CREDENTIALS to an absolute paired state directory');
    if(__dirname.includes('app.asar')) throw Error('Android TV prototype must run from a source checkout');
    this.closed=false; this.ready=false;
    this.child=spawnProcess(env.GYROCLOPTER_ANDROIDTV_PYTHON||'python3',
      ['-u',path.join(__dirname,'bridge.py'),'serve','--host',host,'--state',state],
      {stdio:['pipe','pipe','pipe'],windowsHide:true});
    const unavailable=()=>{this.ready=false;if(!this.closed)this.emit('unavailable');};
    const fail=()=>{unavailable();if(!this.closed)this.emit('error',new Error('Android TV helper unavailable'));};
    this.lines=createInterface({input:this.child.stdout});
    this.lines.on('line',line=>{
      if(this.closed)return;
      try{
        const msg=JSON.parse(line);
        if(msg.event==='ready'){this.ready=true;this.emit('ready',CAPABILITIES);}
        else if(msg.event==='unavailable')unavailable();
        else if(msg.event==='error')fail();
      }catch(_){fail();}
    });
    this.child.stderr.resume(); // Do not relay potentially sensitive library diagnostics.
    this.child.on('error',fail);
    this.child.on('close',unavailable);
    this.child.stdin.on('error',fail);
  }
  send(action){
    const key=keyFor(action);
    if(!key||!this.ready||this.closed||!this.child.stdin.writable||this.child.stdin.writableNeedDrain)return false;
    this.child.stdin.write(JSON.stringify({key})+'\n');return true;
  }
  close(){if(this.closed)return;this.closed=true;this.ready=false;this.lines.close();this.child.stdin.end();const child=this.child;const timeout=setTimeout(()=>child.kill(),1500);timeout.unref();child.once('close',()=>clearTimeout(timeout));}
}
module.exports={
  id:'android-tv',family:'tv',scope:'system-semantic',aliases:['google-tv'],
  capabilities:CAPABILITIES,
  create(options={}){return new TvSession({...options,name:'android-tv',declared:CAPABILITIES,transport:new AndroidTransport(options)});}
};
