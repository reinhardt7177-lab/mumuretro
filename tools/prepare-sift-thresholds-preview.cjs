const fs=require('node:fs'),crypto=require('node:crypto'),A='art/sift-thresholds/v01',B='reports/2026-10-25/evidence/sift-thresholds',b=JSON.parse(fs.readFileSync(B+'/baseline.json'));
const extra='src/shrine/StrataRecords.js';if(!b.files.includes(extra)){const raw=fs.readFileSync(extra);if(crypto.createHash('sha256').update(raw).digest('hex')!==b.inventory[extra])throw Error('Shared record source changed');fs.copyFileSync(extra,B+'/baseline-'+extra.replaceAll('/','__'));b.files.push(extra);fs.writeFileSync(B+'/baseline.json',JSON.stringify(b,null,2));}
const sign='src/shrine/Signboard.js';if(!b.files.includes(sign)){const raw=fs.readFileSync(sign);if(crypto.createHash('sha256').update(raw).digest('hex')!==b.inventory[sign])throw Error('Shared sign source changed');fs.copyFileSync(sign,B+'/baseline-'+sign.replaceAll('/','__'));b.files.push(sign);fs.writeFileSync(B+'/baseline.json',JSON.stringify(b,null,2));}
const sources=Object.fromEntries(b.files.map(f=>[f,fs.readFileSync(B+'/baseline-'+f.replaceAll('/','__'),'utf8').replace(/\r\n/g,'\n')])),patches=[];
function patch(file,from,to){if(!sources[file].includes(from))throw Error('Missing sift preview marker '+file+' '+from);sources[file]=sources[file].replace(from,to);patches.push({file,from,to});}
patch('src/shrine/Room.js',"import { registerBalanceCourtArt } from './BalanceCourtArt.js';","import { registerBalanceCourtArt } from './BalanceCourtArt.js';\nimport { registerSiftRecords } from './SiftRecords.js';\nimport { registerSiftThresholds } from './SiftThresholds.js';");
patch('src/shrine/Room.js','  registerBalanceCourtArt(finished);','  registerBalanceCourtArt(finished);\n  registerSiftRecords(finished);\n  registerSiftThresholds(finished);');
patch('src/shrine/Room.js','const goals = {};const balanceBoards={};','const goals = {};const balanceBoards={},siftBoards={};');
patch('src/shrine/Room.js','    if(r.gate===\'strataOrder\')recordsGoal=goalBoard;',"    if(spec.id==='sift')siftBoards[r.id]={goal:goalBoard};\n    if(r.gate==='strataOrder')recordsGoal=goalBoard;");
patch('src/shrine/Room.js','    hints[r.id] = { board, texts: r.hints, level: 0, t: 0 };',"    hints[r.id] = { board, texts: r.hints, level: 0, t: 0 };\n    if(spec.id==='sift')siftBoards[r.id].hint=board;");
patch('src/shrine/Room.js',"balanceBoards:spec.id==='balance'?balanceBoards:null","balanceBoards:spec.id==='balance'?balanceBoards:null,siftBoards:spec.id==='sift'?siftBoards:null");
patch('src/boot.js','const atRecord = room.balanceRecords?.near(roomActor)','const atRecord = room.siftRecords?.near(roomActor) || room.balanceRecords?.near(roomActor)');
patch('src/shrine/StrataRecords.js','export const registerStrataRecords=','export const loadObservationPlaque=assets;\n\nexport const registerStrataRecords=');
patch('src/shrine/Signboard.js','function paintPlaque(cv,title,body,dim){','function paintPlaque(cv,title,body,dim,bodyWeight=500){');
patch('src/shrine/Signboard.js','c.font=`500 ${font}px','c.font=`${bodyWeight} ${font}px');
patch('src/shrine/Signboard.js','let plaque=false,metrics=null,state=','let plaque=false,plaqueWeight=500,metrics=null,state=');
patch('src/shrine/Signboard.js','usePlaque(){if(plaque)return;plaque=true;','usePlaque(options={}){if(plaque)return;plaque=true;plaqueWeight=options.bodyWeight===700?700:500;');
patch('src/shrine/Signboard.js','paintPlaque(cv,state.title,state.body,state.dim)','paintPlaque(cv,state.title,state.body,state.dim,plaqueWeight)');
patch('src/shrine/Signboard.js','paintPlaque(cv,t,b,d)','paintPlaque(cv,t,b,d,plaqueWeight)');
for(const[f,body]of Object.entries(sources))fs.writeFileSync(A+'/preview-'+f.replaceAll('/','__'),body);
fs.writeFileSync(A+'/patches.json',JSON.stringify(patches,null,2));console.log('SIFT_PREVIEW '+patches.length+' replacements; original runtime unchanged');
