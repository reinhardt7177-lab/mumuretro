require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{B}=require('./world-horizon-fixture.cjs');
const file=path.resolve('tools/capture-field-meadow.cjs');let source=fs.readFileSync(file,'utf8');
source=source.replace("require('./field-meadow-fixture.cjs')","require('./world-horizon-fixture.cjs')").replace("if(phase==='before'){","if(false){");
const boot='await fixture.prepare(page,phase);';if(!source.includes(boot))throw Error('Capture boot marker changed');
source=source.replace(boot,`const assetJobs=[];report.assetResponses=[];page.on('response',response=>{if(!/world-horizon-v03\\.(glb|json)(?:$|\\?)/.test(response.url()))return;assetJobs.push(response.body().then(body=>report.assetResponses.push({url:response.url(),status:response.status(),bytes:body.length,sha256:require('node:crypto').createHash('sha256').update(body).digest('hex'),timing:response.request().timing()})).catch(error=>report.errors.push(error.message)));});`+boot);
source=source.replace('report.pass=report.shots.length===24','await Promise.all(assetJobs);report.pass=report.shots.length===24');
const marker='const shot=await page.evaluate(()=>fieldProbe.shot());';if(!source.includes(marker))throw Error('Capture marker changed');
source=source.replace(marker,`if(phase!=='before'){
 const prior=JSON.parse(fs.readFileSync(B+'/before.json')).shots.find(s=>s.id===site.id&&s.view===view);
 await page.evaluate(s=>{const a=game.player,c=game.engine.camera;a.position.fromArray(s.actor);a.heading.fromArray(s.heading);a.syncMesh();c.position.fromArray(s.camera);c.quaternion.fromArray(s.quaternion);c.up.fromArray(s.up);c.fov=s.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.scatter.updateFocus?.(a);game.sky.update(a,c);game.engine.render();game.engine.render();},prior);
 }
 const shot=await page.evaluate(()=>({...fieldProbe.shot(),heading:game.player.heading.toArray()}));`);
fs.writeFileSync(B+'/capture-executed.cjs',source);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
