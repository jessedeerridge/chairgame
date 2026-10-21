// Exercise the real admission handler with Firebase's initially empty transaction cache.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function cut(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);}
async function join(initial,canceled=0){
 const c=vm.createContext({assert,TextEncoder,initial,canceled,structuredClone});
 vm.runInContext(`function roomNow(){return Date.now()}

 let server=structuredClone(initial),room='',id='',soloMode=false,playerPreloadTask=null,lastAppliedSpawn=null,me={},yaw=0,playerHeight=0,state=null,host=false,worldReady=false,loadedWorldSeed=null;
 const alerts=[],buttons={join:{},name:{value:'Guest'},room:{value:'TEST'},entry:{}};const $=k=>buttons[k]??={};const document={getElementById:$},console={error(){},warn(){}};
 function database(){return {}}function ref(db,path){return {path}}async function ensureFirebase(){}async function syncRoomClock(){}function captureRemoteMotion(){}function scheduleRoomUI(){renderUI()}const remoteMotionHistory=new Map();function reconcileRoomPositions(s){return s}function initialAccessories(){return {}}
 async function runTransaction(ref,fn){
  // Like the SDK, abort immediately if a callback returns undefined for an uncached null.
  const provisional=fn(null);if(canceled>0){canceled--;return {committed:false,snapshot:{val:()=>null}};}if(provisional===undefined)return {committed:false,snapshot:{val:()=>null}};
  const next=fn(structuredClone(server));if(next===undefined)return {committed:false,snapshot:{val:()=>server}};
  server=structuredClone(next);return {committed:true,snapshot:{val:()=>structuredClone(server)}};
 }
 async function get(){return {val:()=>structuredClone(server)}}
 function onDisconnect(){return {set:async()=>{}}}async function prepareDisconnectChair(){}
 function onValue(ref,fn){fn({val:()=>structuredClone(server)});return ()=>{}}
 function recoverRoomHost(){}function applyAssignedSpawn(){}function renderUI(){}function log(){}function alert(message){alerts.push(message)}
 function lobbyParticipants(s){return Object.entries(s.players||{}).filter(([k,p])=>!p.npc&&p.online!==false)}
 `+cut('const SHIRT_COLORS','let playerPreloadTask')+cut('let roomSubscription=null','// Server-side disconnect actions'),c);
 await vm.runInContext(`function roomNow(){return Date.now()}
$('join').onclick()`,c);
 return vm.runInContext(`function roomNow(){return Date.now()}
({server,alerts,state,me})`,c);
}
test('first click creates a room and joins despite an initially empty local cache',async()=>{
 const result=await join(null);assert.equal(result.alerts.length,0,JSON.stringify(result.alerts));assert(result.server.players.U4775657374);assert.equal(result.state.phase,'lobby');
});
test('uncached admission retries against an existing room without replacing its progress',async()=>{
 const result=await join({host:'host',phase:'search',round:4,deadline:123456,players:{host:{name:'Host',online:true},U4775657374:{name:'Guest',x:42,z:80,y:0,online:false,wallet:{host:7}}},chairs:{1:{x:9,z:8}},worldSeed:45});
 assert.equal(result.alerts.length,0,JSON.stringify(result.alerts));assert.equal(result.server.round,4);assert.equal(result.server.deadline,123456);assert.equal(result.server.players.U4775657374.wallet.host,7);assert.equal(result.me.x,42);
});
test('uncached admission preserves a running room while taking an eliminated NPC',async()=>{
 const result=await join({host:'host',phase:'search',round:3,deadline:99999,players:{host:{name:'Host',online:true},NPC0:{npc:true,alive:false,x:40,z:60,y:0,worn:{hat:'cap'},wallet:{NPC0:12},memory:{}}},chairs:{},worldSeed:45});
 assert.equal(result.alerts.length,0,JSON.stringify(result.alerts));assert(!result.server.players.NPC0);assert.equal(result.server.players.U4775657374.worn.hat,'cap');assert.equal(result.server.players.U4775657374.wallet.U4775657374,12);assert.equal(result.server.deadline,99999);
});
test('server admission refusal does not replace an existing game with the provisional lobby',async()=>{
 const result=await join({host:'host',phase:'search',round:4,deadline:123456,players:{host:{name:'Host',online:true,alive:true}},chairs:{},worldSeed:45});
 assert.equal(result.alerts.length,1);assert.match(result.alerts[0],/脱落NPC/);assert.equal(result.server.phase,'search');assert.equal(result.server.round,4);assert(!result.server.players.U4775657374);
});

test('a transient canceled admission retries automatically without requiring another click',async()=>{
 const result=await join(null,1);assert.equal(result.alerts.length,0,JSON.stringify(result.alerts));assert(result.server.players.U4775657374);assert.equal(result.state.phase,'lobby');
});
