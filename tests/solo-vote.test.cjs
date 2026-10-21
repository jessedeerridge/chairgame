const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(){const c=vm.createContext({assert});vm.runInContext(`let soloMode=true,id='me',me={x:0,z:0},state=null;const VOTE_X=0,VOTE_Z=-7,VOTE_MS=30000,RESULTS_MS=7000;const button={},confirm={disabled:false},target={value:'candidate'},$=key=>key==='voteTarget'?target:key==='modalConfirm'?confirm:button;let modalMode='voteButtons',selectedVoteCandidate='candidate';const modal={classList:{remove(){}}};function phase(){return state.phase}function log(){}function closeVoteWhenEnded(){}function alert(message){throw Error(message)};
 function insideBlackBuilding(x,z){return Math.abs(x)<23.8&&Math.abs(z)<20.8}function canCastVote(s,k){return s.phase==='vote'&&s.voteEligible?.[k]===true}function chooseNPCVote(){return 'candidate'}function mutate(fn){fn(state)}
 `+cut('function prepareSoloNPCVotes','let advancing=false;')+cut("$('vote').onclick=",'function finishErase')+html.slice(html.indexOf("$('modalConfirm').onclick=async()=>"),html.indexOf("modal.classList.remove('open')};",html.indexOf("$('modalConfirm').onclick=async()=>"))+"modal.classList.remove('open')};".length)+`
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
