const fs=require('node:fs'),path=require('node:path'),fixture=require('./arrival-dais-fixture.cjs'),{A,B}=fixture;
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),phase=process.argv[2]||'before';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const report={phase,preparedView:true,actualTraversal:false,shots:[],errors:[]};try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));
 const expected=[...JSON.parse(fs.readFileSync(B+'/baseline.json')).files,...['arrival-dais-v03.glb','arrival-field-v01.png','arrival-meadow-v01.json'].map(f=>'assets/models/adventure/'+f)],network=[];
 if(phase==='after')p.on('response',response=>{const file=new URL(response.url()).pathname.slice(1);if(expected.includes(file))network.push((async()=>({file,status:response.status(),fromServiceWorker:response.fromServiceWorker(),sha256:require('node:crypto').createHash('sha256').update(await response.body()).digest('hex')}))());});
 await fixture.prepare(p,phase);
 const site=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/world-horizon/sites.json')).find(s=>s.id==='landing'),before=phase==='before'?null:JSON.parse(fs.readFileSync(B+'/before.json'));
 for(const[view,yaw]of [['front',0],['side',Math.PI/2],['rear',Math.PI]]){
   const locked=before?.shots.find(s=>s.view===view);
   const data=await p.evaluate(({site,yaw,locked})=>{fieldProbe.stage(site.dir,site.target,yaw);if(locked){const c=game.engine.camera;c.position.fromArray(locked.camera);c.quaternion.fromArray(locked.quaternion);c.up.fromArray(locked.up);c.fov=locked.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.sky.update(game.player,c);}game.engine.render();game.engine.render();return{...fieldProbe.shot(),asset:game.landing.group.getObjectByName('Mumu authored arrival dais')?.userData??null};},{site,yaw,locked});
   await p.screenshot({path:B+'/'+phase+'-'+view+'.png'});report.shots.push({view,...data});
 }
 if(phase==='after'){report.actualHTTP=await Promise.all(network);if(report.actualHTTP.length!==expected.length||report.actualHTTP.some(r=>r.status!==200||r.fromServiceWorker||r.sha256!==require('node:crypto').createHash('sha256').update(fs.readFileSync(r.file)).digest('hex')))throw Error('Product network differs from current root');}
 if(report.errors.length)throw Error(report.errors.join(';'));report.pass=true;console.log(JSON.stringify({phase,shots:report.shots.length,actualHTTP:report.actualHTTP?.length,asset:report.shots[0].asset,pass:true}));
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(B+'/'+phase+'.json',JSON.stringify(report,null,2));await browser.close();}})();
