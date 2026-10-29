// Geometry diagnostics only. The recorded actor/camera positions below are
// staged fixtures; this is not a movement or puzzle-completion test.
const fs=require('node:fs'),path=require('node:path'),{prepare,B}=require('./workspace-camera-fixture.cjs'),{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),report={staged:true,errors:[]};try{
 const p=await b.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));await prepare(p,'balance','before');report.centre=await p.evaluate(async()=>{
  const T=await import('three'),{subjectVisibility}=await import('/src/render/SubjectCamera.js'),{SceneRayQuery}=await import('/src/render/SceneRayQuery.js'),{installStaticRaycastTree}=await import('/src/render/StaticRaycastTree.js'),a=game.roomActor,r=game.room,c=game.engine.camera,meshes=[],query=new SceneRayQuery(),ray=new T.Raycaster();a.setAt(0,3.4);r.scene.updateMatrixWorld(true);
  r.scene.traverse(m=>{if(!m.isMesh||m.material.transparent)return;for(let o=m;o;o=o.parent)if(!o.visible||o===a.mesh)return;installStaticRaycastTree(m);meshes.push(m);});query.update(meshes);meshes.rayQuery=query;
  const box=new T.Box3().setFromObject(r.balanceArt.mechanisms[0].root),points=[];for(const x of[box.min.x-.12,box.max.x+.12])for(const y of[box.min.y,box.max.y+.12])for(const z of[box.min.z,box.max.z])points.push(new T.Vector3(x,y,z));
  const valid=[],failed={body:0,ray:0,frame:0,inside:0};
  for(const distance of[5,6.5])for(const yaw of[-.75,-.5,-.25,0,.25,.5,.75])for(const pitch of[.38,.5,.62,.7])for(const height of[1.25,2.0])for(const side of[-1.6,0,1.6]){
   const target=new T.Vector3(Math.cos(yaw)*side,height,3.4-Math.sin(yaw)*side),position=target.clone().add(new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance));
   if(!a._inside(position)){failed.inside++;continue;}if(subjectVisibility(position,a.position,meshes,.22)!==3){failed.body++;continue;}
   const eye=a.position.clone().setY(1.25),dir=position.clone().sub(eye),length=dir.length();ray.set(eye,dir.normalize());ray.far=length+.25;if(query.all(ray).length){failed.ray++;continue;}
   c.position.copy(position);c.up.set(0,1,0);c.lookAt(target);c.updateMatrixWorld(true);const framed=[...points,a.position.clone().setY(.25),a.position.clone().setY(1.65)].every(v=>{const p=v.clone().project(c);return Math.abs(p.x)<.96&&Math.abs(p.y)<.96&&p.z>-1&&p.z<1;});
   if(!framed){failed.frame++;continue;}valid.push({distance,yaw,pitch,height,side,position:position.toArray(),target:target.toArray()});
  }
  valid.sort((a,b)=>Math.abs(a.yaw)+Math.abs(a.pitch-.38)+Math.abs(a.height-1.25)*.2-Math.abs(b.yaw)-Math.abs(b.pitch-.38)-Math.abs(b.height-1.25)*.2);return{valid:valid.slice(0,12),validCount:valid.length,failed,box:{min:box.min.toArray(),max:box.max.toArray()}};
 });await p.close();
 const sp=await b.newPage();await prepare(sp,'sift','before');const low=JSON.parse(fs.readFileSync(B+'/before.json')).rooms.find(r=>r.kind==='sift').rows.find(r=>r.body<3);report.blockers=await sp.evaluate(async low=>{
  const T=await import('three'),{SceneRayQuery}=await import('/src/render/SceneRayQuery.js'),{installStaticRaycastTree}=await import('/src/render/StaticRaycastTree.js'),r=game.room,a=game.roomActor,eye=new T.Vector3(...low.camera),foot=new T.Vector3(...low.actor),meshes=[],query=new SceneRayQuery(),ray=new T.Raycaster(),side=new T.Vector3(foot.z-eye.z,0,eye.x-foot.x).normalize().multiplyScalar(.22);
  r.scene.updateMatrixWorld(true);r.scene.traverse(m=>{if(!m.isMesh||m.material.transparent)return;for(let o=m;o;o=o.parent)if(!o.visible||o===a.mesh)return;installStaticRaycastTree(m);meshes.push(m);});query.update(meshes);const hits=[];
  for(const h of[.25,.8,1.35])for(const s of[-1,0,1]){const p=foot.clone().addScaledVector(side,s);p.y+=h;const d=p.sub(eye),length=d.length();ray.set(eye,d.normalize());ray.far=length-.12;const hit=query.all(ray)[0];if(hit)hits.push({h,s,name:hit.object.name,material:hit.object.material.name,instanceId:hit.instanceId,registered:r.dungeon.rects.cameraOccluders.includes(hit.object),point:hit.point.toArray()});}return{low,hits};
 },low);report.pass=!report.errors.length;console.log(JSON.stringify({centre:report.centre,blockers:report.blockers.hits},null,2));
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(B+'/calibration.json',JSON.stringify(report,null,2));await b.close();}})();
