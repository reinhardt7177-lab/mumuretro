const fs=require('node:fs'),assert=require('node:assert/strict');
const A='art/balance-walls/v01',patches=[];
const patch=(file,from,to)=>{assert(fs.readFileSync(file,'utf8').includes(from),file+' marker missing');patches.push({file,from,to});};
patch('src/shrine/Room.js',"import { registerBalanceOnboarding } from './BalanceOnboarding.js';","import { registerBalanceOnboarding } from './BalanceOnboarding.js';\nimport { registerBalanceRecords } from './BalanceRecords.js';");
patch('src/shrine/Room.js','  registerSanctumOfferings(finished);','  registerSanctumOfferings(finished);\n  registerBalanceRecords(finished);');
patch('src/shrine/Room.js','const goals = {};let silhouetteGoalBoard','const goals = {};const balanceBoards={};let silhouetteGoalBoard');
patch('src/shrine/Room.js',"if(spec.id==='balance'){goalBoard.group.scale", "if(spec.id==='balance'){balanceBoards[r.id]={goal:goalBoard};goalBoard.group.scale");
patch('src/shrine/Room.js',"if(spec.id==='balance'){board.group.scale", "if(spec.id==='balance'){balanceBoards[r.id].hint=board;board.group.scale");
patch('src/shrine/Room.js','spec, seed, scene, dungeon, gates, final, prize, goals, hints, court,',"spec, seed, scene, dungeon, gates, final, prize, goals, hints, balanceBoards:spec.id==='balance'?balanceBoards:null, court,");
patch('src/boot.js','const atRecord = room.strataRecords?.near(roomActor)','const atRecord = room.balanceRecords?.near(roomActor) || room.strataRecords?.near(roomActor)');
patch('src/data/balanceTemple.js',"model: 'assets/models/balance-temple-v05.glb'","model: 'assets/models/balance-temple-v06.glb'");
patch('src/shrine/BalanceTemple.js',"['Balance paving limestone','Balance paving bed'].includes(m.name)","['Balance paving limestone','Balance paving bed','Balance wall ashlar'].includes(m.name)");
patch('src/shrine/BalanceTemple.js',"// Flat paving receives the room's shadows; self casting only produced striped acne.","// Dressed surfaces receive shadows; continuous wall backing casts structural shadows.");
fs.writeFileSync(A+'/patches.json',JSON.stringify(patches,null,2));
const poses=JSON.parse(fs.readFileSync('art/balance-paving/v01/cameras.json'));
poses.push(...[
 ['wall-left',[-3.5,3.2,-3],[-7,3,-4.5],[-5,-3]],['wall-right',[5,3.2,0],[6.9,2.8,-1],[5,1.7]],
 ['record-front',[-5.8,2,7.5],[-5.8,.8,4.7],[-4,5.5]],['record-side',[-2.9,1.8,5.8],[-5.8,.7,4.7],[-4,5.5]],['record-rear',[-5.8,1.6,1.4],[-5.8,.7,4.7],[-4,5.5]],['hint-front',[5.8,2,7.5],[5.8,.8,4.7],[4,5.5]]
].map(([id,camera,target,actor])=>({id,camera,target,actor})));
fs.writeFileSync(A+'/cameras.json',JSON.stringify(poses,null,2));console.log('PREPARED',patches.length,'patches',poses.length,'cameras; product untouched');
