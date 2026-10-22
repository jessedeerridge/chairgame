const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i);return html.slice(i,j)}
function setup(){const c=vm.createContext({assert,console});vm.runInContext(`
 let joiningRoom=false,soloMode=false,room='TEST',id='me',state={phase:'instructions',players:{me:{online:true,spawn:{version:'start',x:12,z:15},spawnApplied:'start'}}},me={x:12,z:15,rot:0},playerHeight=0,lastAppliedSpawn='start',lastSync=0,relocating=false,mapUnlocked=false,mapVisitKey=null;
 const writes=[];let backendUpdate=async(target,values)=>{writes.push({target,values})},backendTransaction=async(target,fn)=>{fn(state);return {committed:true}};
 const database=()=>({}),ref=(db,path)=>path,player=()=>state.players[id],renderUI=()=>{},log=()=>{},prepareDisconnectChair=()=>{};
 function firebaseUpdate(...args){return backendUpdate(...args)}function runTransaction(...args){return backendTransaction(...args)}
 `+cut('// Use Firebase\'s server clock','const threeSources=')+cut('async function mutate(fn)','let roomSubscription='),c);return code=>vm.runInContext(code,c);}
test('position writes wait for a room transaction instead of canceling phase advancement',async()=>{
 await setup()(`(async()=>{
  let finish;backendTransaction=(target,fn)=>new Promise(resolve=>{finish=()=>{fn(state);resolve({committed:true})}});
  const change=mutate(s=>{s.phase='sitIntro'});for(let i=0;i<5;i++)await Promise.resolve();assert(finish);
  const position=update('rooms/TEST/players/me',{x:5});await Promise.resolve();assert.equal(writes.length,0);
  finish();await change;await position;assert.equal(state.phase,'sitIntro');assert.equal(writes.length,1);assert.equal(roomTransactions,0);
 })()`);
});
test('older child writes finish before a phase transaction starts, and failures release the queue',async()=>{
 await setup()(`(async()=>{
  let finishWrite,transactionStarted=false;backendUpdate=()=>new Promise(resolve=>finishWrite=resolve);
  const oldWrite=update('player',{x:1});backendTransaction=async(target,fn)=>{transactionStarted=true;throw Error('test failure')};
  const change=mutate(()=>{}).catch(()=>{});for(let i=0;i<4;i++)await Promise.resolve();assert(!transactionStarted);
  finishWrite();await oldWrite;await change;assert(transactionStarted);assert.equal(roomTransactions,0);
  backendUpdate=async()=>{};backendTransaction=async(target,fn)=>{fn(state);return{committed:true}};await mutate(s=>s.phase='search');assert.equal(state.phase,'search');
 })()`);
});
test('stationary players do not continuously write positions; movement and spawn acknowledgements do',async()=>{
 await setup()(`(async()=>{
  const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
  publishPlayerPosition(100);await settle();assert.equal(writes.length,1);
  publishPlayerPosition(200);publishPlayerPosition(1000);await settle();assert.equal(writes.length,1);
  me.x=14;publishPlayerPosition(1100);await settle();assert.equal(writes.length,2);
  roomTransactions=1;me.x=15;publishPlayerPosition(1200);await settle();assert.equal(writes.length,2);roomTransactions=0;
  publishPlayerPosition(1300);await settle();assert.equal(writes.length,3);
  state.players.me.spawnApplied='old';publishPlayerPosition(1400);await settle();assert.equal(writes.length,4);
 })()`);
});
test('unacknowledged stale coordinates cannot override an assigned spawn; acknowledged walking survives',()=>{
 setup()(`const p=state.players.me;p.x=0;p.z=0;p.spawnApplied='old';reconcileRoomPositions(state);assert.equal(p.x,12);assert.equal(p.z,15);p.spawnApplied='start';p.x=42;reconcileRoomPositions(state);assert.equal(p.x,42);`);
});
test('different device clocks resolve the same shared time and intro page',()=>{
 const run=setup();run(`Date.now=()=>200000;serverClockOffset=-100000;assert.equal(roomNow(),100000);Date.now=()=>40000;serverClockOffset=60000;assert.equal(roomNow(),100000);`);
});
test('remote motion interpolates regular NPC packets continuously and stops without drift',()=>{
 setup()(`const p={npc:true,x:0,z:0,rot:3.1,motionMoving:true};const s={started:1,players:{npc:p}};
 for(let i=0;i<8;i++){p.x=i*4.2;s.npcFrameAt=1000+i*420;captureRemoteMotion(s,s.npcFrameAt);}
 const steps=[];for(let t=3500;t<3800;t+=20){const a=remoteMotionPose('npc',p,t).x,b=remoteMotionPose('npc',p,t+20).x;steps.push(b-a)};
 assert(steps.every(step=>Math.abs(step-.2)<.001));
 p.motionMoving=false;s.npcFrameAt+=420;captureRemoteMotion(s,s.npcFrameAt);
 assert.equal(remoteMotionPose('npc',p,10000).x,p.x);assert(remoteMotionHistory.get('npc').samples.length<=8);
 `);
});
test('a first step after a long idle does not interpolate across the entire idle period',()=>{
 setup()(`const p={npc:false,x:0,z:0,rot:0,moving:false,positionAt:1000};const s={players:{other:p}};captureRemoteMotion(s,1000);
 p.x=1;p.moving=true;p.positionAt=10000;captureRemoteMotion(s,10000);
 assert.equal(remoteMotionPose('other',p,9900).x,0);
 assert(remoteMotionPose('other',p,10030).x>.4);
 p.spawn={version:'new'};p.x=80;captureRemoteMotion(s,10100);assert.equal(remoteMotionHistory.get('other').samples.length,1);
 `);
});
test('rotation takes the short turn and roof interpolation follows the stair route',()=>{
 setup()(`const p={npc:true,x:0,z:0,rot:3.1,motionMoving:true,npcRoofTrip:{active:true,building:1,travel:0}};const s={players:{other:p},npcFrameAt:1000};captureRemoteMotion(s,1000);
 p.x=4;p.rot=-3.1;p.npcRoofTrip={active:true,building:1,travel:4};s.npcFrameAt=1420;captureRemoteMotion(s,1420);
 function npcRoofVisualPoint(trip,travel){return{x:travel,y:travel*2,z:0}}
 const pose=remoteMotionPose('other',p,1575);assert(Math.abs(pose.rot-Math.PI)<.01);assert(Math.abs(pose.y-pose.x*2)<.001);
 const predicted=remoteMotionPose('other',p,2000);assert.equal(predicted.y,predicted.x*2);
 `);
});
test('the motion buffer includes measured network delay, and never rewinds on a late packet',()=>{
 setup()(`const p={npc:true,x:0,z:0,rot:0,motionMoving:true};const s={players:{other:p}};
 for(let i=0;i<8;i++){p.x=i*4.2;s.npcFrameAt=1000+i*420;captureRemoteMotion(s,s.npcFrameAt+500);}
 const track=remoteMotionHistory.get('other');assert.equal(track.lag,500);
 const a=remoteMotionPose('other',p,4400).x,b=remoteMotionPose('other',p,4420).x;assert(Math.abs(b-a-.2)<.001);
 p.x+=4.2;s.npcFrameAt+=420;captureRemoteMotion(s,s.npcFrameAt+900);
 assert(remoteMotionPose('other',p,4440).x>=b);
 `);
});

