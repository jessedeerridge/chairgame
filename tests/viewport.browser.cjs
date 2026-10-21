// Real CSS/DOM bounds, without booting the game or connecting to Firebase.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({isMobile:true,hasTouch:true});
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1280,height:720}]){
  await page.setViewportSize(size);await page.setContent(html);
  await page.evaluate(()=>{document.querySelector('#entry').hidden=true;document.body.classList.add('playing');document.querySelector('#clock').hidden=false;document.querySelector('#phaseInstruction').textContent='着席終了まで';document.querySelector('#clockSeconds').textContent='00:60';document.querySelector('#wallet').innerHTML=Array.from({length:12},(_,i)=>'<div class="coin-entry">プレイヤー'+i+'：100</div>').join('');});
  async function check(bounds){const boxes=await page.evaluate(()=>Object.fromEntries(['stickBase','miniMapPanel','hud','clock'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{left:r.left,right:r.right,top:r.top,bottom:r.bottom}]})));for(const [id,r] of Object.entries(boxes)){assert(r.left>=bounds.left-.5&&r.right<=bounds.right+.5,`${id} horizontal overflow: ${JSON.stringify({r,bounds})}`);assert(r.top>=bounds.top-.5&&r.bottom<=bounds.bottom+.5,`${id} vertical overflow: ${JSON.stringify({r,bounds})}`);}}
  await check({left:0,top:0,right:size.width,bottom:size.height});
  // Browser chrome / shifted visual viewport inside a larger layout viewport.
  const visible={width:size.width-24,height:size.height-80,offsetLeft:8,offsetTop:12};
  await page.evaluate(v=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:v});window.dispatchEvent(new Event('resize'));},visible);
  const bounds={left:8,top:12,right:8+visible.width,bottom:12+visible.height};await check(bounds);
  await page.evaluate(()=>document.querySelector('#miniMapPanel').classList.add('expanded'));await check(bounds);
 }
 console.log('HUD, timer, stick and maps fit portrait, landscape, desktop and reduced visual viewports');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
