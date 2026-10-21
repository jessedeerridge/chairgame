// Run with: node --test tests/navigation.test.cjs
// The fixture is ground collision metadata captured from the actual rendered map.
// Refresh it if the map geometry changes; no browser or network is needed here.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const world=fs.readFileSync(path.join(__dirname,'fixtures/navigation-world.json'),'utf8');
const cut=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);};
function setup(){
 const c=vm.createContext({performance,assert,console});
 vm.runInContext(`const {obstacles,hidingSpots,buildingSites,stairways,largeBuildings,VOTE_X,VOTE_Z}=${world};
 let roofRoomWalls=[],playerHeight=0,state=null,soloMode=false,room='TEST',id='local',me={x:150,z:150};
 let randomSeed=123456;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
 function randBetween(a,b){return a+(b-a)*Math.random()}
 function insideBlackBuilding(x,z){return Math.abs(x)<23.8&&Math.abs(z)<20.8}
 function npcTryCostume(){}function npcChooseSpot(){}function npcUpdateSpot(){return false}
 function accessibleCostumeDrop(x,z){return{x:x+2,z:z+2}}
 function canCastVote(){return false}function chooseNPCVote(){}
 const SEARCH_MS=90000,VOTE_MS=30000,accessoryCatalog=[];
 `+cut('function roofEdgeBlocked','function occupiedAt')+cut('// Spatial buckets','// NPC hide-spot inspection')+cut('function npcDecision','// NPCs try to collect')+cut('const NPC_SEARCH_OBSERVE_RADIUS','// Update decisions and local motion')+cut('function npcSimulate','let npcBusy='),c);
 vm.runInContext(`
 function game(players={},phase='search'){state={phase,round:1,deadline:1000000,players,chairs:{},votes:{},accessories:{}};return state;}
 function npc(x,z,goal){return {npc:true,alive:false,initialDispersed:true,departureDone:true,searchIntentRound:1,searchIntent:true,x,z,goal,walk:5,run:9,decisionAt:1e9,npcSpotDecisionAt:1e9,memory:{}};}
 function safe(p){if(!npcWorldBlocked(state||{phase:'search'},p.x,p.z,1))return p;for(let r=1;r<15;r++)for(let i=0;i<24;i++){const q={x:p.x+Math.sin(i*Math.PI/12)*r,z:p.z+Math.cos(i*Math.PI/12)*r};if(!npcWorldBlocked(state||{phase:'search'},q.x,q.z,1))return q;}throw Error('fixture has no nearby free point');}
 function solve(s,p,goal){npcNavDeadline=Infinity;npcNavNodesLeft=Infinity;const job=npcCreateSearch(s,p,goal);while(!job.done)npcAdvanceSearch(s,job,512);return job;}
 function simulate(s,ticks,dt=.28){const times=[];for(let i=0;i<ticks;i++){
  const before=Object.values(s.players).map(p=>({x:p.x,z:p.z})),start=performance.now();npcSimulate(s,dt,10000+i*dt*1000);times.push(performance.now()-start);
  assert(npcNavNodesLeft>=0,'global node budget exceeded');
  for(const [j,p] of Object.values(s.players).entries())assert(npcStaticClearPath(s,before[j].x,before[j].z,p.x,p.z,.65),'NPC crossed terrain in a tick');
 }return times;}
 `,c);
 return code=>vm.runInContext(code,c);
}
test('19 NPCs leave the actual building and all reach separate outdoor goals',()=>setup()(`
 const s=game(),goals=[];for(let i=0;i<19;i++){const goal=safe({x:(i%5-2)*7,z:65+Math.floor(i/5)*4.2});goals.push(goal);s.players['NPC'+i]=npc((i%5-2)*7,3+Math.floor(i/5)*4.2,goal);}
 const times=simulate(s,180);for(const [i,p] of Object.values(s.players).entries())assert(Math.hypot(p.x-goals[i].x,p.z-goals[i].z)<3,'NPC'+i+' failed to exit and arrive');
 times.sort((a,b)=>a-b);console.log('exit19 tick p95/max (ms):',times[Math.floor(times.length*.95)].toFixed(2),times.at(-1).toFixed(2));
`));
test('19 returning NPCs walk beyond the doorway to their own indoor positions',()=>setup()(`
 const s=game({},'return');for(let i=0;i<19;i++){const p=safe({x:(i%5-2)*7,z:40+Math.floor(i/5)*4.2});s.players['NPC'+i]=npc(p.x,p.z,null);}
 simulate(s,180);for(const [k,p] of Object.entries(s.players)){const goal=npcReturnGoal(k);assert(p.returned,k+' did not return');assert(Math.hypot(p.x-goal.x,p.z-goal.z)<1.5,k+' stopped at the doorway');}
`));
test('static plans go around building walls, trees, bushes and opened door leaves',()=>setup()(`
 const s=game(),tree=obstacles.find(o=>o.r===.85&&Math.hypot(o.x,o.z)<150),bush=hidingSpots.find(o=>o.type==='bush');
 for(const [start,end] of [[{x:0,z:-40},{x:0,z:14}],[{x:0,z:10},{x:40,z:40}],[{x:tree.x-5,z:tree.z},{x:tree.x+5,z:tree.z}],[{x:bush.x-9,z:bush.z},{x:bush.x+9,z:bush.z}]]){
  const a=safe(start),b=safe(end),job=solve(s,a,b);assert(job.path.length,'no route');let previous=a;
  for(const q of job.path){assert(npcStaticClearPath(s,previous.x,previous.z,q.x,q.z,.7),'invalid route edge');previous=q;}
  assert(Math.hypot(previous.x-b.x,previous.z-b.z)<.01,'incomplete route');
 }
`));
test('sweeps detect a wall even when both endpoints are free and agree near door corners',()=>setup()(`
 const s=game();assert(!npcStaticClearPath(s,-30,0,-20,0),'wall tunnelling');
 for(let i=0;i<1000;i++){
  const a={x:4+Math.random()*7,z:14+Math.random()*11},b={x:Math.random()*6,z:24+Math.random()*20};
  if(!npcStaticClearPath(s,a.x,a.z,b.x,b.z,.78))continue;
  for(let j=1;j<=12;j++){const t=j/12;assert(npcStaticClearPath(s,a.x,a.z,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.78),'long and short sweeps disagree');}
 }
`));
test('a stationary human and an intervening chair are bypassed without replanning terrain',()=>setup()(`
 const p=npc(-6,35,{x:6,z:35}),s=game({NPC0:p,human:{x:0,z:35,online:true}});s.chairs={1:{x:3,z:35}};
 simulate(s,100);assert(Math.hypot(p.x-6,p.z-35)<3,'failed to bypass player/chair');
 const nav=npcNavigation.get(room+':NPC0');assert(!nav||!nav.job,'a person caused a terrain replan');
`));
test('two opposing NPCs pass each other; coincident spawns can separate',()=>setup()(`
 let s=game({NPC0:npc(-6,35,{x:6,z:35}),NPC1:npc(6,35,{x:-6,z:35})});simulate(s,100);
 assert(s.players.NPC0.x>3&&s.players.NPC1.x< -3,'opposing NPCs deadlocked');
 room='OVERLAP';s=game({NPC0:npc(0,35,{x:8,z:35}),NPC1:npc(0,35,{x:-8,z:35})});simulate(s,100);
 assert(s.players.NPC0.x>4&&s.players.NPC1.x< -4,'overlapping spawns remained stuck');
`));
test('blocked goals fail immediately, enclosed goals are bounded and retries back off',()=>setup()(`
 const s=game(),bush=hidingSpots.find(o=>o.type==='bush'),p=npc(0,35,{x:bush.x,z:bush.z});s.players.NPC0=p;
 const job=solve(s,p,p.goal);assert(job.done&&job.path.length===0&&job.visited===0,'blocked goal searched the whole island');
 npcNavDeadline=Infinity;npcNavNodesLeft=Infinity;npcNavigationTarget(s,'NPC0',p,10000);
 const nav=npcNavigation.get(room+':NPC0'),retry=nav.retryAt;assert(retry>=12000,'no backoff');
 npcNavigationTarget(s,'NPC0',p,11000);assert.equal(nav.retryAt,retry,'unnecessary retry');
`));
test('valid chair intentions are retained and invalid ones are replaced',()=>setup()(`
 const p=npc(0,35,{x:0,z:65}),s=game({NPC0:p});p.alive=true;p.targetChair='1';p.decisionAt=0;
 s.chairs={1:{x:0,z:65},2:{x:10,z:65}};for(let i=0;i<20;i++)npcDecision(s,'NPC0',p,10000+i*5000);
 assert.equal(p.targetChair,'1','random periodic retarget');s.chairs[1].occupied='other';p.decisionAt=0;npcDecision(s,'NPC0',p,200000);assert.equal(p.targetChair,'2');
`));
test('850 ms host ticks also sweep movement rather than crossing walls or people',()=>setup()(`
 const s=game({NPC0:npc(0,10,{x:35,z:35}),human:{x:0,z:25,online:true}});delete s.players.human.npc;
 // simulate only NPC motion; the static human has no NPC state.
 for(let i=0;i<70;i++){const p=s.players.NPC0,a={x:p.x,z:p.z};npcSimulate(s,.85,10000+i*850);assert(npcStaticClearPath(s,a.x,a.z,p.x,p.z,.65));assert(Math.hypot(p.x,p.z-25)>=1.34);}
 assert(Math.hypot(s.players.NPC0.x-35,s.players.NPC0.z-35)<3,'long-tick NPC failed to arrive');
`));

