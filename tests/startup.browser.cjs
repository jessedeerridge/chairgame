// Requires Playwright and a Chromium executable. This test uses offline play only.
// CHROMIUM_PATH=/usr/bin/chromium THREE_MODULE_PATH=/path/to/three.module.js node tests/startup.browser.cjs
// THREE_MODULE_PATH optionally supplies the unchanged Three.js 0.164.1 module from a trusted cache.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const removed of ['soloIntroPrompt','introSkipped',"modalMode==='introDoor'",'askOpenIntroDoor'])assert(!html.includes(removed),`skip path remains: ${removed}`);
 const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.THREE_MODULE_PATH)await page.route('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',route=>route.fulfill({path:process.env.THREE_MODULE_PATH,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}}));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(()=>{
   document.addEventListener('click',event=>{if(event.target.closest('#solo')&&!window.bootClick)window.bootClick=performance.now();},{capture:true});
   const code=document.querySelector('#deferredGameCode');
   code.textContent=code.textContent.replace('performance.mark("island-room-ready");',`window.bootTest={status:()=>({ready:worldReady,outdoorVisible:outdoorWorld.visible,outdoorMeshes:outdoorWorld.children.length,obstacles:obstacles.length,hidingSpots:hidingSpots.length,stairs:stairways.length}),getState:()=>state,advanceState,pauseHostForTest:()=>{host=false;},introPage:()=>introPlaybackFor(state)?.page,completeIntroForTest:async()=>{introPlayback=null;let now=performance.now();for(let i=0;i<=9;i++){tickIntroPlayback(state,now+i*6001,true,true);paintVoteWall();renderer.render(scene,camera);markIntroFramePresented(state,now+i*6001);}await syncIntroCompletion(performance.now());},npcSimulate,npcWorldBlocked,screenReady:()=>voteWall.material.map===voteWallTexture,door:()=>window.__blackIntroDoor,scene,outdoorWorld};performance.mark("island-room-ready");`);
   window.addEventListener('islandGameModuleReady',()=>{window.firstRoom=window.bootTest.status();window.roomReadyMs=performance.now()-window.bootClick;});
  });
  await page.click('#solo');await page.waitForFunction(()=>window.__islandGameReady,{timeout:60000});
  const initial=await page.evaluate(()=>({first:window.firstRoom,phase:window.bootTest.getState().phase,screen:window.bootTest.screenReady(),door:!!window.bootTest.door(),prompt:!!document.querySelector('#soloIntroPrompt'),readyMs:Math.round(window.roomReadyMs)}));
  assert.equal(initial.first.ready,false);assert.equal(initial.first.outdoorMeshes,0);assert.equal(initial.first.obstacles,5);assert.equal(initial.first.hidingSpots,0);assert.equal(initial.first.stairs,0);
  assert.equal(initial.phase,'instructions');assert(initial.screen&&initial.door);assert.equal(initial.prompt,false);
  const gate=await page.evaluate(()=>{const s=window.bootTest.getState();window.bootTest.advanceState(s,s.introStarted+54001);return s.phase;});
  assert.equal(gate,'instructions','game advanced while outdoor geometry was incomplete');
  await page.waitForFunction(()=>window.bootTest.status().ready&&!window.bootTest.getState().worldPreparing,{timeout:60000});
  const loaded=await page.evaluate(()=>({status:window.bootTest.status(),phase:window.bootTest.getState().phase,chairs:Object.keys(window.bootTest.getState().chairs).length,readyMs:Math.round(performance.getEntriesByName('island-world-ready')[0].startTime-window.bootClick)}));
  assert.equal(loaded.phase,'instructions','loading completion skipped the introduction');assert.equal(loaded.chairs,15);assert.equal(loaded.status.stairs,4);assert.equal(loaded.status.hidingSpots,220);assert(loaded.status.outdoorMeshes>1000);assert.equal(loaded.status.outdoorVisible,false);
  const pageBefore=await page.evaluate(()=>{window.bootTest.pauseHostForTest();return window.bootTest.introPage();});
  await page.waitForFunction(previous=>window.bootTest.introPage()===previous+1,pageBefore,{timeout:10000});
  const transitions=await page.evaluate(async()=>{
   const t=window.bootTest,s=t.getState();t.advanceState(s,s.introStarted+999999);const before=s.phase;await t.completeIntroForTest();t.advanceState(s,Date.now());const after=s.phase;t.advanceState(s,s.deadline+1);const search=s.phase;
   const now=Date.now();s.deadline=now+90000;for(let i=0;i<120;i++)t.npcSimulate(s,.28,now+i*280);
   return {before,after,search,npcs:Object.values(s.players).filter(p=>p.npc).length,collisions:Object.values(s.players).filter(p=>p.npc&&t.npcWorldBlocked(s,p.x,p.z,.65)).length};
  });
  assert.equal(transitions.before,'instructions');assert.equal(transitions.after,'sitIntro');assert.equal(transitions.search,'search');assert.equal(transitions.npcs,19);assert.equal(transitions.collisions,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({initial,loaded,transitions,errors},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
