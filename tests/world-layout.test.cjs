const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('// One seed describes'),html.indexOf('function buildBuilding'));
function generate(seed){const c=vm.createContext({});return JSON.parse(JSON.stringify(vm.runInContext(code+`;makeWorldLayout(${seed})`,c)));}
function distance(x,z,p){const dx=p.bx-p.ax,dz=p.bz-p.az,t=Math.max(0,Math.min(1,((x-p.ax)*dx+(z-p.az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-p.ax-t*dx,z-p.az-t*dz);}
function inside(x,z,q,r){return x>q.minX-r&&x<q.maxX+r&&z>q.minZ-r&&z<q.maxZ+r;}
test('100 seeds preserve spacing, hiding, connected roads and collision-free footprints',()=>{
 for(let seed=1;seed<=100;seed++){
  const w=generate(seed),objects=[...w.trees,...w.spots,...w.signs],chairs=Object.values(w.chairs);
  assert.deepEqual(w.buildings[3],{x:0,z:0,w:50,d:44,h:15});
  assert.equal(chairs.length,15);assert.equal(chairs.filter(c=>c.hiddenAt).length,6);assert.equal(new Set(chairs.filter(c=>c.hiddenAt).map(c=>c.hiddenAt)).size,6);
  assert(w.spots.filter(p=>p.type==='bush').length>=140);assert(w.spots.filter(p=>p.type==='tree').length>=35);assert(w.trees.length>=300);assert(w.signs.length>=30);
  assert(w.trees.some(p=>p.style==='row'));assert(w.trees.some(p=>p.style==='grove'));assert(w.spots.some(p=>p.style==='row'||p.style==='grove'));
  for(let i=0;i<w.zones.length;i++)for(let j=0;j<i;j++){
   const a=w.zones[i],b=w.zones[j];assert(!(a.minX<b.maxX+55&&a.maxX>b.minX-55&&a.minZ<b.maxZ+55&&a.maxZ>b.minZ-55));
  }
  for(let i=0;i<objects.length;i++){
   const p=objects[i];assert(Math.hypot(p.x,p.z)+p.r+2<=288+1e-6);
   assert(!w.zones.some(q=>inside(p.x,p.z,q,p.r+2)));
   for(let j=0;j<i;j++){const q=objects[j];assert(Math.hypot(p.x-q.x,p.z-q.z)>=p.r+q.r+.8-1e-6,`overlap seed ${seed}`);}
   for(const road of w.paths)assert(distance(p.x,p.z,road)>=road.width/2+p.r+(p.variant===undefined?1.6:1)-1e-6);
   if(p.type)assert(!(Math.abs(p.x)<50&&Math.abs(p.z)<47));
  }
  for(let i=0;i<w.signs.length;i++)for(let j=0;j<i;j++)assert(Math.hypot(w.signs[i].x-w.signs[j].x,w.signs[i].z-w.signs[j].z)>=25);
  for(let i=0;i<chairs.length;i++){
   const c=chairs[i];for(let j=0;j<i;j++)assert(Math.hypot(c.x-chairs[j].x,c.z-chairs[j].z)>=4);
   if(c.hiddenAt){assert(w.spots.some(p=>p.id===c.hiddenAt&&p.x===c.x&&p.z===c.z));continue;}
   assert(!w.zones.some(q=>inside(c.x,c.z,q,3.3)));
   for(const p of objects)assert(Math.hypot(c.x-p.x,c.z-p.z)>=p.r+1.3+.8-1e-6);
  }
  // Road half-width plus raster cell corners stays outside all building/stair zones.
  for(const p of w.paths){const steps=Math.ceil(Math.hypot(p.bx-p.ax,p.bz-p.az));for(let i=0;i<=steps;i++){
   const x=p.ax+(p.bx-p.ax)*i/steps,z=p.az+(p.bz-p.az)*i/steps;
   assert(!w.zones.some(q=>inside(x,z,q,p.width/2+1.4)),`road intersects stairs/building seed ${seed}`);
  }}
  const reached=new Set([0]);let changed=true;
  while(changed){changed=false;for(let i=0;i<w.paths.length;i++)if(!reached.has(i)){
   const a=w.paths[i];if([...reached].some(j=>{const b=w.paths[j];return Math.min(distance(a.ax,a.az,b),distance(a.bx,a.bz,b),distance(b.ax,b.az,a),distance(b.bx,b.bz,a))<.01;})){reached.add(i);changed=true;}
  }}assert.equal(reached.size,w.paths.length,'disconnected road');
 }
});
test('seed reproduces the complete world and changes every requested object category',()=>{
 const a=generate(123456),b=generate(654321);assert.deepEqual(generate(123456),a);
 for(const field of ['buildings','paths','trees','spots','signs','chairs'])assert.notDeepEqual(a[field],b[field],field+' stayed fixed');
});
test('personal map notes survive reentry but are cleared for a different island seed',()=>{
 const start=html.indexOf('function restorePersonalMap'),end=html.indexOf('\nsetInterval',start);
 const context=vm.createContext({assert});
 vm.runInContext(`let room='ROOM',state={worldSeed:55},mapRestored=false,personalMapSession=null;const miniNotes=[],explored=new Set();function drawMiniMap(){}
`+html.slice(start,end)+`

 const p={mapData:{worldSeed:55,notes:[{number:'7',x:10,z:20}],explored:['1,2']}};
 restorePersonalMap(p);assert.equal(miniNotes.length,1);assert(explored.has('1,2'));
 miniNotes.push({number:'8',x:20,z:30});restorePersonalMap(p);assert.equal(miniNotes.length,2);
 state.worldSeed=66;restorePersonalMap(p);assert.equal(miniNotes.length,0);assert.equal(explored.size,0);
 `,context);
});
