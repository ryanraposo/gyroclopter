const {EventEmitter}=require('node:events');
const {FocusTranslator}=require('./focus');
const {capabilities,action,negotiate}=require('./contract');
class TvSession extends EventEmitter {
  constructor({name,declared,transport,onAvailability=()=>{},onError=()=>{},now=Date.now}) {
    super();
    Object.assign(this,{name,declared,transport,onAvailability,onError,now,available:false,observed:[],closed:false,pressed:false,lastAction:-Infinity});
    this.focus=new FocusTranslator({now});
    this.handlers={
      ready: observed=>{if(this.closed)return; this.reset(); this.observed=negotiate(this.declared,observed);this.available=this.observed.length>0;this.changed();},
      unavailable:()=>this.unavailable(),
      error:()=>{this.unavailable();this.onError({code:'TV_TRANSPORT_ERROR',message:'TV transport failed; check pairing and connection.'});}
    };
    for(const [event,fn] of Object.entries(this.handlers)) transport.on(event,fn);
  }
  reset(){this.pressed=false;this.focus.reset();this.lastAction=-Infinity;}
  snapshot(){return {version:1,name:this.name,available:this.available,capabilities:[...this.observed]};}
  changed(){this.onAvailability(this.available);this.emit('capabilities',this.snapshot());}
  unavailable(){if(this.closed)return;this.reset();this.available=false;this.observed=[];this.changed();}
  sendAction(value){
    const a=action(value);
    if(!a||!this.available||this.closed||!this.observed.includes(capabilities[a.type]))return false;
    const t=this.now();
    if(!['move','down','up'].includes(a.type)){if(t-this.lastAction<70)return false;this.lastAction=t;}
    try{if(this.transport.send(a)===false){this.unavailable();return false;}return true;}catch(_){this.handlers.error();return false;}
  }
  sendCommand(command){
    if(!this.available||this.closed||typeof command!=='string')return;
    const [type,x,y,...rest]=command.split(' ');
    if(rest.length)return;
    const pointer=this.observed.includes('pointer.relative');
    if(type==='MOVE'&&x!==undefined&&y!==undefined){
      const a=action({type:'move',dx:Number(x),dy:Number(y)});
      if(!a)return;
      if(pointer)this.sendAction(a);else if(!this.pressed&&this.observed.includes('focus.directional')){const f=this.focus.move(a.dx,a.dy);if(f)this.sendAction(f);}
    }else if(type==='LEFT_DOWN'&&x===undefined&&!this.pressed){
      this.pressed=true;this.focus.reset();if(pointer)this.sendAction({type:'down'});
    }else if(type==='LEFT_UP'&&x===undefined&&this.pressed){
      this.pressed=false;this.focus.reset();this.sendAction({type:pointer?'up':'select'});
    }else if(type==='CLICK_RIGHT'&&x===undefined)this.sendAction({type:pointer?'right':'back'});
    else if(type==='SCROLL'&&x!==undefined&&y===undefined&&pointer)this.sendAction({type:'scroll',delta:Number(x)});
  }
  cancelInput(){if(this.pressed&&this.observed.includes('pointer.relative'))this.sendAction({type:'up'});this.reset();}
  dispose(){if(this.closed)return;this.cancelInput();this.unavailable();this.closed=true;for(const [event,fn] of Object.entries(this.handlers))this.transport.removeListener(event,fn);this.transport.close();}
}
module.exports={TvSession};
