const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function characterMovementBlocked'),end=html.indexOf('function validChairPosition',start);
function run(code){vm.runInNewContext(`let id='me',me={x:-5,z:0},playerHeight=0,state={players:{me:{x:-5,z:0},other:{x:0,z:0,y:0,alive:true}},chairs:{}};const avatars={};function staticBlocked(){return false}function blackEntranceClosed(){return false}function openedDoorBlocked(){return false}function bushBlocked(){return false}function player(){return state.players.me}`+html.slice(start,end)+code,{assert});}
test('sweeps block crossing a standing body even when both endpoints are clear',()=>run(`
 assert(characterMovementBlocked(state,id,-3,0,3,0,0));
 assert(!characterMovementBlocked(state,id,-3,2,3,2,0));
 state.players.other.alive=false;assert(characterMovementBlocked(state,id,-3,0,3,0,0));
`));
test('visible position and shared position both block movement through remote bodies',()=>run(`
 state.players.other.x=10;avatars.other={visible:true,position:{x:0,z:0,y:0}};
 assert(characterMovementBlocked(state,id,-3,0,3,0,0,true));assert(!characterMovementBlocked(state,id,-3,0,3,0,0,false));
 assert(characterMovementBlocked(state,id,7,0,13,0,0,true));assert(blocked(0,0));
`));
test('carrying, seated and eliminated characters keep collision; different floors do not block',()=>run(`
 state.players.other.carrying=1;state.players.other.alive=false;assert(blocked(0,0));
 state.players.other.sitting=2;state.chairs[2]={x:0,z:0,y:0,removed:false};assert(blocked(0,0));
 state.chairs[2].y=16;assert(!characterMovementBlocked(state,id,-3,0,3,0,0));
 state.players.other.sitting=0;state.players.other.y=16;assert(!characterMovementBlocked(state,id,-3,0,3,0,0));
 state.players.other.online=false;assert(!characterMovementBlocked(state,id,-3,0,3,0,16));
`));
test('existing overlaps may separate, but may not cross through the center',()=>run(`
 assert(!characterMovementBlocked(state,id,0,0,.5,0,0));
 assert(!characterMovementBlocked(state,id,1,0,1.5,0,0));
 assert(characterMovementBlocked(state,id,1,0,-2,0,0));
`));
