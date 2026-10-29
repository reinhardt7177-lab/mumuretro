require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{B}=require('./world-horizon-fixture.cjs'),phase=process.argv[2]||'after',file=path.resolve('tools/check-adventure-world.cjs'),dest=B+'/walk-'+phase;
let source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-22/evidence/adventure-world',dest);
for(const marker of["await p.goto('http://127.0.0.1:5512/?q=mid');","await rp.goto('http://127.0.0.1:5512/?q=mid');"]){if(!source.includes(marker))throw Error('World-walk page routing changed');const page=marker.includes('rp.goto')?'rp':'p';source=source.replace(marker,"await require('./world-horizon-fixture.cjs').route("+page+','+JSON.stringify(phase)+');'+marker);}
const start=source.indexOf(' let matrixDelta=0;'),end=source.indexOf('\n const terrain=',start);if(start<0||end<0)throw Error('Original placement verifier changed');
source=source.slice(0,start)+`
 const rows=lists=>lists.flatMap(list=>Array.from({length:list.length/12},(_,i)=>list.slice(i*12,i*12+12)));
 const oldRows=rows(original.basis),newRows=rows(placements.basis),buckets=new Map();
 for(const row of oldRows){const key=row.slice(0,3).map(v=>Math.round(v*1000)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);}
 let unmatched=0,maxDelta=0;for(const row of newRows){const bucket=buckets.get(row.slice(0,3).map(v=>Math.round(v*1000)).join(','))||[],index=bucket.findIndex(r=>r.every((v,i)=>Math.abs(v-row[i])<1e-5));if(index<0)unmatched++;else{maxDelta=Math.max(maxDelta,...bucket[index].map((v,i)=>Math.abs(v-row[i])));bucket.splice(index,1);}}
 check('physical approach pruning preserves every other seeded instance basis and all site identities',JSON.stringify(placements.sites)===JSON.stringify(original.sites)&&JSON.stringify(placements.forage)===JSON.stringify(original.forage)&&placements.counts.tree===original.counts.tree-7&&placements.counts.rock===original.counts.rock&&placements.counts.bush===original.counts.bush&&oldRows.length-newRows.length===14&&unmatched===0,{oldRows:oldRows.length,newRows:newRows.length,unmatched,maxDelta,counts:placements.counts});
`+source.slice(end);
fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(dest+'/executed.cjs',source);process.argv=[process.execPath,file];const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
