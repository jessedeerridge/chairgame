const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function extract(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));}
function setup(){const ctx=vm.createContext({assert});vm.runInContext(`let state,playerHeight=0,id='me',me={x:0,z:0};function players(){return Object.entries(state.players)};`+extract('function giftsAllowed','async function shareChairPin')+extract('function voteResultLayout','function paintVoteWall'),ctx);return s=>vm.runInContext(s,ctx);}
test('gifts begin at first seating and accept small height differences, not stacked floors',()=>setup()(`
 const a={x:0,z:0,y:5},b={x:1,z:1,y:5.8};
 for(const phase of ['lobby','instructions','finished'])assert.equal(canGiveTo({phase},a,b),false);
 for(const phase of ['sitIntro','search','return','vote','results','erase'])assert.equal(canGiveTo({phase},a,b),true);
 assert.equal(canGiveTo({phase:'search'},a,{...b,y:0}),false);
 assert.equal(canGiveTo({phase:'search'},a,{...b,y:6.5}),true);
 assert.equal(canGiveTo({phase:'search'},a,{...b,y:6.51}),false);
 assert.equal(canGiveTo({phase:'search'},a,{...b,x:5}),false);
 state={phase:'search',players:{below:{x:0,z:.1,y:0},near:{...b,name:'near'}}};playerHeight=5;
 assert.equal(nearestPartner().id,'near');state.phase='instructions';assert.equal(nearestPartner(),null);
`));
test('all tied leaders enlarge within reserved rows, including a full 20-person result',()=>setup()(`
 for(const count of [1,7,8,20])for(const tied of [1,3,20]){
  const voteCounts=Object.fromEntries(Array.from({length:count},(_,i)=>['p'+i,i<tied?5:1]));
  const boxes=voteResultLayout({voteCounts});assert.equal(boxes.length,count);
  assert.equal(boxes.filter(b=>b.leader).length,Math.min(tied,count));
  for(const a of boxes){assert(a.y>=154&&a.y+a.height<=684.001);for(const b of boxes){if(a===b)continue;assert(a.left+a.width<b.left||b.left+b.width<a.left||a.y+a.height<b.y||b.y+b.height<a.y);}}
 }
`));
test('hidden-chair marking requires staying near the hiding position and rechecks on click',()=>{
 const ctx=vm.createContext({assert});
 vm.runInContext(`let me={x:0,z:0},playerHeight=0,recentHiddenChair={number:'1',x:5,z:0,anchorX:0,anchorZ:0,y:0,at:Date.now()},state={chairs:{1:{x:5,z:0,hiddenAt:'tree'}}};let marks=0;const button={},$=()=>button;function upsertChairNote(){marks++}function closestBackChair(){return null}function refreshActions(){}`+extract('function nearbyHiddenChairForMark',"$('sit').onclick")+`
 assert(nearbyHiddenChairForMark());button.onclick();assert.equal(marks,1);
 me.x=-3;assert.equal(nearbyHiddenChairForMark(),null);button.onclick();assert.equal(marks,1);
 me.x=0;playerHeight=5;assert.equal(nearbyHiddenChairForMark(),null);playerHeight=0;
 state.chairs[1].hiddenAt=null;assert.equal(nearbyHiddenChairForMark(),null);
 state.chairs[1].hiddenAt='tree';state.chairs[1].x=20;assert.equal(nearbyHiddenChairForMark(),null);
 state.chairs[1].x=5;recentHiddenChair.at-=6000;assert.equal(nearbyHiddenChairForMark(),null);
 `,ctx);
});
test('seated player can mark their occupied chair, but not a removed or reassigned chair',()=>{
 const ctx=vm.createContext({assert});vm.runInContext(`let id='me',me={x:10,z:10},playerHeight=0,recentHiddenChair=null,state={players:{me:{sitting:2}},chairs:{2:{x:10,z:10,occupied:'me'}}};const button={},$=()=>button,marks=[];function upsertChairNote(...note){marks.push(note)}function refreshActions(){}`+extract('function nearChairBack',"$('sit').onclick")+`
 assert.equal(closestBackChair()[0],'2');button.onclick();assert.deepEqual(marks[0],['2',10,10]);
 state.chairs[2].removed=true;assert.equal(closestBackChair(),undefined);button.onclick();assert.equal(marks.length,1);
 state.chairs[2].removed=false;state.chairs[2].occupied='other';assert.equal(closestBackChair(),undefined);
 `,ctx);
});
test('map unlocks on first exterior exit, stays open after returning, and resets for a new game',()=>{
 const ctx=vm.createContext({assert});vm.runInContext(`let state={phase:'instructions',started:1,players:{me:{}}},room='TEST',id='me',me={x:0,z:12},miniExpanded=false;const buildingSites=[{},{},{},{x:0,z:0,w:50,d:44}],classes=new Set();const document={body:{classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}}};function setMiniExpanded(v){miniExpanded=v}`+extract('let mapVisitKey=','function setMiniExpanded')+`
 updateMapVisibility();assert(classes.has('map-locked'));state.phase='search';me.z=22;updateMapVisibility();assert(classes.has('map-locked'));
 me.z=23;updateMapVisibility();assert(mapUnlocked);assert(!classes.has('map-locked'));me.z=0;state.phase='vote';updateMapVisibility();assert(mapUnlocked);
 state.players.me.mapUnlockedFor=mapVisitKey;mapVisitKey=null;mapUnlocked=false;updateMapVisibility();assert(mapUnlocked,'reconnect lost first exit');
 state.started=2;miniExpanded=true;updateMapVisibility();assert(classes.has('map-locked'));assert(!miniExpanded);
 `,ctx);
});
test('sharing a recorded chair prefills its number and exact saved coordinates while allowing edits',()=>{
 const ctx=vm.createContext({assert});vm.runInContext(`
 let miniExpanded=true,pinShareTarget='friend',selectedMapNote=-1,pendingMapSpot=null,mapNumberValue='',sent=null;
 const miniNotes=[{number:'7',x:100.25,z:-30.75}],mapEditor={hidden:true},mapDisplay={},mapEraser={classList:{remove(){}}},handlers={};
 const miniCanvas={width:768,height:768,addEventListener:(type,fn)=>handlers[type]=fn,getBoundingClientRect:()=>({left:0,top:0,right:768,width:768,height:768})};
 function miniParams(){return {scale:1}}function miniWorld(){return {x:102,z:-29}}function highestChairNumber(){return 15}function resetMapNumber(){throw Error('unexpected invalid number')}function hideMapSelection(){pendingMapSpot=null}function setMiniExpanded(v){miniExpanded=v}function shareChairPin(...args){sent=args}function drawMiniMap(){}function upsertChairNote(){throw Error('sharing must not change own note')}
 `+extract('function showMapEditor','function saveMapNumber')+extract('function saveMapNumber',"$('mapNumberSave')")+extract("miniCanvas.addEventListener('pointerdown'","for(const type of ['pointermove'")+`
 handlers.click({stopPropagation(){},clientX:200,clientY:200});assert.equal(mapNumberValue,'7');assert.equal(mapDisplay.textContent,'7');assert.equal(mapEditor.hidden,false);assert.deepEqual(pendingMapSpot,{x:100.25,z:-30.75});
 mapNumberValue='8';saveMapNumber();assert.deepEqual(sent,['friend','8',100.25,-30.75]);assert.equal(miniNotes[0].number,'7');
 `,ctx);
});
test('gift dialogs close at the interaction boundary and keep their original nearby recipient',()=>setup()(`
 let modalMode='trade',tradePartner={id:'other'},pinShareTarget=null,miniExpanded=false;
 const classes=new Set(),modalClasses=new Set(['open']);
 const document={body:{classList:{toggle(k,on){on?classes.add(k):classes.delete(k)},remove(k){classes.delete(k)}}}};
 const modal={classList:{contains:k=>modalClasses.has(k),remove:k=>modalClasses.delete(k)}};
 function setMiniExpanded(v){miniExpanded=v;if(!v)pinShareTarget=null;}
 state={phase:'search',players:{other:{x:3.99,z:0,y:0,online:true},closer:{x:1,z:0,y:0}}};
 assert(syncGiftInteraction());assert(classes.has('gift-overlay'));assert(modalClasses.has('open'),'a nearer third person must not cancel the original recipient');
 state.players.other.x=4;assert.equal(syncGiftInteraction(),false);assert(!modalClasses.has('open'));assert(!classes.has('gift-overlay'));assert.equal(tradePartner,null);
 state.players.other.x=2;pinShareTarget='other';miniExpanded=true;assert(syncGiftInteraction());assert(classes.has('gift-overlay'));
 state.players.other.y=1.51;assert.equal(syncGiftInteraction(),false);assert(!miniExpanded);assert.equal(pinShareTarget,null);assert(!classes.has('gift-overlay'));
 state.players.other.y=0;pinShareTarget='other';miniExpanded=true;state.players.other.online=false;assert.equal(syncGiftInteraction(),false);assert(!miniExpanded);
`));
