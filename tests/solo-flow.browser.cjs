const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const server=http.createServer((q,r)=>r.end(html));await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',r=>r.fulfill({path:process.env.THREE_MODULE_PATH||'/tmp/three.module.js',contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{const code=document.querySelector('#deferredGameCode');code.textContent=code.textContent.replace('performance.mark("island-room-ready");',`window.soloFlow={ready:()=>worldReady,state:()=>state,setupReturn:()=>{const willing=Object.keys(state.players).find(k=>state.players[k].npc);for(const [k,p] of Object.entries(state.players)){Object.assign(p,{x:0,z:0,y:0,alive:true,sitting:0,carrying:0,returned:true,voted:false,npcSpotHide:null,npcRoofTrip:null});if(p.npc)p.voteIntent=k===willing;}me.x=0;me.z=0;playerHeight=0;state.phase='return';state.deadline=roomNow()+40000;},startVote:()=>{state.phase='voteIntro';state.deadline=roomNow()-1;state.votes={};state.soloVotesPreparedRound=null;},expireVote:()=>{state.deadline=roomNow()-1000;},abstain:()=>{me.x=100;me.z=100;state.players[id].x=100;state.players[id].z=100;state.players[id].voted=false;state.round++;state.phase='voteIntro';state.deadline=roomNow()-1;state.votes={};state.soloVotesPreparedRound=null;},id:()=>id};performance.mark("island-room-ready");`)});
  await page.click('#solo');await page.waitForFunction(()=>window.soloFlow?.ready()&&!soloFlow.state().worldPreparing,{timeout:60000});
  await page.evaluate(()=>soloFlow.setupReturn());await page.waitForFunction(()=>soloFlow.state().phase==='voteIntro',null,{timeout:5000});
  await page.evaluate(()=>soloFlow.startVote());await page.waitForFunction(()=>soloFlow.state().phase==='vote');
  await page.evaluate(()=>soloFlow.expireVote());await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>soloFlow.state().phase),'vote');
  assert.equal(await page.locator('#clockSeconds').evaluate(el=>el.hidden),true);
  await page.click('#touch');await page.locator('[data-candidate]').first().click();await page.click('#modalConfirm');await page.waitForFunction(()=>soloFlow.state().phase==='results');
  await page.evaluate(()=>soloFlow.abstain());await page.waitForFunction(()=>soloFlow.state().phase==='results',null,{timeout:5000});
  const vote=await page.evaluate(()=>({votes:soloFlow.state().votes,id:soloFlow.id()}));assert.equal(Object.keys(vote.votes).length,1);assert(!vote.votes[vote.id]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({allReturnedEndsEarly:true,waitsForHumanWithoutTimeout:true,humanVoteEndsImmediately:true,abstentionCountsOnlyWillingNPC:true,errors}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
