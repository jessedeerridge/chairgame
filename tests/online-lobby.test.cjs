const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);};
function setup(){const c=vm.createContext({assert});vm.runInContext(`function lobbyParticipants(s){return Object.entries(s.players||{}).filter(([_,p])=>!p.npc&&p.online!==false)};`+cut('const SHIRT_COLORS','let playerPreloadTask'),c);return code=>vm.runInContext(code,c);}
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
 vm.runInContext(`let state={phase:'search',round:1,deadline:1000,players:{a:{alive:true,sitting:1,x:0,z:0},b:{alive:true,sitting:2,x:0,z:0}},votes:{}},host=true,worldReady=true,soloMode=false;
 const SEARCH_MS=90000,RETURN_MS=40000,VOTE_INTRO_MS=7000,VOTE_MS=30000,RESULTS_MS=7000,VOTE_X=0,VOTE_Z=-7;
 Date.now=()=>50000;const phase=()=>state.phase;async function mutate(fn){fn(state)}function insideBlackBuilding(){return true}function prepareSoloNPCVotes(){}
 `+cut('function advanceState(s,now)','setInterval(advance,700);'),c);
 await vm.runInContext(`advance()`,c);vm.runInContext(`assert.equal(state.phase,'vote');assert.equal(state.deadline,78000);`,c);
 await vm.runInContext(`advance()`,c);vm.runInContext(`assert.equal(state.deadline,78000);`,c);
});
