const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i);return html.slice(i,j)}
function setup(){const c=vm.createContext({assert});vm.runInContext(`
 let clock=1000,timerId=0,soloMode=false,room='TEST',id='human',modalMode='trade';
 const timers=new Map(),elements={},logs=[],alerts=[],npcNavigation=new Map(),me={x:0,z:0},playerHeight=0;
 const $=k=>elements[k]||null,log=s=>logs.push(s),alert=s=>alerts.push(s),roomNow=()=>clock;
 const setTimeout=(fn,delay)=>{timers.set(++timerId,{fn,at:clock+delay,delay});return timerId},clearTimeout=id=>timers.delete(id);
 function advanceTime(ms){clock+=ms;for(const [id,t] of timers)if(t.at<=clock){timers.delete(id);t.fn()}}
 const document={createElement:()=>({setAttribute(){}}),body:{appendChild:el=>elements[el.id]=el}};
 const state={round:2,phase:'search',players:{human:{alive:true,wallet:{human:10},x:0,z:0},npc:{npc:true,team:'アキヤマ',alive:true,x:1,z:0}},chairs:{7:{x:40,z:50}}};
 const npcBestMemory=(old,m)=>m,npcShareTeamChairMemory=()=>{},canGiveTo=()=>true,syncGiftInteraction=()=>true;
 const tradePartner={id:'npc'},modal={classList:{remove(){}}};elements.modalConfirm={};elements.tradeAmount={value:'2'};elements.tradeIssuer={value:'human'};
 async function mutate(fn){fn(state);return {committed:true}}
 `+cut('function showNPCReply','let lastPinInboxStamp')+cut("$('modalConfirm').onclick=",'// Action buttons are refreshed'),c);return code=>vm.runInContext(code,c)}
test('team NPC coin refusal uses a three-second game popup without a system dialog',async()=>setup()(`(async()=>{
 await elements.modalConfirm.onclick();assert.deepEqual(alerts,[]);assert.equal(elements.npcReplyPopup.textContent,'いらないです...');assert.equal(elements.npcReplyPopup.hidden,false);
 assert.equal(state.players.human.wallet.human,8);assert.equal(Object.values(state.coinDrops)[0].count,2);
 advanceTime(2999);assert.equal(elements.npcReplyPopup.hidden,false);advanceTime(1);assert.equal(elements.npcReplyPopup.hidden,true);
})()`));
test('known lies use うそだ！ for both coin and pin refusals without system dialogs',async()=>setup()(`(async()=>{
 state.players.human.npcDealLieScopes={'team:アキヤマ':1};
 await elements.modalConfirm.onclick();assert.equal(elements.npcReplyPopup.textContent,'うそだ！');
 await shareChairPin('npc','7',40,50);assert.equal(elements.npcReplyPopup.textContent,'うそだ！');assert.deepEqual(alerts,[]);
})()`));
test('duplicate chair pins show いらないです... and reset the popup lifetime',async()=>setup()(`(async()=>{
 await shareChairPin('npc','7',40,50);advanceTime(2000);
 await shareChairPin('npc','7',40,50);assert.equal(elements.npcReplyPopup.textContent,'いらないです...');assert.deepEqual(alerts,[]);
 advanceTime(2999);assert.equal(elements.npcReplyPopup.hidden,false);advanceTime(1);assert.equal(elements.npcReplyPopup.hidden,true);
})()`));
test('received chair-information popup omits the truth-status label',()=>setup()(`
 state.players.npc.team='ガヤ';Math.random=()=>.6;
 const message=npcDealPin(state,'human','npc','7',0,0);
 assert.equal(message,'NPCからイス1の情報を受け取った');assert(state.players.human.pinInbox);
`));
