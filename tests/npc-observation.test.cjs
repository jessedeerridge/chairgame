const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);};
function setup(){
 const context=vm.createContext({assert});
 vm.runInContext(`function roomNow(){return Date.now()}

 let clock=1000,id='human',state=null,me=null,spotAction=null,recentHiddenChair=null,playerHeight=0;
 const performance={now:()=>clock};Date.now=()=>clock;Math.random=()=>0;
 const buildingSites=[{},{},{},{x:0,z:0,w:50,d:44}],hidingSpots=[{id:'A',x:20,z:40,type:'bush'},{id:'B',x:40,z:40,type:'tree'}],accessoryCatalog=[];
 const buttons={};const $=k=>buttons[k]??={};
 const player=()=>state.players[id],phase=()=>state.phase,closestSpot=()=>hidingSpots[0];
 const mutate=fn=>fn(state),randBetween=(a,b)=>a;
 function npcWorldBlocked(){return false}function accessibleCostumeDrop(x,z){return{x:x+2,z}}
 `+cut('function npcReturnGoal','function npcDepartureSlot')+cut('const NPC_SEARCH_OBSERVE_RADIUS','// Update decisions and local motion')+cut('function beginSpotAction',"$('moveChair').onclick")+`
 function npc(x,z){return{npc:true,x,z,y:0,rot:0,run:10,walk:5,alive:true,online:true,memory:{}}}
 function game(){state={phase:'search',round:1,deadline:100000,players:{human:{x:20,z:45,y:0,carrying:0},NPC0:npc(20,55),NPC1:npc(20,75),NPC2:npc(20,75.1)},chairs:{1:{x:20,z:40,y:0,hiddenAt:'A'}},accessories:{}};me=state.players.human;return state;}
 `,context);return code=>vm.runInContext(code,context);
}
test('completed human searches are remembered only by NPCs within 30 at completion',()=>setup()(`
 const s=game();beginSpotAction('reveal');assert(!s.spotSearchHistory,'starting is not completing');clock+=5001;updateSpotAction(clock);
 assert(s.players.NPC0.npcSearchedSpots.A);assert(s.players.NPC1.npcSearchedSpots.A);assert(!s.players.NPC2.npcSearchedSpots);
 assert.equal(s.spotSearchHistory.A.actor,'human');assert.equal(s.players.human.carrying,1);
 s.players.NPC2.z=45;assert(!s.players.NPC2.npcSearchedSpots,'walking into the area later reveals no past actions');
 s.players.NPC0.npcSpotDecisionAt=0;npcChooseSpot(s,'NPC0',s.players.NPC0,clock);assert.equal(s.players.NPC0.npcSpotSearch.spotId,'B');
`));
test('empty searches count, canceled searches and hiding do not',()=>setup()(`
 const s=game();s.chairs={};Math.random=()=>.9;beginSpotAction('reveal');clock+=2000;state.players.human.x+=2;updateSpotAction(clock);assert(!s.spotSearchHistory);
 s.players.human.x=20;beginSpotAction('reveal');clock+=5001;updateSpotAction(clock);assert(s.spotSearchHistory.A);
 s.spotSearchHistory={};for(const p of Object.values(s.players))delete p.npcSearchedSpots;
 s.players.human.carrying=2;s.chairs[2]={x:20,z:45,carrier:'human'};beginSpotAction('hide');clock+=5001;updateSpotAction(clock);
 assert.equal(s.chairs[2].hiddenAt,'A');assert.equal(Object.keys(s.spotSearchHistory).length,0);assert(!s.players.NPC0.npcSearchedSpots);
`));
test('NPC search completion informs nearby observers and cancels their pending repeat',()=>setup()(`
 const s=game(),p=s.players.NPC0;p.x=20;p.z=45;p.npcSpotSearch={spotId:'A',stage:'searching',until:1000};
 s.players.NPC1.z=50;s.players.NPC1.npcSpotSearch={spotId:'A',stage:'approach'};
 npcUpdateSpot(s,'NPC0',p,1001);assert.equal(s.spotSearchHistory.A.actor,'NPC0');assert(s.players.NPC1.npcSearchedSpots.A);
 npcUpdateSpot(s,'NPC1',s.players.NPC1,1002);assert.equal(s.players.NPC1.npcSpotSearch,null);
`));
test('gathering NPC carries its seated chair, hides for five seconds, and records no search',()=>setup()(`
 const s=game(),p=s.players.NPC0;s.phase='return';p.x=20;p.z=48;p.sitting=2;s.chairs={2:{x:20,z:48,y:0,occupied:'NPC0'}};
 assert(npcUpdateReturnHide(s,'NPC0',p,1000));assert.equal(p.sitting,0);assert.equal(p.carrying,2);assert.equal(s.chairs[2].carrier,'NPC0');
 p.x=20;p.z=45;assert(npcUpdateReturnHide(s,'NPC0',p,1100));assert.equal(p.npcSpotHide.stage,'hiding');
 assert(npcUpdateReturnHide(s,'NPC0',p,6099));assert.equal(s.chairs[2].hiddenAt,undefined);
 assert.equal(npcUpdateReturnHide(s,'NPC0',p,6100),false);assert.equal(s.chairs[2].hiddenAt,'A');assert.equal(p.carrying,0);assert(!s.spotSearchHistory);assert(!p.npcSearchedSpots);
 assert.equal(npcUpdateReturnHide(s,'NPC0',p,6200),false,'no repeated detours in this gathering');
`));
test('gathering hides respect time, reservations and existing hidden chairs',()=>setup()(`
 const s=game(),p=s.players.NPC0;s.phase='return';p.x=20;p.z=48;p.sitting=2;s.chairs[2]={x:20,z:48,occupied:'NPC0'};
 s.players.NPC1.npcSpotHide={spotId:'B'};assert.equal(npcUpdateReturnHide(s,'NPC0',p,1000),false);assert.equal(p.carrying||0,0);
 delete s.chairs[1];delete s.players.NPC1.npcSpotHide;delete p.npcHideRound;s.deadline=2000;
 assert.equal(npcUpdateReturnHide(s,'NPC0',p,1000),false,'not enough time to hide and return');
`));
test('phase changes cancel a hide and release the carrier without losing the chair',()=>setup()(`
 const s=game(),p=s.players.NPC0;s.phase='return';s.chairs={2:{x:20,z:48,occupied:'NPC0'}};p.x=20;p.z=48;p.sitting=2;
 assert(npcUpdateReturnHide(s,'NPC0',p,1000));s.phase='voteIntro';assert.equal(npcUpdateReturnHide(s,'NPC0',p,1100),false);
 assert.equal(s.chairs[2].carrier,null);assert.equal(p.carrying,0);assert.equal(p.npcSpotHide,null);assert(!s.spotSearchHistory);
`));

