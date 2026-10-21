// Exercise the real vote dialog and clock layout without constructing the 3D world.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent(html);
 await page.evaluate(source=>{
  document.querySelector('#entry').hidden=true;document.body.classList.add('playing');document.querySelector('#actions').hidden=false;
  eval(`const $=id=>document.getElementById(id),id='me',VOTE_X=0,VOTE_Z=-7,modal=$('modal');let modalMode='',selectedVoteCandidate=null,recentHiddenChair=null,spotAction=null,mapUnlocked=true;
   const me={x:0,z:0},state={phase:'vote',deadline:Date.now()+10000,voteEligible:{me:true},votes:{},players:{me:{name:'自分',alive:true},other:{name:'相手',alive:true}},chairs:{}};
   function phase(){return state.phase}function player(){return state.players[id]}function players(){return Object.entries(state.players)}function isOnlineLobby(){return false}function syncGiftInteraction(){return true}function nearestPartner(){return null}function closestBackChair(){return null}function nearbyHiddenChairForMark(){return null}function closestSpot(){return null}function nearestAccessory(){return null}function nearbyPickup(){return null}function setActionIcon(){}function formatCountdown(){return '00:10'}
  `+source+`; $('touch').onclick=openParentVote;refreshActions();window.overlayTest={refreshActions,voted:()=>{state.players.me.voted=true;state.votes.me='other';refreshActions()}};`);
 },cut('function refreshActions(){','function updateTradeAmount')+cut('function closeVoteWhenEnded(){',"$('touch').onclick=openParentVote;"));
 assert(await page.locator('#touch').isVisible());await page.click('#touch');assert(await page.locator('#parentChoiceButtons').isVisible());assert.equal(await page.locator('#touch').isVisible(),false);
 await page.evaluate(()=>overlayTest.refreshActions());assert.equal(await page.locator('#touch').isVisible(),false);
 await page.evaluate(()=>{document.querySelector('#modal').classList.remove('open');overlayTest.refreshActions()});assert(await page.locator('#touch').isVisible());
 await page.click('#touch');await page.evaluate(()=>overlayTest.voted());assert.equal(await page.locator('#touch').isVisible(),false);assert.equal(await page.locator('#modal').evaluate(e=>e.classList.contains('open')),false);
 for(const viewport of [{width:390,height:844},{width:1280,height:720}]){await page.setViewportSize(viewport);for(const value of ['00:10','01:00','99:59']){
  const offset=await page.evaluate(value=>{const digits=document.querySelector('#clockSeconds');digits.textContent=value;const range=document.createRange();range.selectNodeContents(digits);const r=range.getBoundingClientRect(),box=document.querySelector('#clock').getBoundingClientRect();return Math.abs((r.left+r.right)/2-(box.left+box.right)/2);},value);assert(offset<1,`countdown center offset ${offset}`);
 }}
 const lensInFront=await page.locator('#revealChair svg').evaluate(svg=>svg.firstElementChild.tagName==='path'&&svg.children[1].tagName==='circle');assert(lensInFront);
 await page.evaluate(source=>{
  eval(`let state={phase:'search',players:{other:{x:2,z:0,y:0,online:true}}},me={x:0,z:0},playerHeight=0,modalMode='trade',tradePartner={id:'other'},pinShareTarget=null;const modal=document.querySelector('#modal');function setMiniExpanded(v){if(!v)pinShareTarget=null;}`+source+`;window.giftTest={sync:syncGiftInteraction,moveAway:()=>{state.players.other.x=4;syncGiftInteraction()},teach:()=>{modalMode='';pinShareTarget='other';state.players.other.x=2;syncGiftInteraction()},target:()=>pinShareTarget};`);
  document.querySelector('#modal').classList.add('open');document.querySelector('#pickupCoin').hidden=false;window.giftTest.sync();
 },cut('function giftsAllowed','function nearestPartner')+cut('function syncGiftInteraction','async function shareChairPin'));
 assert.equal(await page.locator('#pickupCoin').isVisible(),false);
 await page.evaluate(()=>giftTest.moveAway());assert.equal(await page.locator('#modal').evaluate(e=>e.classList.contains('open')),false);assert(await page.locator('#pickupCoin').isVisible());
 await page.evaluate(()=>giftTest.teach());assert.equal(await page.locator('#pickupCoin').isVisible(),false);
 await page.evaluate(()=>giftTest.moveAway());assert.equal(await page.evaluate(()=>giftTest.target()),null);assert(await page.locator('#pickupCoin').isVisible());
 console.log('Vote button hidden while choosing/after voting; countdown centered on mobile/desktop; lens painted in front');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
