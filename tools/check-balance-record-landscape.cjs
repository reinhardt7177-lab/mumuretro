const fs=require('node:fs'),path=require('node:path'),{PNG}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','pngjs'));
const B='reports/2026-10-25/evidence/balance-walls',fault=process.argv.includes('--fault'),p=PNG.sync.read(fs.readFileSync(B+'/'+(fault?'initial-':'')+'touch-read-landscape.png')),colors=new Set();
// Sample only the world between the upper prompt and the bottom reading dialog.
for(let y=0;y<10;y++)for(let x=0;x<20;x++){const px=Math.round(p.width*(.2+x*.6/19)),py=Math.round(p.height*(.35+y*.25/9)),i=(py*p.width+px)*4;colors.add([...p.data.subarray(i,i+4)].join(','));}
const report={pass:colors.size>20,fault,checks:[{name:'landscape reading image includes actual rendered world outside UI',pass:colors.size>20,worldColors:colors.size}]};fs.writeFileSync(B+'/'+(fault?'landscape-fault':'landscape')+'.json',JSON.stringify(report,null,2));console.log((report.pass?'PASS ':'FAIL ')+report.checks[0].name+' colors='+colors.size);if(!report.pass)process.exitCode=1;
