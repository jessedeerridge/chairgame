// Isolated two-client multiplayer test. Firebase is replaced by a local in-memory
// adapter; this never reads or writes the production database.
// THREE_MODULE_PATH=/trusted/cache/three.module.js node tests/lobby.browser.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const databaseModule=`
const listeners=new Map();
window.__emitFakeDatabase=async()=>{for(const [path,fn] of listeners){const snapshot=await window.testRead(path);fn({val:()=>snapshot.value});}};
export const getDatabase=()=>({});export const ref=(db,path)=>({path});
export async function runTransaction(ref,fn){for(let i=0;i<100;i++){const old=await window.testRead(ref.path),next=fn(old.value);if(next===undefined)return{committed:false,snapshot:{val:()=>old.value}};const result=await window.testCommit(ref.path,next,old.revision);if(result.ok)return{committed:true,snapshot:{val:()=>result.value}};}throw Error('transaction retry limit');}
export const update=async(ref,values)=>window.testUpdate(ref.path,values);
export const set=async(ref,value)=>{const old=await window.testRead(ref.path);return window.testCommit(ref.path,value,old.revision);};
export const get=async(ref)=>{const old=await window.testRead(ref.path);return{val:()=>old.value};};
export const onValue=(ref,fn)=>{listeners.set(ref.path,fn);window.__emitFakeDatabase();return()=>listeners.delete(ref.path);};
export const onDisconnect=()=>({set:async()=>{},update:async()=>{},cancel:async()=>{}});
`;
(async()=>{
 let connectionBeforeImports=0;let data={},revision=0,pages=[],noticeTimer=null,positionWritesInLobby=0;
 const clone=x=>JSON.parse(JSON.stringify(x??null));
 const read=key=>key.split('/').reduce((v,k)=>v?.[k],data)??null;
 const write=(key,value)=>{const parts=key.split('/');let v=data;for(const k of parts.slice(0,-1))v=v[k]??={};v[parts.at(-1)]=clone(value);};
 const notify=()=>{clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{Promise.all(pages.map(p=>p.isClosed()?null:p.evaluate(()=>window.__emitFakeDatabase?.()).catch(()=>{})));},5);};
 const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[];
  for(const name of ['Host','Guest']){
   const page=await browser.newPage(name==='Guest'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{});pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.exposeBinding('testRead',(_,key)=>({value:clone(read(key)),revision}));
   await page.exposeBinding('testCommit',(_,key,next,expected)=>{
    if(revision!==expected)return{ok:false};const before=JSON.stringify(read(key));if(before!==JSON.stringify(next)){write(key,next);revision++;notify();}return{ok:true,value:clone(next)};
   });
   await page.exposeBinding('testUpdate',(_,key,values)=>{
    if(read('rooms/TEST/phase')==='lobby'&&('x'in values||'z'in values))positionWritesInLobby++;
    const current=clone(read(key))||{};for(const [k,v] of Object.entries(values)){if(v===null)delete current[k];else current[k]=v;}
    if(JSON.stringify(read(key))!==JSON.stringify(current)){write(key,current);revision++;notify();}return true;
   });
   await page.route('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js',r=>r.fulfill({body:'export const initializeApp=()=>({});',contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}}));
   await page.route('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js',r=>r.fulfill({body:databaseModule,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}}));
   if(process.env.THREE_MODULE_PATH)await page.route('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',async r=>{
    const waiting=await page.evaluate(()=>!document.querySelector('#entry').hidden&&document.querySelector('#lobbyScreen').hidden&&!window.__islandGameReady&&document.querySelector('#name').value);
    assert.equal(waiting,name,'connection screen must remain visible until room state is known');connectionBeforeImports++;
    await r.fulfill({path:process.env.THREE_MODULE_PATH,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   });
   await page.addInitScript(()=>{window.holdTestLoad=true;if(!localStorage.getItem('island-chair-game-entry-v1'))localStorage.setItem('island-chair-game-entry-v1',JSON.stringify({name:'以前の名前',room:'OLDROOM'}));});
   await page.goto('http://127.0.0.1:'+server.address().port);
   assert.equal(await page.inputValue('#name'),'以前の名前');assert.equal(await page.inputValue('#room'),'OLDROOM');
   await page.evaluate(()=>{const code=document.querySelector('#deferredGameCode');code.textContent=code.textContent.replace('function startWorldLoading(){',"function startWorldLoading(){if(window.holdTestLoad)return new Promise(resolve=>window.releaseTestLoad=()=>{window.holdTestLoad=false;resolve(startWorldLoading());});");code.textContent=code.textContent.replace('performance.mark("island-room-ready");',`window.lobbyTest={getState:()=>state,getMe:()=>({...me}),getId:()=>id,setMe:(p)=>{me.x=p.x;me.z=p.z;playerHeight=0;},updateMapVisibility,showStack:()=>{resetStackIdle(performance.now()-6001);updateStackButton(performance.now());},worldReady:()=>worldReady};performance.mark("island-room-ready");`);});
   await page.fill('#name',name);await page.fill('#room','TEST');await page.click('#join');await page.waitForFunction(()=>window.lobbyTest?.getState()?.players?.[window.lobbyTest.getId()],{timeout:60000});
  }
  assert.deepEqual(Object.values(read('rooms/TEST/players')).filter(p=>!p.npc).map(p=>p.name).sort(),['Guest','Host']);
  for(const page of pages){await page.waitForFunction(()=>document.body.classList.contains('in-lobby')&&document.querySelectorAll('.lobby-player').length===2);assert(await page.locator('#lobbyScreen').isVisible());assert.equal(await page.locator('body>canvas').isVisible(),false);const cols=await page.locator('#lobbyParticipants').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(cols,2);}
  if(process.env.CAPTURE_LOBBY){await pages[0].screenshot({path:'/tmp/lobby-desktop.png'});await pages[1].screenshot({path:'/tmp/lobby-mobile.png'});}
  assert.equal(read('rooms/TEST/phase'),'lobby');
  for(const page of pages)assert.equal(await page.evaluate(()=>window.lobbyTest.worldReady()),false);
  assert.equal(positionWritesInLobby,0,'waiting clients overwrote spawn coordinates');assert.equal(read('rooms/TEST/phase'),'lobby','loading automatically started the game');
  assert.equal(await pages[0].locator('#start').isEnabled(),true);assert.equal(await pages[1].locator('#start').isEnabled(),false);
  await pages[0].click('#start');
  for(const page of pages)await page.waitForFunction(()=>window.lobbyTest.getState().phase==='instructions'&&document.body.classList.contains('playing'),{timeout:10000});
  assert.equal(read('rooms/TEST/worldPreparing'),true);
  for(const page of pages)await page.evaluate(()=>window.releaseTestLoad());
  for(const page of pages)await page.waitForFunction(()=>window.lobbyTest.worldReady()&&!window.lobbyTest.getState().worldPreparing,{timeout:60000});
  for(const page of pages){await page.waitForFunction(()=>{const c=document.querySelector('body>canvas');return c.width===innerWidth&&c.height===innerHeight;});assert.equal(await page.evaluate(()=>visualViewport.scale),1);}
  await pages[1].setViewportSize({width:844,height:390});
  await pages[1].waitForFunction(()=>{const c=document.querySelector('body>canvas');return c.width===844&&c.height===390;});
  await pages[1].setViewportSize({width:390,height:844});
  const players=Object.values(read('rooms/TEST/players')).filter(p=>p.online!==false);assert.equal(players.length,20);
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)assert(Math.hypot(players[i].x-players[j].x,players[i].z-players[j].z)>=2.2,'overlapping initial positions');
  for(const page of pages){const p=await page.evaluate(()=>{const t=window.lobbyTest,me=t.getMe(),spawn=t.getState().players[t.getId()].spawn;return{distance:Math.hypot(me.x-spawn.x,me.z-spawn.z),spawn};});assert.equal(p.distance,0,'client did not apply its assigned spawn');}
  for(const page of pages)assert.equal(await page.locator('#miniMapPanel').isVisible(),false);
  const guest=pages[1],before=await guest.evaluate(()=>{const t=window.lobbyTest,p=t.getState().players.NPC0;t.setMe({x:0,z:23});t.updateMapVisibility();t.setMe(p);t.showStack();return{x:p.x,z:p.z};});
  await guest.waitForFunction(()=>!document.querySelector('#stackButton').hidden);await guest.click('#stackButton');
  await guest.waitForFunction(old=>Math.hypot(window.lobbyTest.getMe().x-old.x,window.lobbyTest.getMe().z-old.z)>2.2,before,{timeout:10000});
  const relocated=await guest.evaluate(()=>{const t=window.lobbyTest,p=t.getMe();return{point:p,minDistance:Math.min(...Object.entries(t.getState().players).filter(([k,v])=>k!==t.getId()&&v.online!==false).map(([k,v])=>Math.hypot(v.x-p.x,v.z-p.z))),hidden:document.querySelector('#stackButton').hidden};});
  assert(relocated.minDistance>=2.2);assert.equal(relocated.hidden,true);
  await pages[0].close();
  const guestId=await guest.evaluate(()=>window.lobbyTest.getId());
  const started=read('rooms/TEST/started'),introStarted=read('rooms/TEST/introStarted');
  // Preserve an in-progress introduction across a real document reload.
  await guest.reload();
  await guest.evaluate(()=>{
   const code=document.querySelector('#deferredGameCode');
   code.textContent=code.textContent.replace('performance.mark("island-room-ready");',`window.rejoinTest={getState:()=>state,getMe:()=>({...me}),getIntro:()=>introPlaybackFor(state),tick:tickIntroPlayback,save:saveIntroPlayback};performance.mark("island-room-ready");`);
   window.sawRejoinLobby=false;new MutationObserver(()=>{if(!document.querySelector('#lobbyScreen').hidden)window.sawRejoinLobby=true;}).observe(document.querySelector('#lobbyScreen'),{attributes:true});
  });
  await guest.click('#join');
  await guest.waitForFunction(()=>window.rejoinTest?.getState()?.phase==='instructions');
  assert.equal(await guest.evaluate(()=>window.sawRejoinLobby),false);
  assert.equal(read('rooms/TEST/started'),started);assert.equal(read('rooms/TEST/introStarted'),introStarted);
  await guest.evaluate(()=>{const p=window.rejoinTest.getIntro();p.page=4;p.elapsed=3000;window.rejoinTest.save();});
  await guest.reload();
  await guest.evaluate(()=>{const code=document.querySelector('#deferredGameCode');code.textContent=code.textContent.replace('performance.mark("island-room-ready");',`window.rejoinTest={getState:()=>state,getMe:()=>({...me}),getIntro:()=>introPlaybackFor(state)};performance.mark("island-room-ready");`);});
  await guest.click('#join');await guest.waitForFunction(()=>window.rejoinTest?.getState()?.phase==='instructions');
  assert.equal(await guest.evaluate(()=>window.rejoinTest.getIntro().page),4,'intro restarted on reload');
  // Mid-round reconnection must restore the saved game, wallet, chair and location.
  const saved=clone(read('rooms/TEST/players/'+guestId));Object.assign(saved,{x:100,z:80,y:0,roundMarker:'preserved',wallet:{[guestId]:17}});
  await guest.reload();
  write('rooms/TEST/players/'+guestId,saved);write('rooms/TEST/phase','search');write('rooms/TEST/round',3);write('rooms/TEST/deadline',Date.now()+90000);revision++;
  await guest.evaluate(()=>{const code=document.querySelector('#deferredGameCode');code.textContent=code.textContent.replace('performance.mark("island-room-ready");',`window.rejoinTest={getState:()=>state,getMe:()=>({...me})};performance.mark("island-room-ready");`);window.sawRejoinLobby=false;new MutationObserver(()=>{if(!document.querySelector('#lobbyScreen').hidden)window.sawRejoinLobby=true;}).observe(document.querySelector('#lobbyScreen'),{attributes:true});});
  await guest.click('#join');await guest.waitForFunction(()=>window.rejoinTest?.getState()?.phase==='search');
  const restored=await guest.evaluate(()=>({s:window.rejoinTest.getState(),me:window.rejoinTest.getMe(),lobby:window.sawRejoinLobby}));
  assert.equal(restored.s.round,3);assert.equal(restored.s.started,started);assert.equal(restored.me.x,100);assert.equal(restored.me.z,80);assert.equal(restored.s.players[guestId].wallet[guestId],17);assert.equal(restored.lobby,false);
  assert.deepEqual(errors,[]);if(process.env.THREE_MODULE_PATH)assert.equal(connectionBeforeImports,5);
  console.log(JSON.stringify({participants:2,connectionBeforeImports,startedBeforeLoad:true,loadedInBackground:true,positionWritesInLobby,uniqueStartingPositions:20,relocated,errors},null,2));
 }finally{clearTimeout(noticeTimer);if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
