const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);};
function setup(){const c=vm.createContext({assert});vm.runInContext(`function roomNow(){return Date.now()}
function lobbyParticipants(s){return Object.entries(s.players||{}).filter(([_,p])=>!p.npc&&p.online!==false)};`+cut('const SHIRT_COLORS','let playerPreloadTask'),c);return code=>vm.runInContext(code,c);}
test('12 distinct colors can be reserved; changing colors releases the previous choice',()=>setup()(`
 const s={phase:'lobby',players:{}};
 for(let i=0;i<12;i++){s.players['p'+i]={online:true,shirtColor:availableShirtColor(s,'p'+i)};assert(s.players['p'+i].shirtColor);}
 assert.equal(new Set(Object.values(s.players).map(p=>p.shirtColor)).size,12);assert.equal(availableShirtColor(s,'new'),null);
 assert(!chooseShirtColor(s,'p1',s.players.p0.shirtColor));
 s.players.p0.online=false;const released=s.players.p0.shirtColor,old=s.players.p1.shirtColor;
 assert(chooseShirtColor(s,'p1',released));assert.equal(availableShirtColor(s,'new',old),old);
 assert.equal(availableShirtColor(s,'p0',released),old,'rejoining must not duplicate a taken color');
 assert(chooseShirtColor(s,'p1',released));s.phase='search';assert(!chooseShirtColor(s,'p1',old));
`));
test('serial transaction decisions reject a concurrent claim without losing the old color',()=>setup()(`
 const s={phase:'lobby',players:{a:{online:true,shirtColor:'red'},b:{online:true,shirtColor:'blue'}}};
 assert(chooseShirtColor(s,'a','green'));assert(!chooseShirtColor(s,'b','green'));assert.equal(s.players.b.shirtColor,'blue');
 assert(!chooseShirtColor(s,'b','unknown'));
`));
test('an active participant takes over a disconnected host and keeps ownership on host reentry',()=>setup()(`
 const s={host:'a',players:{a:{name:'A',online:false,joined:1},b:{name:'B',online:true,joined:2},c:{name:'C',online:true,joined:3},NPC0:{npc:true,online:true,joined:0}}};
 assert(claimRoomHost(s));assert.equal(s.host,'b');s.players.a.online=true;assert(!claimRoomHost(s));assert.equal(s.host,'b');
`));
test('delayed online advancement keeps absolute deadlines instead of restarting timers',async()=>{
 const c=vm.createContext({assert});
 vm.runInContext(`function roomNow(){return Date.now()}
let state={phase:'search',round:1,deadline:1000,players:{a:{alive:true,sitting:1,x:0,z:0},b:{alive:true,sitting:2,x:0,z:0}},votes:{}},host=true,worldReady=true,soloMode=false;
 const SEARCH_MS=90000,RETURN_MS=40000,VOTE_INTRO_MS=7000,VOTE_MS=30000,RESULTS_MS=7000,VOTE_X=0,VOTE_Z=-7;
 Date.now=()=>50000;const phase=()=>state.phase;async function mutate(fn){fn(state)}function insideBlackBuilding(){return true}function prepareSoloNPCVotes(){}
 `+cut('function advanceState(s,now)','setInterval(advance,250);'),c);
 await vm.runInContext(`function roomNow(){return Date.now()}
advance()`,c);vm.runInContext(`function roomNow(){return Date.now()}
assert.equal(state.phase,'vote');assert.equal(state.deadline,78000);`,c);
 await vm.runInContext(`function roomNow(){return Date.now()}
advance()`,c);vm.runInContext(`function roomNow(){return Date.now()}
assert.equal(state.deadline,78000);`,c);
});
test('reentry bypasses full-room and palette checks without changing the saved outfit',()=>setup()(`
 const s={phase:'search',players:{}};for(let i=0;i<12;i++)s.players['p'+i]={online:true,initial:true,shirtColor:SHIRT_COLORS[i].id};
 s.players.p0.online=false;s.players.p0.worn={hat:'cap'};
 assert.equal(admitRoomPlayer(s,'p0','Back',100),null);assert(s.players.p0.online);assert.equal(s.players.p0.shirtColor,'red');assert.equal(s.players.p0.worn.hat,'cap');
`));
test('late admission takes only an eliminated NPC and preserves its identity references and belongings',()=>setup()(`
 const s={phase:'search',worldSeed:3,deadline:9999,players:{host:{online:true,wallet:{NPC0:5}},NPC0:{npc:true,alive:false,initial:true,x:20,z:30,worn:{hat:'cap',shirt:'star'},wallet:{NPC0:18,host:2},memory:{4:{x:11,z:12}},carrying:4},NPC1:{npc:true,alive:true}},chairs:{4:{carrier:'NPC0',x:11,z:12}},votes:{host:'NPC0'},voteEligible:{NPC0:true}};
 assert.equal(admitRoomPlayer(s,'guest','Guest',100),null);assert(!s.players.NPC0);assert(!s.players.guest.npc);assert.equal(s.players.guest.alive,false);
 assert.equal(s.players.guest.worn.shirt,'star');assert.equal(s.players.guest.bodyColor,0x4c9ec2);assert.equal(s.players.guest.wallet.guest,18);assert.equal(s.players.host.wallet.guest,5);
 assert.equal(s.chairs[4].carrier,'guest');assert.equal(s.votes.host,'guest');assert(s.voteEligible.guest);assert.equal(s.players.guest.mapData.notes[0].x,11);assert.equal(s.deadline,9999);
 assert.equal(admitRoomPlayer(s,'another','Another',101),'noNpc');assert(s.players.NPC1.npc);
`));
test('lobby admission does not replace NPCs and enforces the actual human capacity',()=>setup()(`
 const s={phase:'lobby',players:{NPC0:{npc:true,alive:false}}};assert.equal(admitRoomPlayer(s,'a','A',1),null);assert(s.players.NPC0.npc);
 for(let i=1;i<12;i++)assert.equal(admitRoomPlayer(s,'p'+i,'P',i),null);
 assert.equal(admitRoomPlayer(s,'extra','Extra',20),'full');assert(!s.players.extra);
`));
