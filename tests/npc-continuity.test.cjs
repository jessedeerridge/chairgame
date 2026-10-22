const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i);return html.slice(i,j)}
function navigation(){const c=vm.createContext({assert});vm.runInContext(`
 const room='TEST',npcNavigation=new Map();
 function npcDoorTransitTarget(){return null}function npcStaticClearPath(s,x,z,tx,tz){return tx>=0&&tx<10}
 function npcMovementClear(){return false}function npcNearDoorOrCorner(){return false}
 function insideBlackBuilding(){return false}function npcFixedObstacleRoute(){return null}
 `+cut('function npcNavigationTarget','function npcSegmentDistance2'),c);return code=>vm.runInContext(code,c)}
test('another actor on the path reaches local avoidance instead of stopping navigation',()=>navigation()(`
 const s={round:1},p={x:0,z:0,goal:{x:100,z:0}};
 npcNavigation.set('TEST:NPC0',{goal:p.goal,path:[{x:4,z:0},{x:6,z:0}],cursor:0,job:null});
 assert.deepEqual(npcNavigationTarget(s,'NPC0',p,1000),{x:4,z:0});
 assert.equal(npcNavigation.get('TEST:NPC0').job,null);
`));
test('completed preload joins a reachable forward node when its first node is blocked',()=>navigation()(`
 const s={round:1},p={x:0,z:0,goal:{x:100,z:0},npcPreloadedRoute:{round:1,goal:{x:100,z:0},path:[{x:-1,z:0},{x:4,z:0},{x:6,z:0}]}};
 assert.deepEqual(npcNavigationTarget(s,'NPC0',p,1000),{x:4,z:0});
 assert.equal(npcNavigation.get('TEST:NPC0').path.length,2);
`));
function movement(){const c=vm.createContext({assert});vm.runInContext(`
 function npcMovementClear(){return true}function npcDetourIntoBuilding(){return true}
 function npcNavigationTarget(s,k,p){return {x:p.x+.4,z:0}}
 `+cut('function npcMove(s,','// NPC hide-spot inspection'),c);return code=>vm.runInContext(code,c)}
test('ordinary walking accepts the same wall clearance as the terrain planner',()=>movement()(`
 const p={x:0,z:0};assert(npcMove({},'NPC0',p,{x:10,z:0},5,.28)>1.39);
 assert(Math.abs(p.x-1.4)<.001);
`));
test('unused movement crosses several short waypoints in the same tick',()=>movement()(`
 const p={x:0,z:0,goal:{x:100,z:0}};
 npcMoveAlongRoute({},'NPC0',p,{x:.4,z:0},5,.28,1000);
 assert(Math.abs(p.x-1.4)<.001,'each waypoint consumed a whole simulation tick');
`));

test('front-wall protection blocks the facade but permits crossing its distant extension',()=>{
 const c=vm.createContext({assert});
 vm.runInContext(`const buildingSites=[{},{},{},{x:0,z:0,w:50,d:44}],largeBuildings=[{},{},{},{doorW:13}];`+
 cut('function npcForbiddenFrontExit','function npcNavigationTarget')+`
 assert.equal(npcForbiddenFrontExit(-120,21.9,-120,23),false);
 assert.equal(npcForbiddenFrontExit(120,21.9,120,23),false);
 assert.equal(npcForbiddenFrontExit(20,21.9,20,23),true);
 assert.equal(npcForbiddenFrontExit(0,21.9,0,23),false);
 `,c);
});
test('a nearby corner waypoint is retained when skipping it would cut through terrain',()=>navigation()(`
 const s={round:1},p={x:0,z:0,goal:{x:100,z:0}};
 npcNavigation.set('TEST:NPC0',{goal:p.goal,path:[{x:1,z:0},{x:-1,z:1}],cursor:0,job:null});
 assert.deepEqual(npcNavigationTarget(s,'NPC0',p,1000),{x:1,z:0});
 assert.equal(npcNavigation.get('TEST:NPC0').cursor,0);
`));
