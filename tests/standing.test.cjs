const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),world=fs.readFileSync(path.join(__dirname,'fixtures/navigation-world.json'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function run(code){vm.runInNewContext(`const {buildingSites,stairways,obstacles,hidingSpots,VOTE_X,VOTE_Z}=${world};const largeBuildings=buildingSites.map(b=>({...b,doorW:13,stairs:true}));let playerHeight=0,roofRoomWalls=[],id='local',me={x:0,z:0},state={phase:'search',players:{local:{sitting:1}},chairs:{}},button={};const $=()=>button;function player(){return state.players.local}function mutate(fn){fn(state)}`+cut('function stairSurface','// One seed describes')+cut('function roofEdgeBlocked','function validChairPosition')+cut('function findStandingSpot','// Five-second hide/search')+code,{assert});}
test('standing at a rooftop edge stays on the roof and preserves synchronized height',()=>run(`
 const b=largeBuildings[0],level=b.h+1.2,c={x:b.x+b.w/2-1.3,z:b.z+b.d/2-1.3,y:level,occupied:id};state.chairs[1]=c;Object.assign(state.players.local,{x:c.x,z:c.z,y:level});playerHeight=level;Object.assign(me,{x:c.x,z:c.z});
 button.onclick();const p=state.players.local;assert.equal(p.sitting,0);assert.equal(p.y,level);assert.equal(playerHeight,level);assert.equal(elevationAt(p.x,p.z),level);assert.equal(c.occupied,null);
 for(const [dx,dz] of [[-.6,-.6],[-.6,.6],[.6,-.6],[.6,.6]])assert.equal(elevationAt(p.x+dx,p.z+dz),level);
`));
test('no safe supported exit leaves the player seated rather than moving them to ground',()=>run(`
 const c={x:0,z:0,y:16.2,occupied:id};state.chairs[1]=c;state.players.local.y=16.2;playerHeight=16.2;
 occupiedAt=()=>true;button.onclick();assert.equal(state.players.local.sitting,1);assert.equal(c.occupied,id);assert.equal(playerHeight,16.2);
`));
