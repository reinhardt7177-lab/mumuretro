const fs=require('node:fs'),path=require('node:path'),fixture=require('./wayfarer-v02-fixture.cjs'),{A,B}=fixture;
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),phase=process.argv[2]||'goal';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const report={phase,previewOnly:phase!=='before',preparedView:true,actualTraversal:false,errors:[],shots:[]};try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')console.log(m.text())});
 await fixture.prepare(page,phase);
 const site=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/world-horizon/sites.json')).find(s=>s.id==='landing');
 const locked=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/arrival-dais/after.json'));
 for(const[view,yaw]of [['front',0],['side',Math.PI/2],['rear',Math.PI]]){
  const camera=locked.shots.find(s=>s.view===view);
  const data=await page.evaluate(({site,yaw,camera})=>{fieldProbe.stage(site.dir,site.target,yaw);const c=game.engine.camera;c.position.fromArray(camera.camera);c.quaternion.fromArray(camera.quaternion);c.up.fromArray(camera.up);c.fov=camera.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.sky.update(game.player,c);game.engine.render();game.engine.render();return fieldProbe.shot();},{site,yaw,camera});
  await page.screenshot({path:B+'/'+phase+'-'+view+'.png'});report.shots.push({view,...data});
 }
 report.geometry=await page.evaluate(()=>{
  const p=game.planet,dir=new T.Vector3(),ray=new T.Raycaster(),samples=[];
  const centre=p.latLonToPos(21,-3).normalize(),e=new T.Vector3(0,1,0).cross(centre).normalize(),n=centre.clone().cross(e).normalize();
  for(let x=-21;x<=21;x+=1.5)for(let z=-21;z<=21;z+=1.5){if(Math.hypot(x,z)>24)continue;dir.copy(centre).addScaledVector(e,x/p.R).addScaledVector(n,z/p.R).normalize();const terrainHeight=p.heightAt(dir)-(p.arrivalSupport?.delta(dir)||0);ray.set(dir.clone().multiplyScalar(p.R+terrainHeight+3),dir.clone().negate());ray.far=8;const hit=ray.intersectObject(p.mesh,false)[0];samples.push({dir:dir.toArray(),height:terrainHeight,influence:p.terraces?.influence(dir)||0,delta:p.terraces?.delta(dir,p.baseHeightAt(dir)+(p.landscape?.delta(dir)||0))||0,slope:p.slopeDegAt(dir),gap:hit?hit.point.length()-p.R-terrainHeight:null});}
  const rocks=Object.entries(game.scatter.boulders).map(([id,b])=>({id,bounds:{min:b.geometry.boundingBox.min.toArray(),max:b.geometry.boundingBox.max.toArray(),radius:Math.max(...Array.from({length:b.geometry.attributes.position.count},(_,i)=>Math.hypot(b.geometry.attributes.position.getX(i),b.geometry.attributes.position.getZ(i))))},triangles:(b.geometry.index?.count||b.geometry.attributes.position.count)/3}));
  return{triangles:p.mesh.geometry.attributes.position.count/3,field:game.meadowField,support:p.arrivalSupport?{height:p.arrivalSupport.height,inner:p.arrivalSupport.inner,outer:p.arrivalSupport.outer}:null,counts:game.scatter.counts,colliders:game.scatter.colliders.map(c=>({dir:c.dir.toArray(),r:c.r,height:c.height,kind:c.kind})),sites:p.levelSites.map(s=>({id:s.id,height:s.height,dir:s.dir.toArray()})),routes:game.worldTrails.routes.map(r=>({id:r.id,reachable:r.reachable,length:r.dirs.length})),samples,rocks};
 });
 fs.writeFileSync(B+'/'+phase+'-geometry.json',JSON.stringify(report.geometry,null,2));
 const s=report.geometry.samples, gaps=s.filter(x=>x.gap!==null).map(x=>Math.abs(x.gap)).sort((a,b)=>a-b);
 report.summary={triangles:report.geometry.triangles,samples:s.length,changed:s.filter(x=>Math.abs(x.delta)>.02).length,maxDelta:Math.max(...s.map(x=>Math.abs(x.delta))),missing:s.filter(x=>x.gap===null).length,maxGap:gaps.at(-1),p95Gap:gaps[Math.floor(gaps.length*.95)],field:report.geometry.field,counts:report.geometry.counts,rocks:report.geometry.rocks};
 delete report.geometry;report.pass=!report.errors.length;console.log(JSON.stringify(report.summary));if(!report.pass)throw Error(report.errors.join(';'));
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(B+'/'+phase+'.json',JSON.stringify(report,null,2));await browser.close();}})();
