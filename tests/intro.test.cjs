// Run with: node --test tests/intro.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function setup(){
 const context=vm.createContext({assert,console});
 const start=html.indexOf('const INTRO_PAGE_MS='),end=html.indexOf('function character',start);
 assert(start>=0&&end>start);
 const advanceStart=html.indexOf('function advanceState(s,now)'),advanceEnd=html.indexOf('let advancing=false;',advanceStart);
 const roundStart=html.indexOf('function initRound(s)'),roundEnd=html.indexOf('function indoorSpawn',roundStart);
 vm.runInContext(`
 const listeners={},document={addEventListener:(name,fn)=>listeners[name]=fn};
 let room='TEST',id='human',soloMode=true,state=null,worldReady=true;
 let writes=[];const update=async(path,value)=>writes.push({path,value}),ref=(db,path)=>path,database=()=>({});
 const SEARCH_MS=90000,RETURN_MS=40000,VOTE_MS=30000,VOTE_INTRO_MS=7000,RESULTS_MS=7000;
 const voteWallTexture={needsUpdate:false},texts=[];
 const voteWallCtx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),fillText:text=>texts.push(String(text))},{get:(o,k)=>k in o?o[k]:()=>{}});
 `+html.slice(start,end)+html.slice(html.indexOf('function prizeCoinCount'),html.indexOf('function paintPrizeMedals'))+html.slice(roundStart,roundEnd)+html.slice(advanceStart,advanceEnd)+`
 function game(){state={phase:'instructions',introStarted:12345,deadline:66345,round:1,players:{human:{name:'me',online:true,initial:true,alive:true}},chairs:{}};return state;}
 function present(s,time,ready=true){tickIntroPlayback(s,time,true,ready);paintVoteWall();markIntroFramePresented(s,time);return introPlayback;}
 `,context);
 return code=>vm.runInContext(code,context);
}
test('all nine pages render in order with no state or database updates',()=>setup()(`
 const s=game(),seen=[];let now=0;
 for(let i=0;i<9;i++){
  const p=present(s,now);seen.push(p.page);assert.equal(p.page,i);assert.equal(p.complete,false);
  present(s,now+5999);assert.equal(p.page,i,'page did not last six seconds');
  now+=6000;present(s,now);
 }
 assert.equal(seen.join(','),'0,1,2,3,4,5,6,7,8');assert(introPlayback.complete);
 assert(texts.includes('椅子取りゲーム'));for(const n of ['①','②','③','④','⑤','⑥'])assert(texts.includes('ルール '+n),'missing rule '+n);
`));
test('a minute-long load or suspended callback advances at most one page',()=>setup()(`
 const s=game();present(s,0);present(s,60000);assert.equal(introPlayback.page,1);assert.equal(introPlayback.elapsed,0);
 present(s,60001);assert.equal(introPlayback.page,1);present(s,65999);assert.equal(introPlayback.page,1);present(s,66000);assert.equal(introPlayback.page,2);
`));
test('time before the first displayed frame is never charged to the mask or title',()=>setup()(`
 const s=game();paintVoteWall();tickIntroPlayback(s,90000);assert.equal(introPlayback.page,0);assert.equal(introPlayback.elapsed,0);
 markIntroFramePresented(s,90000);present(s,95999);assert.equal(introPlayback.page,0);present(s,96000);assert.equal(introPlayback.page,1);
`));
test('hidden tabs pause and resume instead of catching up',()=>setup()(`
 const s=game();present(s,0);present(s,3000);listeners.visibilitychange();tickIntroPlayback(s,100000,false);
 present(s,120000);assert.equal(introPlayback.page,0);present(s,122999);assert.equal(introPlayback.page,0);present(s,123000);assert.equal(introPlayback.page,1);
`));
test('wall clock changes and remote start times cannot jump local pages',()=>setup()(`
 const s=game();s.introStarted=1;s.deadline=-99999;Date.now=()=>1e15;present(s,10);assert.equal(introPlayback.page,0);
 Date.now=()=>0;present(s,6010);assert.equal(introPlayback.page,1);present(s,6011);assert.equal(introPlayback.page,1);
`));
test('the final counts get six full seconds after world construction completes',()=>setup()(`
 const s=game();for(let i=0;i<9;i++)present(s,i*6000,false);
 assert.equal(introPlayback.page,8);present(s,60000,false);assert.equal(introPlayback.complete,false);
 s.chairs={1:{},2:{}};s.worldPreparing=false;texts.length=0;present(s,120000,true);assert.equal(introPlayback.complete,false);assert(texts.includes('イス 2脚'),'counts were not repainted');
 present(s,125999,true);assert.equal(introPlayback.complete,false);present(s,126000,true);assert.equal(introPlayback.complete,true);
`));
test('a new game resets the presentation and ignores old completion receipts',()=>setup()(`
 const s=game();for(let i=0;i<=9;i++)present(s,i*6000);s.players.human.introSeen=introSessionKey(s);assert(introParticipantsReady(s));
 s.introStarted++;present(s,100000);assert.equal(introPlayback.page,0);assert.equal(introPlayback.complete,false);assert.equal(introParticipantsReady(s),false);
`));
test('host waits for every online human and world preparation, but not NPCs or disconnected players',()=>setup()(`
 const s=game();s.players.remote={online:true};s.players.bot={npc:true,online:true};s.players.gone={online:false};
 advanceState(s,999999);assert.equal(s.phase,'instructions');s.players.human.introSeen=introSessionKey(s);advanceState(s,999999);assert.equal(s.phase,'instructions');
 s.players.remote.introSeen=introSessionKey(s);worldReady=false;advanceState(s,999999);assert.equal(s.phase,'instructions');worldReady=true;s.worldPreparing=true;advanceState(s,999999);assert.equal(s.phase,'instructions');
 s.worldPreparing=false;advanceState(s,5);assert.equal(s.phase,'sitIntro','a changed wall clock blocked completed playback');assert.equal(s.deadline,3005);
`));
test('completion is sent once per session, after the last displayed page',async()=>{
 const run=setup();await run(`(async()=>{
  const s=game();soloMode=false;present(s,0);await syncIntroCompletion(0);assert.equal(writes.length,0);
  for(let i=1;i<=9;i++)present(s,i*6000);await syncIntroCompletion(54000);assert.equal(writes.length,1);assert.equal(writes[0].value.introSeen,introSessionKey(s));
  s.players.human.introSeen=writes[0].value.introSeen;await syncIntroCompletion(60000);assert.equal(writes.length,1);
 })()`);
});

test('tied vote shows no-removal announcement after six seconds without removing a chair',()=>setup()(`
 const s=game();s.phase='vote';s.deadline=100;s.players.a={alive:true,name:'A'};s.players.b={alive:true,name:'B'};s.votes={human:'a',a:'b'};s.chairs={1:{removed:false}};
 advanceState(s,100);assert.equal(s.phase,'results');assert.equal(s.deadline,6100);
 advanceState(s,6099);assert.equal(s.phase,'results');advanceState(s,6100);assert.equal(s.phase,'eraseReveal');assert(s.noChairErased);assert.equal(s.lastRemoved,null);assert.equal(s.chairs[1].removed,false);
 paintVoteWall();assert(texts.includes('椅子は除外されませんでした'));advanceState(s,12099);assert.equal(s.phase,'eraseReveal');advanceState(s,12100);assert.equal(s.phase,'sitIntro');assert.equal(s.noChairErased,false);assert.equal(s.chairs[1].removed,false);
`));
