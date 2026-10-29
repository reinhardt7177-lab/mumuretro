// Retain the established full input journey; observe actual camera transitions.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const B='reports/2026-10-24/evidence/fire-camera/observed-journey';fs.mkdirSync(B,{recursive:true});
const file=path.resolve('tools/check-fire-adventure.cjs');let s=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-21/evidence/fire-adventure',B);
s=s.replace('async function helpers(){await p.evaluate(()=>{',`async function helpers(){await p.evaluate(()=>{
 if(!game._fireCameraObserved){const step=game.step;game._fireCameraObserved=true;window.fireCameraObservations=[];let previous=game.engine.camera.position.clone();game.step=function(dt){const prior=game.engine.camera.position.clone();step(dt);if(game.mode==='room'&&game.room?.fireAdventure){const c=game.engine.camera.position,a=game.roomActor;fireCameraObservations.push({position:a.position.toArray(),camera:c.toArray(),delta:c.distanceTo(prior),transition:a.cameraTransition,requestedYaw:a.camYaw});}previous.copy(game.engine.camera.position);};}
`);
s=s.replace('async function shot(name){await p.evaluate(()=>ft.view());',`async function shot(name){const rows=await p.evaluate(()=>window.fireCameraObservations||[]);fs.writeFileSync(path.join(OUT,name+'-camera.json'),JSON.stringify(rows,null,2));await p.evaluate(()=>ft.view());`);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
