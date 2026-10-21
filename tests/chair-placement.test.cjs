const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const world=fs.readFileSync(path.join(__dirname,'fixtures/navigation-world.json'),'utf8');
function setup(){
 const context=vm.createContext({assert});
 const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 vm.runInContext(`const {obstacles,hidingSpots,buildingSites,stairways,largeBuildings,VOTE_X,VOTE_Z}=${world};let playerHeight=0;const roofRoomWalls=[];
 let seed=93284;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ${cut('function roofEdgeBlocked','// Intro-only closed entrance:')}
 ${cut('function seedChairs(){','function log(s)')}`,context);
 return code=>vm.runInContext(code,context);
}
test('500 games randomize visible and hidden chairs without terrain or chair overlap',()=>setup()(`
 let previous=null;
 for(let game=0;game<500;game++){
  const chairs=seedChairs(),all=Object.values(chairs);
  assert.equal(all.length,15);
  assert.equal(all.filter(c=>c.hiddenAt).length,6);
  assert.equal(new Set(all.filter(c=>c.hiddenAt).map(c=>c.hiddenAt)).size,6);
  for(let i=0;i<all.length;i++){
   const c=all[i];
   for(let j=0;j<i;j++)assert(Math.hypot(c.x-all[j].x,c.z-all[j].z)>=4);
   if(c.hiddenAt){assert(hidingSpots.some(s=>s.id===c.hiddenAt&&s.x===c.x&&s.z===c.z));continue;}
   assert(Math.hypot(c.x,c.z)<=288);
   assert(!staticBlocked(c.x,c.z,1.2));assert(!bushBlocked(c.x,c.z,1.2));
   assert(!stairways.some(st=>c.x>st.minX-1.2&&c.x<st.maxX+1.2&&c.z>st.back-1.2&&c.z<st.front+1.2));
  }
  if(previous){for(let i=7;i<=15;i++)assert(chairs[i].x!==previous[i].x||chairs[i].z!==previous[i].z);assert(all.slice(0,6).some((c,i)=>c.hiddenAt!==previous[i+1].hiddenAt));}
  previous=chairs;
 }
`));
test('ground placement ignores host elevation and restores it',()=>setup()(`
 playerHeight=16;const chairs=seedChairs();assert.equal(playerHeight,16);
 playerHeight=0;for(const c of Object.values(chairs))if(!c.hiddenAt)assert(!staticBlocked(c.x,c.z,1.2));
`));