test('hide-spot approach enters searching without clearing its goal too early',()=>setup()(`
 const s=game(),spot=hidingSpots.find(o=>o.type==='bush'),start=safe({x:spot.x+8,z:spot.z});
 const p=npc(start.x,start.z,null);s.players.NPC0=p;p.npcSpotSearch={spotId:spot.id,stage:'approach',until:0};p.goal=npcSpotApproachGoal(s,p,spot);
 assert(p.goal,'no approach point');let searched=false;
 for(let i=0;i<50;i++){npcSimulate(s,.28,10000+i*280);if(p.npcSpotSearch?.stage==='searching'){searched=true;break;}}
 assert(searched,'NPC stopped outside the search radius or lost its goal');assert(Math.hypot(p.x-spot.x,p.z-spot.z)<5.5);
`));
test('incremental work stays bounded even when the goal is enclosed',()=>setup()(`
 const center=safe({x:0,z:120});for(const o of [{x:center.x-6,z:center.z,halfX:.3,halfZ:6},{x:center.x+6,z:center.z,halfX:.3,halfZ:6},{x:center.x,z:center.z-6,halfX:6,halfZ:.3},{x:center.x,z:center.z+6,halfX:6,halfZ:.3}])obstacles.push(o);
 npcCollisionIndex=null;npcTerrainGrid=null;const s=game(),start=safe({x:center.x,z:center.z-12}),job=npcCreateSearch(s,start,center);
 npcNavDeadline=Infinity;npcNavNodesLeft=64;npcAdvanceSearch(s,job,16000);assert(job.visited<=64&&!job.done,'work was not split');
 npcNavNodesLeft=Infinity;while(!job.done)npcAdvanceSearch(s,job,512);assert(job.visited<=16000&&job.path.length===0,'enclosed goal search was unbounded');
`));
test('a human entering an existing route is avoided without discarding the static route',()=>setup()(`
 const p=npc(-8,35,{x:8,z:35}),s=game({NPC0:p});npcSimulate(s,.28,10000);const route=npcNavigation.get(room+':NPC0');
 s.players.human={x:p.x+2,z:p.z,online:true};for(let i=1;i<80;i++){npcSimulate(s,.28,10000+i*280);assert(Math.hypot(p.x-s.players.human.x,p.z-s.players.human.z)>=1.34);}
 assert(p.x>5,'NPC failed to pass the intervening player');assert(!npcNavigation.has(room+':NPC0')||npcNavigation.get(room+':NPC0')===route,'human movement caused global replanning');
`));

