const {isIP} = require('node:net');
function endpoint(host,port) {
  if (typeof host !== 'string' || isIP(host)!==4 || !Number.isInteger(port) || port<1 || port>65535) throw Error('Invalid LAN endpoint');
  const [a,b]=host.split('.').map(Number);
  if (!(a===10 || (a===172 && b>=16 && b<=31) || (a===192 && b===168) || (a===169 && b===254))) throw Error('Private LAN address required');
  return {host,port};
}
function candidates(records) {
  const result=new Map();
  for (const item of records) {
    try { const e=endpoint(item.host,item.port); result.set(e.host+':'+e.port,{...e,label:String(item.label||e.host).slice(0,128)}); } catch (_) {}
  }
  return [...result.values()];
}
module.exports={endpoint,candidates};
