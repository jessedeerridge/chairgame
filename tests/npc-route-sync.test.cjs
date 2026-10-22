const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('const npcPreloadedJobs='),end=html.indexOf('// Plan the complete outdoor routes',start);
function setup(){
 const c=vm.createContext({assert});
 vm.runInContext(`
 const room='TEST',buildingSites=[{},{},{},{x:0,z:0,d:44}];
 function npcDepartureSlot(){return 0}function insideBlackBuilding(){return true}function npcStaticClearPath(){return false}
 function npcCreateSearch(s,start,goal){return {nodes:new Map([[1,{n:1}]]),goal,done:false,steps:0,path:null}}
 function npcAdvanceSearch(s,job){assert(job.nodes instanceof Map,'search Map was sent through Firebase');job.steps++;if(job.steps===2){job.done=true;job.path=[job.goal]}}
 `+html.slice(start,end),c);
 return code=>vm.runInContext(code,c);
}
test('unfinished outdoor route survives serialized online transactions and completes',()=>setup()(`
 const s={started:1,round:1},p={x:0,z:0,goal:{x:100,z:100},npcFixedAssignment:{x:100,z:100}};
 npcPreloadAssignedRoute(s,'NPC0',p);npcAdvancePreloadedRoute(s,p);
 const remote=JSON.parse(JSON.stringify(p));npcAdvancePreloadedRoute(s,remote);
 assert.deepEqual(remote.npcPreloadedRoute.path,[{x:100,z:100}]);
 assert(!remote.npcPreloadedRoute.job);assert(!remote.npcPreloadedRoute.pending);
`));
test('shared route state contains no host-only search objects',()=>setup()(`
 const s={started:1,round:1},p={goal:{x:100,z:100},npcFixedAssignment:{x:100,z:100}};
 npcPreloadAssignedRoute(s,'NPC0',p);
 assert(!p.npcPreloadedRoute.job,'A-star job must stay in local cache');
`));
test('a replacement host rebuilds pending work from serialized route metadata',()=>setup()(`
 const s={started:1,round:1},p={goal:{x:100,z:100},npcFixedAssignment:{x:100,z:100}};
 npcPreloadAssignedRoute(s,'NPC0',p);npcAdvancePreloadedRoute(s,p);
 const remote=JSON.parse(JSON.stringify(p));npcPreloadedJobs.clear();
 npcAdvancePreloadedRoute(s,remote);npcAdvancePreloadedRoute(s,remote);
 assert.deepEqual(remote.npcPreloadedRoute.path,[{x:100,z:100}]);
`));
test('legacy corrupted jobs are removed and recalculated locally',()=>setup()(`
 const s={started:1,round:1},p={npcPreloadedRoute:{round:1,from:{x:0,z:33},goal:{x:100,z:100},path:null,job:{nodes:{}}}};
 npcAdvancePreloadedRoute(s,p);npcAdvancePreloadedRoute(s,p);
 assert(!p.npcPreloadedRoute.job);assert.deepEqual(p.npcPreloadedRoute.path,[{x:100,z:100}]);
`));
