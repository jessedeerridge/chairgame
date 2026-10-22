const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i);return html.slice(i,j)}
test('rendered world uses room geometry even when the local generator differs',()=>{
 const c=vm.createContext({assert,structuredClone});
 vm.runInContext(`let worldLayout=null;const buildingSites=[{},{},{}],largeBuildings=[{},{},{}],pathSegments=[],roadRenderSegments=[];
 function makeWorldLayout(){throw Error('client-local world generation replaced shared geometry')}
 `+cut('function configureWorld','function buildBuilding')+`
 const shared={seed:42,buildings:[{x:1},{x:2},{x:3}],paths:[{ax:5}],trees:[{x:123,z:45}],spots:[{id:'H0',x:8,z:9}]};
 configureWorld(42,shared);assert.equal(JSON.stringify(worldLayout),JSON.stringify(shared));assert.notEqual(worldLayout,shared);
 assert.equal(buildingSites[0].x,1);assert.equal(pathSegments[0].ax,5);
 `,c);
});
test('Firebase numeric chair arrays become maps and hidden chairs use the shared spot coordinates',()=>{
 const c=vm.createContext({assert});
 vm.runInContext(cut('function normalizeRoomCollections','function reconcileRoomPositions')+`
 const s={chairs:[null,{x:999,z:999,hiddenAt:'H0'},{x:10,z:20,carrier:'human',hiddenAt:'H0'}],worldLayout:{chairs:[null,{x:1,z:2}],spots:[{id:'H0',x:40,z:50}]}};
 normalizeRoomCollections(s);assert(!Array.isArray(s.chairs));assert.equal(Object.keys(s.chairs).length,2);
 assert.equal(s.chairs[1].x,40);assert.equal(s.chairs[1].z,50);assert.equal(s.chairs[2].x,10);assert(!Array.isArray(s.worldLayout.chairs));
 `,c);
});
function hideAction(committed){
 const c=vm.createContext({assert,console,committed});
 vm.runInContext(`
 const id='human',soloMode=false,worldReady=true,loadedWorldLayoutKey='test',roomWorldLayoutKey=()=> 'test';
 let clock=1000,spotAction=null,recentHiddenChair=null,playerHeight=0;
 const performance={now:()=>clock},roomNow=()=>clock,notes=[];
 const hidingSpots=[{id:'H0',x:20,z:40}],me={x:20,z:45};
 const state={phase:'search',players:{human:{x:20,z:45,carrying:7}},chairs:{7:{x:20,z:45,carrier:'human'}},worldLayout:{spots:[{id:'H0',x:22,z:41}]}};
 const player=()=>state.players.human,phase=()=>state.phase,closestSpot=()=>hidingSpots[0],$=()=>({}),upsertChairNote=(n,x,z)=>notes.push({n,x,z});
 async function mutate(fn){if(committed)fn(state);return{committed,snapshot:{val:()=>state}}}
 `+cut('function beginSpotAction',"$('moveChair').onclick"),c);
 return code=>vm.runInContext(code,c);
}
test('failed hiding transaction does not record an unconfirmed location',async()=>{
 await hideAction(false)(`(async()=>{beginSpotAction('hide');updateSpotAction(6001);for(let i=0;i<5;i++)await Promise.resolve();assert.equal(notes.length,0);assert.equal(recentHiddenChair,null)})()`);
});
test('hiding and map notes use the committed shared spot coordinates',async()=>{
 await hideAction(true)(`(async()=>{beginSpotAction('hide');updateSpotAction(6001);for(let i=0;i<5;i++)await Promise.resolve();assert.equal(state.chairs[7].hiddenAt,'H0');assert.equal(state.chairs[7].x,22);assert.equal(notes[0].x,22);assert.equal(notes[0].z,41);assert.equal(recentHiddenChair.x,22)})()`);
});
