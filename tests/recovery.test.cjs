const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(){const c=vm.createContext({assert});vm.runInContext(`
 let now=100000,id='host',host=true,joiningRoom=false,soloMode=false,worldReady=true;
 const state={host:'host',phase:'erase',deadline:now+86400000,parent:'parent',players:{host:{online:true},parent:{online:false}},chairs:{1:{}}};
 function roomNow(){return now}const phase=()=>state.phase;async function mutate(fn){fn(state)}
 function chooseErase(){return '1'}function finishErase(s,n){s.phase='eraseReveal';s.lastRemoved=n;s.deadline=roomNow()+7000}
 `+cut('function roomHostAvailable','function claimRoomHost')+cut('function advanceState(s,now)','setInterval(advance,250);'),c);return code=>vm.runInContext(code,c);}
test('an absent parent cannot leave an existing room waiting for a 24-hour deadline',async()=>{
 await setup()(`(async()=>{await advance();assert.equal(state.deadline,120000);assert.equal(state.phase,'erase');now=120001;await advance();assert.equal(state.phase,'eraseReveal');assert.equal(state.lastRemoved,'1');})()`);
});
test('an online parent gets a bounded decision period, and an old host cannot advance the room',async()=>{
 await setup()(`(async()=>{state.players.parent.online=true;await advance();assert.equal(state.deadline,160000);now=160001;state.host='new-host';await advance();assert.equal(state.phase,'erase');state.host=id;await advance();assert.equal(state.phase,'eraseReveal');})()`);
});
test('joining pauses advancement until authoritative room state has been restored',async()=>{
 await setup()(`(async()=>{joiningRoom=true;await advance();assert.equal(state.deadline,86500000);assert.equal(state.phase,'erase');})()`);
});
