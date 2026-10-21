// Mobile map gestures against the real DOM/CSS and event handlers, without loading 3D.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.setContent(html);await page.evaluate(source=>{
  document.querySelector('#entry').hidden=true;document.body.classList.add('playing');
  eval(`let mapUnlocked=true,miniExpanded=false,pinShareTarget=null;const miniPanel=document.querySelector('#miniMapPanel'),miniBackdrop=document.querySelector('#miniMapBackdrop'),miniCanvas=document.querySelector('#miniMapCanvas');function hideMapSelection(){}function drawMiniMap(){}`+source+`;window.mapTest={expanded:()=>miniExpanded};`);
 },cut('let miniReopenAfter=','function drawMiniMap')+cut("miniCanvas.addEventListener('pointerdown'","for(const type of ['pointermove'"));
 for(const viewport of [{width:390,height:844},{width:1280,height:720}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(450);
  await page.locator('#miniMapCanvas').tap();assert(await page.evaluate(()=>mapTest.expanded()));
  const x=viewport.width-25,y=viewport.height-25;
  await page.touchscreen.tap(x,y);assert.equal(await page.evaluate(()=>mapTest.expanded()),false,'closing tap reopened the minimap');
  await page.touchscreen.tap(x,y);assert.equal(await page.evaluate(()=>mapTest.expanded()),false,'immediate second tap reopened the minimap');
  await page.waitForTimeout(450);await page.touchscreen.tap(x,y);assert(await page.evaluate(()=>mapTest.expanded()),'a fresh intentional tap failed to reopen');
  const rect=await page.locator('#miniMapCanvas').boundingBox();await page.touchscreen.tap(rect.x+rect.width-20,rect.y+20);assert.equal(await page.evaluate(()=>mapTest.expanded()),false,'close button failed');
 }
 console.log('Mobile and desktop sizes: backdrop close, repeated tap suppression, reopening, and X close passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
