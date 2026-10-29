const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),fixture=require('./forest-render-fixture.cjs'),{A,B}=fixture,{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),phase=process.argv[2]||'before';
const report={phase,prepared:true,actualTraversal:false,shots:[],errors:[],sources:fixture.hashes(phase)};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});await fixture.prepare(page,phase,'mid');
 const sites=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/world-horizon/sites.json'));
 for(const id of['landing','woodland','herb','salt','trap'])for(const[view,yaw]of[['front',0],['side',Math.PI/2],['rear',Math.PI]]){
  const pose=await page.evaluate(({id,view,yaw,sites})=>{
   if(id==='landing'||id==='woodland'){const site=sites.find(s=>s.id===id);fieldProbe.stage(site.dir,site.target,yaw);}
   else{
    const site=game.forage.sites.find(s=>s.kind===(id==='trap'?'meat':id));site.group.updateWorldMatrix(true,true);
    const point=id==='trap'?site.trap.crate.parent.getWorldPosition(new T.Vector3()):site.cands[0].grp.getWorldPosition(new T.Vector3());
    const direction=point.clone().normalize(),target=point.clone().add(new T.Vector3(0,0,-6).applyQuaternion(site.group.quaternion)).normalize();
    const actor=site.group.localToWorld(new T.Vector3(-3,0,3)).normalize();fieldProbe.stage(actor.toArray(),target.toArray());
    const up=new T.Vector3(0,1,0).applyQuaternion(site.group.quaternion),offset=new T.Vector3(4.8,2.8,5.5).applyAxisAngle(new T.Vector3(0,1,0),yaw).applyQuaternion(site.group.quaternion);
    const aim=point.clone().addScaledVector(up,id==='trap'?.9:.6);const camera=game.engine.camera;camera.position.copy(aim).add(offset);camera.up.copy(up);camera.lookAt(aim);camera.updateMatrixWorld(true);game.scatter.updateFocus(game.player);game.sky.update(game.player,camera);
   }
   game.engine.render();game.engine.render();return fieldProbe.shot();
  },{id,view,yaw,sites});
  report.shots.push({id,view,...pose});await page.screenshot({path:B+'/'+phase+'-'+id+'-'+view+'.png'});
 }
 assert.equal(report.shots.length,15);assert(!report.errors.length);report.pass=true;
 if(phase==='before')for(const shot of report.shots)fs.copyFileSync(B+'/before-'+shot.id+'-'+shot.view+'.png',A+'/target-'+shot.id+'-'+shot.view+'.png');
 console.log(phase+': 15 prepared views captured.');
}catch(error){report.pass=false;report.failure=error.stack;console.error(error);}finally{fs.writeFileSync(B+'/'+phase+'.json',JSON.stringify(report,null,2));await browser.close();if(!report.pass)process.exitCode=1;}})();
