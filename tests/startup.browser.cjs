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
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/navigation-world.json'),'utf8'));
 for(const removed of ['soloIntroPrompt','introSkipped',"modalMode==='introDoor'",'askOpenIntroDoor'])assert(!html.includes(removed),`skip path remains: ${removed}`);
 const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.THREE_MODULE_PATH)await page.route('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',route=>route.fulfill({path:process.env.THREE_MODULE_PATH,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}}));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  assert.equal(await page.locator('#room').getAttribute('inputmode'),'numeric');await page.fill('#room','0012');assert.equal(await page.inputValue('#room'),'0012');
  await page.evaluate(()=>{
   document.addEventListener('click',event=>{if(event.target.closest('#solo')&&!window.bootClick)window.bootClick=performance.now();},{capture:true});
   const code=document.querySelector('#deferredGameCode');
   code.textContent=code.textContent.replace('performance.mark("island-room-ready");',`window.bootTest={status:()=>({ready:worldReady,outdoorVisible:outdoorWorld.visible,outdoorMeshes:outdoorWorld.children.length,obstacles:obstacles.length,hidingSpots:hidingSpots.length,stairs:stairways.length,clearingClean:hidingSpots.every(p=>!nearBlackBuildingVegetation(p.x,p.z))&&obstacles.every(o=>![.85,1.65,.65].includes(o.r)||!nearBlackBuildingVegetation(o.x,o.z))}),getState:()=>state,advanceState,pauseHostForTest:()=>{host=false;},introPage:()=>introPlaybackFor(state)?.page,completeIntroForTest:async()=>{introPlayback=null;let now=performance.now();for(let i=0;i<=9;i++){tickIntroPlayback(state,now+i*6001,true,true);paintVoteWall();renderer.render(scene,camera);markIntroFramePresented(state,now+i*6001);}await syncIntroCompletion(performance.now());},npcSimulate,npcWorldBlocked,avatars,getId:()=>id,getLocalHeight:()=>playerHeight,camera,renderer,me,keys,roomCameraFocus,guideRoomView,setHeight:h=>playerHeight=h,forceDoor:()=>{roomCameraFocus(performance.now());roomFocusStarted=performance.now()-1000;},projectScreen:()=>new THREE.Vector3(0,8.1,voteWallZ+.09).project(camera),projectPlayer:h=>new THREE.Vector3(me.x,playerHeight+h,me.z).project(camera),setMe:(x,z)=>{me.x=x;me.z=z;playerHeight=0;},orbitTarget:()=>({x:_cameraTarget.x,y:_cameraTarget.y,z:_cameraTarget.z,yaw,playerHeight}),renderUI,renderWallet,paintVoteWall,voteResultLayout,wallCanvas:()=>voteWallCtx.canvas,screenReady:()=>voteWall.material.map===voteWallTexture,door:()=>window.__blackIntroDoor,scene,outdoorWorld};performance.mark("island-room-ready");`);
   code.textContent=code.textContent.replace('speed*=playerSpeedFactor(state,player());','speed*=playerSpeedFactor(state,player());window.testMovementSpeed=speed;');
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
  assert.equal(loaded.phase,'instructions','loading completion skipped the introduction');assert.equal(loaded.chairs,15);assert.equal(loaded.status.stairs,4);assert.equal(loaded.status.hidingSpots,fixture.hidingSpots.length);assert(loaded.status.clearingClean,'vegetation remains around the black building');assert(loaded.status.outdoorMeshes>1000);assert.equal(loaded.status.outdoorVisible,false);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>{const t=window.bootTest,v=t.projectScreen();return Math.abs(v.x)<.0001&&Math.abs(v.y)<.0001&&t.renderer.domElement.width===390&&t.renderer.domElement.height===844;});
  const origin=await page.evaluate(()=>{const t=window.bootTest; t.keys.KeyD=true;return{x:t.me.x,z:t.me.z};});
  await page.waitForFunction(origin=>Math.hypot(window.bootTest.me.x-origin.x,window.bootTest.me.z-origin.z)>.3,origin);
  const focus=await page.evaluate(()=>{const t=window.bootTest;t.keys.KeyD=false;const v=t.projectScreen(),orbit=t.orbitTarget(),s=t.getState();const previous=s.phase;
   s.phase='sitIntro';const first=t.roomCameraFocus(performance.now());t.forceDoor();const next=t.guideRoomView(performance.now());
   const outside={x:t.me.x,z:t.me.z};t.me.z=50;const released=t.roomCameraFocus(performance.now());Object.assign(t.me,outside);s.phase=previous;
   const dx=t.me.x-orbit.x,dz=t.me.z-orbit.z;return{normalTPSPosition:Math.abs(dx*Math.cos(orbit.yaw)-dz*Math.sin(orbit.yaw))<.05&&Math.hypot(dx,dz)<=10.01,centered:Math.abs(v.x)<.0001&&Math.abs(v.y)<.0001,guidedTPSHeight:Math.abs(orbit.y-(orbit.playerHeight+3.4))<.0001,first,next,released,scale:window.visualViewport.scale};});
  assert(focus.centered);assert(focus.guidedTPSHeight);assert(focus.normalTPSPosition);assert.equal(focus.first,'screen');assert.equal(focus.next,'door');assert.equal(focus.released,null);assert.equal(focus.scale,1);
  const framing=[];
  for(const viewport of [{width:390,height:844},{width:1280,height:720}]){
   await page.setViewportSize(viewport);
   for(const [x,z] of [[14,15.6],[0,19.8],[-20,18],[-8,20]]){
    await page.evaluate(([x,z])=>window.bootTest.setMe(x,z),[x,z]);
    await page.waitForFunction(()=>{const t=window.bootTest,s=t.projectScreen(),orbit=t.orbitTarget(),yaw=Math.atan2(-t.me.x,-18-t.me.z);return Math.abs(Math.atan2(Math.sin(orbit.yaw-yaw),Math.cos(orbit.yaw-yaw)))<.01&&Math.abs(t.camera.position.x-orbit.x)<.1&&Math.abs(t.camera.position.z-orbit.z)<.1&&Math.abs(s.x)<1&&Math.abs(s.y)<1&&t.camera.fov===65&&[2.4,3.4].every(h=>{const p=t.projectPlayer(h);return p.z<1&&p.z>-1&&Math.abs(p.x)<.97&&Math.abs(p.y)<.97;});});
    framing.push(await page.evaluate(()=>({position:{...window.bootTest.me},fov:window.bootTest.camera.fov})));
   }
  }
  await page.setViewportSize({width:1280,height:720});
  const pageBefore=await page.evaluate(()=>{window.bootTest.pauseHostForTest();return window.bootTest.introPage();});
  await page.waitForFunction(previous=>window.bootTest.introPage()===previous+1,pageBefore,{timeout:10000});
  const transitions=await page.evaluate(async()=>{
   const t=window.bootTest,s=t.getState();t.advanceState(s,s.introStarted+999999);const before=s.phase;await t.completeIntroForTest();t.advanceState(s,Date.now());const after=s.phase;t.advanceState(s,s.deadline+1);const search=s.phase;
   const now=Date.now();s.deadline=now+90000;for(let i=0;i<120;i++)t.npcSimulate(s,.28,now+i*280);
   return {before,after,search,npcs:Object.values(s.players).filter(p=>p.npc).length,collisions:Object.values(s.players).filter(p=>p.npc&&t.npcWorldBlocked(s,p.x,p.z,.65)).length};
  });
  assert.equal(transitions.before,'instructions');assert.equal(transitions.after,'sitIntro');assert.equal(transitions.search,'search');assert.equal(transitions.npcs,19);assert.equal(transitions.collisions,0);assert.deepEqual(errors,[]);
  await page.waitForFunction(()=>window.bootTest.camera.fov===65);
  await page.evaluate(()=>{const t=window.bootTest,s=t.getState(),id=t.getId();s.chairs[900]={x:10,z:6,y:15,occupied:id};s.chairs[901]={x:15,z:6,y:7,occupied:'NPC0'};s.players[id].sitting=900;s.players.NPC0.sitting=901;});
  await page.waitForFunction(()=>{const t=window.bootTest;return t.avatars[t.getId()].position.y===15&&t.avatars.NPC0.position.y===7&&t.getLocalHeight()===15&&t.camera.position.y>15;});
  const seatedHeights=await page.evaluate(()=>{const t=window.bootTest,s=t.getState(),result={local:t.avatars[t.getId()].position.y,remote:t.avatars.NPC0.position.y,cameraFollows:t.camera.position.y>15};s.players[t.getId()].sitting=0;s.players.NPC0.sitting=0;delete s.chairs[900];delete s.chairs[901];return result;});
  await page.evaluate(()=>{const t=window.bootTest,s=t.getState(),id=t.getId();s.chairs[902]={x:17.7,z:220.7,y:16.2,occupied:id};s.players[id].sitting=902;});
  await page.waitForFunction(()=>window.bootTest.getLocalHeight()===16.2);
  await page.click('#sit');
  await page.waitForFunction(()=>{const t=window.bootTest,p=t.getState().players[t.getId()];return !p.sitting&&Math.abs(t.getLocalHeight()-16.2)<.01&&Math.abs(t.avatars[t.getId()].position.y-16.2)<.01;});
  const standingHeight=await page.evaluate(()=>window.bootTest.getLocalHeight());
  const display=await page.evaluate(()=>{
   const t=window.bootTest,s=t.getState(),p=Object.values(s.players).find(p=>!p.npc);t.renderWallet(p);
   const wallet=document.querySelector('#wallet'),first=wallet.firstChild;
   for(let i=0;i<30;i++)t.renderUI();const unchanged=wallet.firstChild===first;
   s.voteCounts=Object.fromEntries(Object.keys(s.players).map((k,i)=>[k,i<3?5:1]));s.phase='results';t.paintVoteWall();
   const before=t.wallCanvas().toDataURL();s.phase='erase';t.paintVoteWall();const sameScreen=before===t.wallCanvas().toDataURL();
   const preview=document.createElement('img');preview.src=t.wallCanvas().toDataURL();Object.assign(preview.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',objectFit:'contain',zIndex:100,background:'#080f20'});document.body.append(preview);
   return {unchanged,sameScreen,leaders:t.voteResultLayout(s).filter(b=>b.leader).length};
  });
  assert(display.unchanged,'wallet rebuilt on position-only snapshots');assert(display.sameScreen,'results changed during chair selection');assert.equal(display.leaders,3);
  await page.screenshot({path:'/tmp/vote-results.png'});
  await page.evaluate(()=>{const t=window.bootTest,s=t.getState(),id=t.getId();t.setMe(0,10);s.phase='finished';s.winner='NPC0';s.players[id].wallet={};s.players[id].sitting=0;s.players.NPC0.wallet={NPC0:5};s.finalRanks={[id]:1,NPC0:2};t.renderUI();});
  await page.waitForFunction(()=>{const t=window.bootTest,a=t.avatars[t.getId()];return a.userData.pose.rotation.x<-.05&&a.userData.pose.rotation.x>-1.5;});
  await page.waitForFunction(()=>Math.abs(window.bootTest.avatars[window.bootTest.getId()].userData.pose.rotation.x+Math.PI/2)<.0001);
  const zeroPrize=await page.evaluate(()=>{const t=window.bootTest,a=t.avatars[t.getId()],winner=t.avatars.NPC0;return{angle:a.userData.pose.rotation.x,pivotHeight:a.userData.pose.position.y,label:a.userData.prizeSprite.userData.lastText,labelUpright:a.userData.prizeSprite.parent===a,legs:a.userData.legs.length,winnerUpright:winner.userData.pose.rotation.x===0};});
  assert.equal(zeroPrize.label,'null:0');assert.equal(zeroPrize.pivotHeight,.62);assert(zeroPrize.labelUpright&&zeroPrize.winnerUpright);assert.equal(zeroPrize.legs,2);
  const movementStart=await page.evaluate(()=>{const t=window.bootTest;t.keys.KeyW=true;return{x:t.me.x,z:t.me.z,time:performance.now()};});
  await page.waitForTimeout(650);
  const zeroSpeed=await page.evaluate(start=>{const t=window.bootTest;t.keys.KeyW=false;return {calculated:window.testMovementSpeed,distance:Math.hypot(t.me.x-start.x,t.me.z-start.z)};},movementStart);
  assert.equal(zeroSpeed.calculated,6.5);assert(zeroSpeed.distance>.1);
  console.log(JSON.stringify({initial,loaded,transitions,display,focus,framing,seatedHeights,standingHeight,zeroPrize,zeroSpeed,errors},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
