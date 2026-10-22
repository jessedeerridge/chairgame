const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),world=fs.readFileSync(path.join(__dirname,'fixtures/navigation-world.json'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function run(code){return vm.runInNewContext(`const {buildingSites,stairways,obstacles,hidingSpots,VOTE_X,VOTE_Z}=${world};const largeBuildings=buildingSites.map(b=>({...b,doorW:13,stairs:true}));let playerHeight=0,roofRoomWalls=[],id='local',room='TEST',soloMode=true,me={x:0,z:0},state={phase:'search',players:{local:{sitting:1}},chairs:{}},button={},yaw=0,lastSync=0,lastPositionPacket='',lastPositionSent=0;const localMotionVelocity={x:0,y:0,z:0},performance={now:()=>1000},roomNow=()=>1000,resetStackIdle=()=>{},upsertChairNote=()=>{};const $=()=>button;function player(){return state.players.local}async function mutate(fn){fn(state);return{committed:true,snapshot:{val:()=>state}}}`+cut('let lastAppliedSpawn','function walletMedalIcon')+cut('function stairSurface','// One seed describes')+cut('function roofEdgeBlocked','function validChairPosition')+cut('function findStandingSpot','// Five-second hide/search')+`(async()=>{${code}})()`,{assert,console});}
test('standing at a rooftop edge stays on the roof and preserves synchronized height',()=>run(`
 const b=largeBuildings[0],level=b.h+1.2,c={x:b.x+b.w/2-1.3,z:b.z+b.d/2-1.3,y:level,occupied:id};state.chairs[1]=c;Object.assign(state.players.local,{x:c.x,z:c.z,y:level});playerHeight=level;Object.assign(me,{x:c.x,z:c.z});
 await button.onclick();const p=state.players.local;assert.equal(p.sitting,0);assert.equal(p.y,level);assert.equal(playerHeight,level);assert.equal(elevationAt(p.x,p.z),level);assert.equal(c.occupied,null);
 for(const [dx,dz] of [[-.6,-.6],[-.6,.6],[.6,-.6],[.6,.6]])assert.equal(elevationAt(p.x+dx,p.z+dz),level);
`));
test('no safe supported exit leaves the player seated rather than moving them to ground',()=>run(`
 const c={x:0,z:0,y:16.2,occupied:id};state.chairs[1]=c;state.players.local.y=16.2;playerHeight=16.2;
 occupiedAt=()=>true;await button.onclick();assert.equal(state.players.local.sitting,1);assert.equal(c.occupied,id);assert.equal(playerHeight,16.2);
`));
test('online stand applies the committed pose after delayed seating frames, without previewing transaction retries',()=>run(`
 soloMode=false;
 const c={x:10,z:10,y:0,occupied:id};state.chairs[1]=c;Object.assign(state.players.local,{x:10,z:10,y:0,spawn:{version:'old'},spawnApplied:'old'});Object.assign(me,{x:10,z:10});
 const server=JSON.parse(JSON.stringify(state));let commit;
 mutate=fn=>new Promise(resolve=>{fn(server);commit=()=>resolve({committed:true,snapshot:{val:()=>server}})});
 const pending=button.onclick();assert(relocating);assert.equal(me.x,10,'transaction changed the local pose before commit');
 me.x=c.x;me.z=c.z;commit();await pending;
 const p=server.players.local;assert.equal(p.sitting,0);assert(Math.hypot(me.x-c.x,me.z-c.z)>=2.2);
 assert.equal(me.x,p.x);assert.equal(me.z,p.z);assert.equal(state.players.local.sitting,0);assert.equal(lastAppliedSpawn,p.spawn.version);assert.notEqual(p.spawn.version,'old');assert(!relocating);
`));
test('failed online stand leaves the player on the chair and does not move the local avatar',()=>run(`
 soloMode=false;const c={x:10,z:10,y:0,occupied:id};state.chairs[1]=c;Object.assign(state.players.local,{x:10,z:10,y:0});Object.assign(me,{x:10,z:10});
 mutate=async()=>({committed:false});await button.onclick();assert.equal(state.players.local.sitting,1);assert.equal(me.x,10);assert.equal(c.occupied,id);assert(!relocating);
`));
test('two seat transitions within one clock tick still receive distinct positions',()=>run(`
 const c={x:10,z:10,y:0,occupied:id};state.chairs[1]=c;Object.assign(state.players.local,{x:10,z:10,y:0});Object.assign(me,{x:10,z:10});
 await button.onclick();const stood=lastAppliedSpawn;assert.equal(state.players.local.sitting,0);
 await button.onclick();assert.equal(state.players.local.sitting,1);assert.notEqual(lastAppliedSpawn,stood);assert.equal(me.x,c.x);assert.equal(me.z,c.z);
`));
