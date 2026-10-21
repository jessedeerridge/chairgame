const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i);return html.slice(i,j)}
function setup(){const c=vm.createContext({assert,console});vm.runInContext(`
 let soloMode=false,room='TEST',id='me',state={phase:'instructions',players:{me:{online:true,spawn:{version:'start',x:12,z:15},spawnApplied:'start'}}},me={x:12,z:15,rot:0},playerHeight=0,lastAppliedSpawn='start',lastSync=0,relocating=false,mapUnlocked=false,mapVisitKey=null;
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
