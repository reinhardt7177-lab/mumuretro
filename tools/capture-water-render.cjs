// Preserve the existing twelve prepared views; use new evidence destinations.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'capture-water-courts.cjs');
let source=fs.readFileSync(file,'utf8').replace("evidence/water-courts/","evidence/water-render/");
source=source.replace("if(phase==='after')assert(report.native)","assert(report.native)");
source=source.replace("report.shots.push(shot)","shot.detail=await p.evaluate(()=>({loaded:!!game.room.final.detail?.loaded,level:game.room.final.detail?.lod?.getCurrentLevel(),pixels:game.room.final.detail?.lod?.projectedPixels}));report.shots.push(shot)");
const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(source,file);
