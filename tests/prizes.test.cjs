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
