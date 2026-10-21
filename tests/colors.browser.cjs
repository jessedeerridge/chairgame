// Keep a single tap valid when a multiplayer snapshot arrives between press and release.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('const SHIRT_COLORS'),html.indexOf('let playerPreloadTask'));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
  await page.setContent(html);await page.evaluate(source=>{
   document.querySelector('#entry').hidden=true;document.querySelector('#lobbyScreen').hidden=false;document.body.classList.add('in-lobby');
   eval(`const $=k=>document.getElementById(k),id='me';const state={phase:'lobby',players:{me:{online:true,shirtColor:'red'},other:{online:true,shirtColor:'blue'}}};function player(){return state.players[id]}async function mutate(fn){fn(state);renderShirtColors()}function lobbyParticipants(s){return Object.entries(s.players).filter(([k,p])=>!p.npc&&p.online!==false)}`+source+`;renderShirtColors();window.colorsTest={snapshot:()=>{state.players.other.worldReady=true;renderShirtColors()},selected:()=>player().shirtColor};`);
  },code);
  const button=page.locator('[data-color="green"]'),box=await button.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  const handle=await button.elementHandle();let cdp;
  if(mobile){cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});}
  else{await page.mouse.move(x,y);await page.mouse.down();}
  await page.evaluate(()=>colorsTest.snapshot());
  assert(await handle.evaluate(el=>el.isConnected),'snapshot replaced the pressed color button');
  if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  await page.waitForFunction(()=>colorsTest.selected()==='green');assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert(await page.locator('[data-color="blue"]').isDisabled());await page.locator('[data-color="pink"]').click();assert.equal(await page.evaluate(()=>colorsTest.selected()),'pink');
  await page.close();
 }
 console.log('Desktop and mobile: one tap survives a room snapshot, selects immediately, and allows reselection');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