test('a seated NPC hides its chair during gathering and then reaches its indoor destination',()=>setup()(`
 const s=game({},'return');s.deadline=50000;
 const spot=hidingSpots.find(q=>Math.hypot(q.x,q.z)<120&&Math.hypot(q.x,q.z)>65&&q.z>55);
 assert(spot);const start=safe({x:spot.x*1.08,z:spot.z*1.08}),p=npc(start.x,start.z,null);p.sitting=2;s.players.NPC0=p;
 s.chairs={2:{x:p.x,z:p.z,y:0,occupied:'NPC0'}};
 npcSimulate(s,.28,10000);assert(p.carrying===2||s.chairs[2].hiddenAt,'NPC never picked up its chair');
 simulate(s,220);assert(s.chairs[2].hiddenAt,'NPC did not hide its chair');assert.equal(s.chairs[2].carrier,null);assert.equal(p.carrying,0);
 assert(p.returned,'NPC did not finish returning after hiding');assert(!s.spotSearchHistory,'hiding created a search history');
`));

test('screen-side boundary blocks both ground navigation and swept NPC movement',()=>setup()(`
 obstacles.push(screenBarrierShape());const s=game();
 assert(!npcWorldBlocked(s,20,-15,.7));assert(npcWorldBlocked(s,20,-18,.7));
 assert(!npcStaticClearPath(s,20,-15,20,-20,.7));
`));