test('an approach that cannot make progress is canceled instead of waiting forever',()=>setup()(`
 const s=game(),p=s.players.NPC0;p.x=20;p.z=60;p.npcSpotSearch={spotId:'A',stage:'approach',until:0,startedAt:1000,progressAt:1000,anchorX:20,anchorZ:60};p.goal={x:20,z:46};
 npcUpdateSpot(s,'NPC0',p,40000);assert.equal(p.npcSpotSearch,null);assert(!s.spotSearchHistory);
`));
test('a hiding action that fits the remaining time completes without requiring another full five seconds',()=>setup()(`
 const s=game(),p=s.players.NPC0;s.phase='return';p.x=20;p.z=45;p.carrying=2;
 s.chairs={2:{x:20,z:45,carrier:'NPC0'}};p.npcSpotHide={spotId:'A',chair:2,stage:'hiding',until:6000};
 s.deadline=12000;assert(npcUpdateReturnHide(s,'NPC0',p,5000));
 assert.equal(npcUpdateReturnHide(s,'NPC0',p,6000),false);assert.equal(s.chairs[2].hiddenAt,'A');
`));
test('a failed gathering choice is retried when a hiding spot becomes available',()=>setup()(`
 const s=game(),p=s.players.NPC0;s.phase='return';p.x=20;p.z=48;p.sitting=2;
 s.chairs[2]={x:20,z:48,occupied:'NPC0'};s.players.NPC1.npcSpotHide={spotId:'B'};
 assert.equal(npcUpdateReturnHide(s,'NPC0',p,1000),false);
 delete s.chairs[1];delete s.players.NPC1.npcSpotHide;
 assert(npcUpdateReturnHide(s,'NPC0',p,3000));assert.equal(p.carrying,2);
`));
test('gathering NPC can hide an unclaimed nearby chair even after standing up',()=>setup()(`
 const s=game(),p=s.players.NPC0;s.phase='return';p.x=20;p.z=48;
 s.chairs={2:{x:21,z:48,y:0}};
 assert(npcUpdateReturnHide(s,'NPC0',p,1000));assert.equal(p.carrying,2);
`));