function onlineNPCSetup(){
 const c=vm.createContext({assert,console});
 vm.runInContext(`
 let room='TEST',id='host',soloMode=false,joiningRoom=false,state={host:'host',phase:'search',players:{NPC0:{npc:true,x:0}}};
 let roomTransactions=0,roomMutationQueue=Promise.resolve();
 const roomWriteWaiters=[],roomUpdateFlights=new Set(),writes=[];
 const database=()=>({}),ref=(db,path)=>path,log=()=>{},reconcileRoomPositions=s=>s,roomNow=()=>1000;
 let finish;function runTransaction(target,fn){return new Promise(resolve=>{finish=()=>{fn(state);resolve({committed:true})}})}
 async function firebaseUpdate(target,values){writes.push(values)}
 function npcSimulate(s){s.players.NPC0.x++}function npcPrepareDepartureRoutes(){}
 `+cut('async function update(target,values)','function reconcileRoomPositions')+
 cut('async function mutate(fn)','let roomSubscription=')+
 cut('async function tickOnlineNPC(dt)','setInterval(async()=>{'),c);
 return code=>vm.runInContext(code,c);
}
test('online NPC movement commits before local position writes can cancel its transaction',async()=>{
 await onlineNPCSetup()(`(async()=>{
 const tick=tickOnlineNPC(.55);for(let i=0;i<8;i++)await Promise.resolve();assert(finish);
 const position=update('player',{x:9});await Promise.resolve();assert.equal(writes.length,0);
 finish();await tick;await position;assert.equal(state.players.NPC0.x,1);assert.equal(writes.length,1);assert.equal(roomTransactions,0);
 })()`);
});
test('queued online NPC updates cannot simulate after host ownership changes',async()=>{
 await onlineNPCSetup()(`(async()=>{
 const tick=tickOnlineNPC(.55);for(let i=0;i<8;i++)await Promise.resolve();
 state.host='other';finish();await tick;assert.equal(state.players.NPC0.x,0);assert.equal(roomTransactions,0);
 })()`);
});

