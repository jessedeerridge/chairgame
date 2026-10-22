const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(){const c=vm.createContext({assert});vm.runInContext(`function roomNow(){return Date.now()}
let host=true,joiningRoom=false,worldReady=true,soloMode=true,id='me',me={x:0,z:0},state=null;const VOTE_X=0,VOTE_Z=-7,VOTE_MS=30000,RESULTS_MS=7000,RETURN_MS=40000,VOTE_INTRO_MS=7000,SEARCH_MS=90000;const button={},confirm={disabled:false},target={value:'candidate'},$=key=>key==='voteTarget'?target:key==='modalConfirm'?confirm:button;let modalMode='voteButtons',selectedVoteCandidate='candidate';const modal={classList:{remove(){}}};function phase(){return state.phase}function log(){}function syncGiftInteraction(){return true}function closeVoteWhenEnded(){}function alert(message){throw Error(message)};
 function insideBlackBuilding(x,z){return Math.abs(x)<23.8&&Math.abs(z)<20.8}function canCastVote(s,k){return s.phase==='vote'&&s.voteEligible?.[k]===true}function npcPrepareNextRoundTargets(){}function chooseNPCVote(){return 'candidate'}function mutate(fn){fn(state)}
 `+cut('function prepareSoloNPCVotes','let advancing=false;')+cut('let advancing=false;','setInterval(advance,250);')+cut("$('vote').onclick=",'function finishErase')+cut("$('modalConfirm').onclick=async()=>",'// Action buttons are refreshed')+`
 function game(){state={phase:'voteIntro',round:2,deadline:1000,players:{me:{x:0,z:0,alive:true},candidate:{x:0,z:0,alive:true},willing:{npc:true,x:0,z:0,voteIntent:true},abstain:{npc:true,x:0,z:0,voteIntent:false},outside:{npc:true,x:100,z:100,voteIntent:true},offline:{npc:true,x:0,z:0,online:false}},votes:{}};return state;}
 `,c);return code=>vm.runInContext(code,c);}
test('solo NPCs with voting intent and eligibility vote before the human, exactly once',()=>setup()(`
 const s=game();advanceState(s,1000);assert.equal(s.phase,'vote');assert.equal(s.votes.willing,'candidate');assert(s.players.willing.voted);
 assert(!s.votes.abstain&&!s.votes.outside&&!s.votes.offline&&!s.votes.me);s.players.abstain.voteIntent=true;prepareSoloNPCVotes(s);assert(!s.votes.abstain,'late intention added a vote after preparation');
`));
test('solo human confirmation immediately counts pre-cast NPC votes and opens results',()=>setup()(`
 const s=game();advanceState(s,1000);button.onclick();assert.equal(s.phase,'results');assert.equal(s.voteCounts.candidate,2);assert.equal(s.parent,'candidate');assert(s.players.me.voted);
`));
test('an invalid vote cannot shorten the solo vote timer',()=>setup()(`
 const s=game();advanceState(s,1000);target.value='missing';button.onclick();assert.equal(s.phase,'vote');assert.equal(s.deadline,31000);assert(!s.votes.me);
`));
test('online voting keeps the normal timer and does not pre-cast NPC votes',()=>setup()(`
 soloMode=false;const s=game();advanceState(s,1000);assert.equal(s.phase,'vote');assert(!s.votes.willing);button.onclick();assert.equal(s.phase,'vote');assert.equal(s.deadline,31000);advanceState(s,31000);assert.equal(s.phase,'results');assert.equal(s.voteCounts.candidate,1);
`));

test('the visible vote dialog confirmation also ends solo voting immediately',async()=>{
 const run=setup();await run(`(async()=>{const s=game();advanceState(s,1000);await confirm.onclick();assert.equal(s.phase,'results');assert.equal(s.voteCounts.candidate,2);assert.equal(confirm.disabled,false);})()`);
});

test('solo return ends early when everyone is back, including eliminated NPCs',async()=>setup()(`(async()=>{
 Date.now=()=>1000;const s=game();s.phase='return';s.deadline=50000;s.chairs={};
 for(const p of Object.values(s.players)){if(p.online!==false){p.x=0;p.z=15;p.returned=true}}
 await advance();assert.equal(s.phase,'voteIntro');assert.equal(s.deadline,8000);assert(s.players.willing.returned,'a returned NPC was sent out again');
})()`));
test('solo return waits for an outside player and pending NPC hiding',async()=>setup()(`(async()=>{
 Date.now=()=>1000;const s=game();s.phase='return';s.deadline=50000;
 for(const p of Object.values(s.players)){p.x=0;p.z=0;p.returned=true}
 s.players.me.x=100;await advance();assert.equal(s.phase,'return');
 s.players.me.x=0;s.players.willing.carrying=7;await advance();assert.equal(s.phase,'return');
 s.players.willing.carrying=0;s.players.willing.npcSpotHide={stage:'hiding'};await advance();assert.equal(s.phase,'return');
 s.players.willing.npcSpotHide=null;await advance();assert.equal(s.phase,'voteIntro');
})()`));
test('solo human voting waits beyond the old time limit even with no NPC votes',async()=>setup()(`(async()=>{
 const s=game();s.players.willing.voteIntent=false;advanceState(s,1000);assert.equal(s.phase,'vote');
 Date.now=()=>100000;await advance();assert.equal(s.phase,'vote');assert(!s.votes.willing);
 advanceState(s,100000);assert.equal(s.phase,'vote','direct advancement ignored the human wait');
 button.onclick();assert.equal(s.phase,'results');assert.equal(s.voteCounts.candidate,1);
})()`));
test('human automatic abstention immediately counts only eligible willing NPC votes',()=>setup()(`
 const s=game();s.players.me.x=100;advanceState(s,1000);
 assert.equal(s.phase,'results');assert.equal(s.voteCounts.candidate,1);assert.equal(s.votes.willing,'candidate');
 assert(!s.votes.me&&!s.votes.abstain&&!s.votes.outside&&!s.votes.offline);
`));
test('explicit human voting abstention also ends without a countdown',()=>setup()(`
 const s=game();s.players.me.voteIntent=false;advanceState(s,1000);
 assert.equal(s.phase,'results');assert.equal(s.voteCounts.candidate,1);assert(!s.votes.me);
`));
test('online return does not end early just because everyone has returned',async()=>setup()(`(async()=>{
 soloMode=false;Date.now=()=>1000;const s=game();s.host=id;s.phase='return';s.deadline=50000;
 for(const p of Object.values(s.players)){p.x=0;p.z=0;p.returned=true}
 await advance();assert.equal(s.phase,'return');
})()`));
test('human abstention with no willing NPCs finishes without inventing votes',()=>setup()(`
 const s=game();s.players.me.x=100;s.players.willing.voteIntent=false;advanceState(s,1000);
 assert.equal(s.phase,'results');assert.equal(Object.keys(s.votes).length,0);assert.equal(s.parent,null);assert(s.tieNoErase);
`));
