const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('let roomFocusSession='),html.indexOf('let stackIdle=null;'));
function check(source){const ctx=vm.createContext({assert});vm.runInContext(`let state={phase:'instructions',round:1},me={x:0,z:12},playerHeight=0,yaw=1,pitch=.5;const voteWallZ=-18,buildingSites=[{},{},{},{d:44}];const insideBlackBuilding=(x,z)=>Math.abs(x)<23.8&&Math.abs(z)<20.8;`+code+source,ctx);}
test('screen guidance applies only inside the black room and keeps movement state untouched',()=>check(`
 for(const phase of ['instructions','voteIntro','vote','results','erase','eraseReveal','finished']){state.phase=phase;assert.equal(guideRoomView(100),'screen');assert.equal(yaw,Math.PI);assert.equal(pitch,0);assert.equal(me.z,12);}
 for(const phase of ['lobby','search','return']){state.phase=phase;assert.equal(guideRoomView(100),null);}
 state.phase='instructions';me.z=50;assert.equal(guideRoomView(100),null);me.z=12;playerHeight=9;assert.equal(guideRoomView(100),null);
`));
test('seating announcement stays visible before guidance turns to the door each round',()=>check(`
 state.phase='sitIntro';assert.equal(roomCameraFocus(100),'screen');assert.equal(roomCameraFocus(999),'screen');assert.equal(guideRoomView(1000),'door');assert.equal(yaw,0);
 state.phase='search';assert.equal(roomCameraFocus(1100),null);state.round=2;state.phase='sitIntro';assert.equal(roomCameraFocus(5000),'screen');assert.equal(roomCameraFocus(5900),'door');
`));
test('wall clipping shortens the TPS orbit without moving it diagonally off the player-screen line',()=>check(`
 const b={x:0,z:0,w:50,d:44};assert.equal(roomOrbitDistance(0,0,Math.PI,b),10);
 const orbitYaw=Math.atan2(8,-38),distance=roomOrbitDistance(-8,20,orbitYaw,b);
 const x=-8-Math.sin(orbitYaw)*distance,z=20-Math.cos(orbitYaw)*distance;
 assert(distance>0&&distance<1);assert(Math.abs(z-20.75)<.00001);assert(Math.abs(x-(-8-8/38*.75))<.00001);
`));
test('screen lens magnifies the normal distant view without exceeding the natural field of view',()=>check(`
 const desktop=screenCameraFov(0,3.4,20.75,0,0,12,1280/720),mobile=screenCameraFov(0,3.4,20.75,0,0,12,390/844);
 assert(desktop>=45&&desktop<46);assert(Math.tan(65*Math.PI/360)/Math.tan(desktop*Math.PI/360)>1.5);
 assert(mobile>=desktop&&mobile<=65);
 const wall=screenCameraFov(0,3.4,20.75,0,0,19.8,1280/720);assert(wall>desktop&&wall<=65);
`));
