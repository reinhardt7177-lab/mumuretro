const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),kind=process.argv[2],B='reports/2026-10-25/evidence/balance-observatory';let file,source;
if(kind==='records'||kind==='touch'||kind==='landscape'){
 file=path.resolve('tools/run-balance-portal-records.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-25/evidence/balance-portals',B);process.argv=[process.execPath,file,...(kind==='touch'?['--touch']:kind==='landscape'?['landscape']:[])];
}else if(kind==='portal-input'){
 file=path.resolve('tools/check-balance-portal-input.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-25/evidence/balance-portals',B).replace("require('./balance-portals-fixture.cjs')","require('./balance-observatory-fixture.cjs')").replace('camera:c.position.toArray(),clear,framed,step','camera:c.position.toArray(),previous:previous.toArray(),clear,framed,step');process.argv=[process.execPath,file,...process.argv.slice(3)];
}else if(kind==='coop'){
 file=path.resolve('tools/check-temple-camera-coop.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-24/evidence/temple-camera',B).replace("'tools/run-balance-onboarding-case.cjs'","'tools/run-balance-observatory-coop-browser.cjs'");
}else{
 file=path.resolve('tools/run-balance-portals-case.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-25/evidence/balance-portals',B);
 if(kind==='balance'){
  const from="await p.reload();await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000});";
  const to=`await p.evaluate(()=>game.engine.render());await p.screenshot({path:path.join(OUT,'actual-return.png')});
const completedSave=await p.evaluate(()=>localStorage.getItem('mumuplanet.progress.v1'));fs.writeFileSync(path.join(OUT,'actual-completed-save.json'),completedSave||'null');
const pendingReload=new Set(),reloadEvents=[],reloadStart=Date.now();const requestPath=req=>new URL(req.url()).pathname;
p.on('request',req=>{pendingReload.add(requestPath(req));});p.on('requestfinished',req=>{pendingReload.delete(requestPath(req));});p.on('requestfailed',req=>{pendingReload.delete(requestPath(req));reloadEvents.push({path:requestPath(req),error:req.failure()?.errorText});});
await p.reload();try{await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000,polling:100});}
catch(error){let state;try{state=await Promise.race([p.evaluate(()=>({game:!!window.game,load:document.getElementById('load')?.style.display,text:document.getElementById('load')?.innerText,visibility:document.visibilityState})),new Promise(resolve=>setTimeout(()=>resolve('evaluation timeout'),10000))]);}catch(e){state=e.message;}fs.writeFileSync(path.join(OUT,'reload-diagnostic.json'),JSON.stringify({pass:false,elapsed:Date.now()-reloadStart,pending:[...pendingReload],events:reloadEvents,state},null,2));await p.screenshot({path:path.join(OUT,'reload-failure.png'),timeout:10000}).catch(()=>{});throw error;}
fs.writeFileSync(path.join(OUT,'reload-diagnostic.json'),JSON.stringify({pass:true,elapsed:Date.now()-reloadStart,pending:[...pendingReload],events:reloadEvents,state:await p.evaluate(()=>({game:!!window.game,load:document.getElementById('load').style.display,visibility:document.visibilityState}))},null,2));`;
  const marker='const patches=[';if(!source.includes(marker))throw Error('Journey diagnostics adapter missing');source=source.replace(marker,marker+JSON.stringify(["check('no JavaScript or shader errors',!report.errors.length,report.errors);report.pass=true;","check('no JavaScript or shader errors',!report.errors.length,report.errors);await p.evaluate(()=>game.engine.render());await p.screenshot({path:path.join(OUT,'actual-restored.png')});report.pass=true;",'Capture the actual restored scene after all existing reload assertions.'])+','+JSON.stringify([from,to,'Record the real completed save and reload readiness; preserve120second limit and all15 assertions. Timer polling avoids relying on background animation frames.'])+',');
 }
}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
