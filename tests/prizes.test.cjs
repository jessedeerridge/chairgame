const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function run(code){vm.runInNewContext(`const assert=globalThis.assert;let worldReady=true;const SEARCH_MS=90000,RETURN_MS=40000;`+cut('function prizeCoinCount','function paintPrizeMedals')+cut('function advanceState(s,now)','let advancing=false;')+code,{assert});}
test('prizes count only coins issued by the last surviving winner',()=>run(`
 const s={winner:'last',players:{last:{}}};assert.equal(prizeCoinCount(s,{wallet:{last:3,other:100,older:200}}),3);
 assert.equal(prizeCoinCount(s,{wallet:{other:100}}),0);assert.equal(prizeCoinCount(s,{}),0);
 s.winner=null;assert.equal(prizeCoinCount(s,{wallet:{last:3,other:100}}),0);
`));
test('no survivors produce no champion, first-place rank, or prize',()=>run(`
 const s={phase:'search',round:2,deadline:0,players:{a:{alive:true,sitting:0,wallet:{a:23,b:23}},b:{alive:true,sitting:0,wallet:{a:23,b:23}}}};
 advanceState(s,1);assert.equal(s.phase,'finished');assert.equal(s.winner,null);
 assert(!Object.values(s.finalRanks).includes(1));for(const p of Object.values(s.players))assert.equal(prizeCoinCount(s,p),0);
`));
test('a sole survivor remains first and their issuer determines every player prize',()=>run(`
 const s={phase:'search',round:2,deadline:0,players:{a:{alive:true,sitting:1,wallet:{a:7,b:16}},b:{alive:true,sitting:0,wallet:{a:4,b:50}}}};
 advanceState(s,1);assert.equal(s.winner,'a');assert.equal(s.finalRanks.a,1);assert.equal(s.finalRanks.b,2);
 assert.equal(prizeCoinCount(s,s.players.a),7);assert.equal(prizeCoinCount(s,s.players.b),4);
`));
test('zero-prize players fall smoothly once around the ankle pivot and reset next game',()=>run(`
 const s={phase:'finished',started:10,winner:'last',players:{last:{}}},p={initial:true,wallet:{other:100}},label={position:{set(x,y,z){this.x=x;this.y=y;this.z=z}}},avatar={userData:{pose:{position:{y:.62},rotation:{x:0}},prizeSprite:label}};
 assert.equal(updateFinishedPose(avatar,s,p,0),0);const halfway=updateFinishedPose(avatar,s,p,550);assert(Math.abs(halfway-Math.PI/4)<1e-6);updateFinishedPose(avatar,s,p,1100);
 assert.equal(avatar.userData.pose.rotation.x,-Math.PI/2);assert.equal(avatar.userData.pose.position.y,.62);assert.equal(label.position.y,2.62);assert.equal(label.position.z,-2.13);
 updateFinishedPose(avatar,s,p,3000);assert.equal(avatar.userData.pose.rotation.x,-Math.PI/2);s.phase='instructions';updateFinishedPose(avatar,s,p,4000);assert.equal(avatar.userData.pose.rotation.x,0);
`));
test('zero prize movement uses the carried-chair slowdown, without stacking it twice',()=>run(`
 const s={phase:'finished',winner:'last',players:{last:{}}},p={initial:true,wallet:{last:0}};
 assert.equal(playerSpeedFactor(s,p),.5);p.carrying=1;assert.equal(playerSpeedFactor(s,p),.5);p.wallet.last=4;assert.equal(playerSpeedFactor(s,p),.5);p.carrying=0;assert.equal(playerSpeedFactor(s,p),1);s.phase='search';p.wallet.last=0;assert.equal(playerSpeedFactor(s,p),1);
`));
test('zero prize draws only a silver zero even when the stored rank is first',()=>{
 const output=[],ctx=new Proxy({fillText(text){output.push([text,this.fillStyle])},strokeText(){},clearRect(){},save(){},restore(){}},{get:(o,k)=>o[k]||(()=>{})});
 vm.runInNewContext(cut('function paintPrizeMedals','let walletViewKey')+`paintPrizeMedals(canvas,1,0);`,{canvas:{width:512,height:160,getContext:()=>ctx},drawMedalCanvas:()=>{throw Error('zero prize must not draw a gold medal')}});
 assert.deepEqual(output,[['0','#c8d2dc']]);
});
test('a zero-prize seated finalist releases their seat so they can move while lying down',()=>run(`
 const s={phase:'search',round:2,deadline:0,players:{a:{initial:true,alive:true,sitting:1,wallet:{a:0}},b:{initial:true,alive:true,sitting:0,wallet:{a:2}}},chairs:{1:{occupied:'a'}}};
 advanceState(s,1);assert.equal(s.winner,'a');assert.equal(s.players.a.sitting,0);assert.equal(s.chairs[1].occupied,null);assert(zeroPrizePlayer(s,s.players.a));assert(!zeroPrizePlayer(s,s.players.b));
`));
