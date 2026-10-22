const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i);return html.slice(i,j)}
function start(){const c=vm.createContext({assert,structuredClone});vm.runInContext(`
 let soloMode=false,id='host',state={host:'host',phase:'lobby',worldSeed:1,players:{host:{name:'Host',online:true}}};
 const alerts=[],buttons={};const $=k=>buttons[k]??={};const alert=s=>alerts.push(s),applyAssignedSpawn=()=>{};
 const lobbyParticipants=s=>Object.entries(s.players||{}).filter(([k,p])=>!p.npc&&p.online!==false);
 const TOTAL_PLAYERS=2,WORLD_LAYOUT_VERSION=2,worldReady=true,loadedWorldSeed=1;
 const roomNow=()=>1000,allocateIndoorSpawns=n=>Array.from({length:n},(_,i)=>({x:i*4,z:10})),npcBalancedRoster=n=>Array.from({length:n},(_,i)=>i);
 const createNPC=(s,k,i,p)=>({npc:true,...p,trust:{}}),availableShirtColor=()=> 'red',randBetween=()=>.5;
 const makeWorldLayout=seed=>({seed,chairs:{}}),initRound=s=>{s.round++;s.phase='sitIntro'};
 async function mutate(fn){fn(state)}
 `+cut('function onlineStartAllowed','// Core cast')+cut("$('start').onclick=","$('touch').onclick="),c);return code=>vm.runInContext(code,c)}
test('one ordinary online human sees the exact refusal message without starting',async()=>start()(`(async()=>{await buttons.start.onclick();assert.deepEqual(alerts,['2人以上いません']);assert.equal(state.phase,'lobby');assert(!state.started)})()`));
test('offline humans and NPCs do not satisfy the two-player minimum',async()=>start()(`(async()=>{state.players.gone={online:false};state.players.bot={npc:true,online:true};await buttons.start.onclick();assert.equal(alerts[0],'2人以上いません');assert.equal(state.phase,'lobby')})()`));
test('two online humans can start',()=>start()(`state.players.guest={name:'Guest',online:true};assert.equal(beginGame(state),undefined);assert.equal(state.phase,'instructions');`));
test('exact host name じぇしー can start alone and resets a previous skip',()=>start()(`state.players.host.name='じぇしー';state.introSkipped=true;beginGame(state);assert.equal(state.phase,'instructions');assert.equal(state.introSkipped,false);`));
test('solo practice still starts alone',()=>start()(`soloMode=true;beginGame(state);assert.equal(state.phase,'instructions');`));
function skip(){const c=vm.createContext({assert});vm.runInContext(`
 let soloMode=true,id='host',host=true,worldReady=true,joiningRoom=false,now=1000;
 const state={host:'host',phase:'instructions',introStarted:1000,deadline:55000,players:{host:{online:true}},introSkipped:false};
 const phase=()=>state.phase,roomNow=()=>now,introParticipantsReady=s=>!!s.introSkipped;
 const SEARCH_MS=90000;async function mutate(fn){fn(state)}
 function advanceState(s,t){if(s.phase==='instructions'){s.phase='sitIntro';s.deadline=t+3000}else if(s.phase==='sitIntro'){s.phase='search';s.deadline=t+90000}}
 const buttons={},$=k=>buttons[k]??={},introSkipDialog={hidden:false};let introPlayback=null;const introSessionKey=()=> 'intro',saveIntroPlayback=()=>{};
 `+cut('let advancing=false;','setInterval(advance,250);')+cut("$('introSkipYes').onclick=","$('touch').onclick=()=>{if(phase()==='instructions'"),c);return code=>vm.runInContext(code,c)}
test('confirmed solo skip immediately enters seating instead of waiting for the original deadline',async()=>skip()(`(async()=>{await buttons.introSkipYes.onclick();for(let i=0;i<8;i++)await Promise.resolve();assert.equal(state.phase,'sitIntro');assert.equal(state.deadline,4000)})()`));
test('online guest skip is shared and the host advances to seating',async()=>skip()(`(async()=>{soloMode=false;host=false;await buttons.introSkipYes.onclick();assert(state.introSkipped);host=true;await advance();assert.equal(state.phase,'sitIntro')})()`));
test('skip waits for world readiness and then advances without another skip',async()=>skip()(`(async()=>{worldReady=false;await buttons.introSkipYes.onclick();assert.equal(state.phase,'instructions');worldReady=true;await advance();assert.equal(state.phase,'sitIntro')})()`));
