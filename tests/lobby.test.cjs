const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),world=fs.readFileSync(path.join(__dirname,'fixtures/navigation-world.json'),'utf8');
function cut(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);}
function setup(){
 const c=vm.createContext({assert});
 vm.runInContext(`const {buildingSites,largeBuildings,stairways,obstacles,hidingSpots,VOTE_X,VOTE_Z}=${world};
 let roofRoomWalls=[],playerHeight=0,me={x:0,z:12,rot:0},yaw=0,lastSync=0,clock=0;const performance={now:()=>clock};
 let id='local',room='TEST',soloMode=false,state=null,host=true,worldReady=true;
 const button={hidden:true,disabled:false,addEventListener(){}};const $=()=>button;
 const TOTAL_PLAYERS=20,personalities=['慎重型'];const randBetween=(a,b)=>(a+b)/2;const seedChairs=()=>({});
 function player(){return state?.players?.[id]}async function mutate(fn){fn(state)}
 `+cut('function roofEdgeBlocked','function occupiedAt')+cut('function insideBlackBuilding','function canCastVote')+cut('function isOnlineLobby','let playerPreloadTask')+cut('let lastAppliedSpawn','function walletMedalIcon')+cut('function initRound','function indoorSpawn')+cut('function indoorSpawn',"$('start').onclick")+cut('let stackIdle','let _opaqueRoofConfigured')+`
 function human(name,ready=true){return {name,npc:false,online:true,worldReady:ready,x:0,z:12,alive:false,initial:false,wallet:{}}}
 function lobby(){state={host:id,phase:'lobby',round:0,players:{local:human('Host'),guest:human('Guest')},chairs:{},votes:{}};return state;}
 `,c);
 return code=>vm.runInContext(code,c);
}
test('all humans and NPCs start at distinct clear locations, replacing stale NPCs',()=>setup()(`
 const s=lobby();s.players.NPC99={npc:true,online:true,x:0,z:12};beginGame(s);assert.equal(s.phase,'instructions');assert(!s.players.NPC99);
 const players=Object.values(s.players);assert.equal(players.length,20);for(let i=0;i<players.length;i++){
  assert(!staticBlocked(players[i].x,players[i].z,1));assert.equal(players[i].spawn.x,players[i].x);assert.equal(players[i].spawn.z,players[i].z);
  for(let j=i+1;j<players.length;j++)assert(Math.hypot(players[i].x-players[j].x,players[i].z-players[j].z)>=2.2);
 }
`));
test('host starts immediately while everyone is still loading',()=>setup()(`
 const s=lobby();worldReady=false;for(const p of Object.values(s.players))p.worldReady=false;
 beginGame(s);assert.equal(s.phase,'instructions');assert.equal(Object.keys(s.players).length,20);assert(s.worldPreparing);
`));
test('solo mode still begins its introduction without waiting for online readiness',()=>setup()(`
 const s=lobby();soloMode=true;s.players={local:human('Solo',false)};worldReady=false;beginGame(s);assert.equal(s.phase,'instructions');assert(s.worldPreparing);
`));
test('larger groups get unique slots; a full room never wraps onto occupied slots',()=>setup()(`
 const slots=allocateIndoorSpawns(30);assert.equal(slots.length,30);
 for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)assert(Math.hypot(slots[i].x-slots[j].x,slots[i].z-slots[j].z)>=2.2);
 assert.equal(allocateIndoorSpawns(3000),null);
`));
test('immutable assignment wins over stale coordinates, but does not reset ordinary walking',()=>setup()(`
 const s=lobby();s.players.local.spawn={version:'start:1',x:14,z:15.6,rot:Math.PI};applyAssignedSpawn(s);assert.equal(me.x,14);assert.equal(me.z,15.6);
 me.x=15;s.players.local.x=0;s.players.local.z=12;applyAssignedSpawn(s);assert.equal(me.x,15,'ordinary updates reapplied the initial spawn');
 s.players.local.spawn={version:'stack:2',x:-10,z:10,rot:Math.PI};applyAssignedSpawn(s);assert.equal(me.x,-10);assert.equal(me.z,10);
`));
test('stack button appears after six stationary seconds, resets on motion, and stays inside the black room',()=>setup()(`
 const s=lobby();s.phase='instructions';resetStackIdle(0);updateStackButton(5999);assert(button.hidden);updateStackButton(6000);assert(!button.hidden);
 me.x+=.2;updateStackButton(6100);assert(button.hidden);updateStackButton(12100);assert(!button.hidden);
 me.x=40;updateStackButton(13000);assert(button.hidden);me.x=0;s.players.local.sitting=1;updateStackButton(20000);assert(button.hidden);
`));
test('stack relocates to an empty indoor position without overlapping players or chairs',async()=>{
 const run=setup();await run(`(async()=>{
  const s=lobby();s.phase='instructions';s.players.local.x=me.x;s.players.local.z=me.z;s.players.NPC0={npc:true,x:0,z:12,online:true};s.chairs={1:{x:3,z:12}};
  clock=6001;resetStackIdle(0);updateStackButton(clock);assert(!button.hidden);await button.onclick({stopPropagation(){}});
  assert(Math.hypot(me.x,me.z-12)>2.2);assert(indoorPositionFree(s,id,me));assert(button.hidden);assert(!relocating);
 })()`);
});

test('reconnection preserves saved walking coordinates after the initial assignment was acknowledged',()=>setup()(`
 const s=lobby();s.phase='search';s.players.local.spawn={version:'start:1',x:14,z:15.6,rot:Math.PI};s.players.local.spawnApplied='start:1';
 me.x=100;me.z=80;applyAssignedSpawn(s);assert.equal(me.x,100);assert.equal(me.z,80);assert.equal(lastAppliedSpawn,'start:1');
`));
