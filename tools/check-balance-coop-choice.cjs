const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{createBalance}=require('../server/balance.cjs'),OUT=path.resolve('reports/2026-10-22/evidence/balance-onboarding'),fault=process.argv.includes('--legacy-range'),report={checks:[],fault};fs.mkdirSync(OUT,{recursive:true});
function check(name,pass){report.checks.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name);assert(pass,name);}
(async()=>{try{
let source=fs.readFileSync('src/core/CoopBalance.js','utf8');if(fault){const from='g.choiceNear?.(p)??';assert(source.includes(from));source=source.replace(from,'');}
const{bindCoopBalance}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const devices=[5,4,2].map(n=>({stock:Array.from({length:n},()=>({mesh:{visible:true}})),count:3,near:()=>null,interact:()=>false,check(){},sync(){}}));
const g=devices[0];g.choices=[{n:3,x:-1.4,z:4.2},{n:4,x:0,z:4.2},{n:5,x:1.4,z:4.2}];let supplied=0;
g.choiceNear=p=>{supplied++;return g.choices.map(c=>({c,d:Math.hypot(p.x-c.x,p.z-c.z)})).filter(v=>v.d<1.15).sort((a,b)=>a.d-b.d)[0]?.c;};
const original=g.interact,sent=[],binding=bindCoopBalance({gates:devices.slice(0,2).map(gate=>({gate})),final:devices[2]},'student',c=>sent.push(c));binding.apply(createBalance());
check('cooperative choice uses the same1m physical-front reach as personal mode',g.interact({x:0,z:5.2})&&supplied===1&&sent.length===1&&sent[0].type==='count'&&sent[0].value===4&&sent[0].stage===0);
check('outside physical reach emits no choice command',!g.interact({x:0,z:6.2})&&sent.length===1);
binding.dispose();check('leaving cooperative binding restores personal interaction function',g.interact===original);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e.message);}finally{fs.writeFileSync(path.join(OUT,fault?'fault-coop-reach.json':'coop-reach.json'),JSON.stringify(report,null,2));}})();