test('NPCs keep moving between packets even when each waypoint ends at the snapshot',()=>setup()(`
 const p={npc:true,x:0,z:0,rot:0,motionMoving:true},s={started:1,players:{npc:p}};
 let lastX=null;const steps=[];
 for(let now=1000;now<=5000;now+=20){
  if((now-1000)%280===0){s.npcFrameAt=now;p.x=(now-1000)*.005;p.waypoint={x:p.x+.1,z:0};captureRemoteMotion(s,now);}
  const x=remoteMotionPose('npc',p,now).x;
  if(now>2000)steps.push(x-lastX);lastX=x;
 }
 assert(steps.every(dx=>dx>.08&&dx<.12),'visible movement paused or accelerated at packet/waypoint boundaries');
`));
test('buffered NPC motion tolerates uneven delivery without reversing or periodic stops',()=>setup()(`
 const p={npc:true,x:0,z:0,rot:0,motionMoving:true},s={started:1,players:{npc:p}};
 let next=0,lastX=0;const steps=[];
 for(let now=1000;now<6500;now+=20){
  while(next<20&&1000+next*280+[80,160,100,140][next%4]<=now){
   const at=1000+next*280;s.npcFrameAt=at;p.x=next*1.4;captureRemoteMotion(s,now);next++;
  }
  const x=remoteMotionPose('npc',p,now).x;if(now>2200)steps.push(x-lastX);lastX=x;
 }
 assert(steps.every(dx=>dx>=0),'packet jitter moved an NPC backwards');
 assert(steps.filter(dx=>dx<.001).length<steps.length*.05,'packet jitter repeatedly stopped an NPC');
`));

test('host avatar keeps following authoritative motion without a second delayed collision check',()=>setup()(`
 state={started:1};const host=true;
 function npcStaticClearPath(){throw Error('authoritative movement was collision-tested twice')}
 function characterMovementBlocked(){throw Error('delayed avatar blocked authoritative movement')}
 const p={npc:true,x:0,z:0,rot:0,motionMoving:true},s={started:1,players:{npc:p}};
 const avatar={position:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})}},rotation:{y:0},userData:{}};
 let lastX=null;const steps=[];
 for(let now=1000;now<=5000;now+=20){
  if((now-1000)%280===0){s.npcFrameAt=now;p.x=(now-1000)*.005;p.waypoint={x:p.x+.1,z:0};captureRemoteMotion(s,now);}
  moveRemoteAvatar(avatar,'npc',p,.02,now);
  if(now>2400)steps.push(avatar.position.x-lastX);lastX=avatar.position.x;
 }
 assert(steps.every(dx=>dx>.08&&dx<.12),'host avatar repeatedly slowed or stopped between room updates');
`));
test('NPC tick cadence includes time spent waiting for the previous transaction',async()=>{
 const c=vm.createContext({assert,console});
 vm.runInContext(`
 let now=1000,room='TEST',id='host',host=true,soloMode=false,joiningRoom=false,worldReady=true,loadedWorldLayoutKey='test';function roomWorldLayoutKey(){return 'test'}
 const state={host:'host',phase:'search'},phase=()=>state.phase,roomNow=()=>now,ref=()=>{},database=()=>{},log=()=>{},reconcileRoomPositions=()=>{};
 const dts=[];function npcSimulate(s,dt){dts.push(dt)}
 async function mutate(fn){fn(state);now+=600;return{committed:true}}
 let interval;function setInterval(fn){interval=fn}
 `+cut('let npcBusy=','const modal='),c);
 await vm.runInContext(`(async()=>{await interval();await interval();assert.equal(dts.length,2);assert.equal(dts[0],.28);assert.equal(dts[1],.6)})()`,c);
});

test('a stopped NPC converges back to its true location after prediction overshoots',()=>setup()(`
 const p={npc:true,x:0,z:0,rot:0,motionMoving:false,online:true},s={started:1,npcFrameAt:1000,players:{npc:p}};state=s;
 captureRemoteMotion(s,1000);
 const avatar={position:{x:3,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})}},rotation:{y:0},userData:{smoothReady:true,motionLife:'1::true',remoteDirection:{x:1,z:0},remoteSpeed:5}};
 for(let i=0;i<100;i++)moveRemoteAvatar(avatar,'npc',p,.02,1100+i*20);
 assert(Math.abs(avatar.position.x)<.01,'stopped NPC stayed ahead of the actual chair/hiding spot');
`));
test('NPC motion broadcasts authoritative coordinates and sample time, not the delayed mesh',async()=>{
 await setup()(`const host=true,avatars={npc:{position:{x:999,y:0,z:999},rotation:{y:0}}};(async()=>{
 Date.now=()=>1050;roomTransportConnected=true;motionChannelReady=true;motionChannelRoom=room;
 state={phase:'search',started:1,npcFrameAt:1000,players:{npc:{npc:true,x:10,z:20,rot:0,online:true}}};
 flushMotionPackets(200);for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(writes.length,1);assert.equal(writes[0].values.npc.x,10);assert.equal(writes[0].values.npc.z,20);assert.equal(writes[0].values.npc.at,1000);
 })()`);
});
