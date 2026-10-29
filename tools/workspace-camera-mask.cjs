// Install independent GPU masks. Production camera heuristics do not supply
// their own visibility score to these measurements.
exports.install=async page=>page.evaluate(async()=>{
 const T=await import('three');window.workMask=()=>{
  const r=game.room,a=game.roomActor,c=game.engine.camera,renderer=game.engine.renderer,scene=r.scene,roots=r.spec.id==='balance'?[r.balanceArt.mechanisms[0].root]:[r.gates[0].gate.above,...r.gates[0].gate.sieves.map(s=>s.grp)];
  const own=new Set();for(const root of roots)root.traverse(o=>{if(o.isMesh)own.add(o);});
  const target=new T.WebGLRenderTarget(640,400),bytes=new Uint8Array(640*400*4),black=new T.MeshBasicMaterial({color:0,toneMapped:false}),white=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),changed=[];
  const bg=scene.background,fog=scene.fog,clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),oldTarget=renderer.getRenderTarget(),shadow=renderer.shadowMap.autoUpdate,clipping=renderer.localClippingEnabled;
  scene.background=new T.Color(0);scene.fog=null;renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(target);renderer.setClearColor(0,1);
  scene.traverse(o=>{if(o.isMesh||o.isPoints||o.isLine){let actor=false;for(let parent=o;parent;parent=parent.parent)if(parent===a.mesh){actor=true;break;}changed.push({o,visible:o.visible,material:o.material,actor});}});
  function count(camera,crop=false){renderer.clear();renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,640,400,bytes);let n=0;for(let y=crop?40:0;y<(crop?360:400);y++)for(let x=crop?32:0;x<(crop?608:640);x++){const i=(y*640+x)*4;if(bytes[i]>220&&bytes[i+1]>220&&bytes[i+2]>220)n++;}return n;}
  try{
   for(const rec of changed){rec.o.visible=rec.visible&&(rec.o.isMesh&&own.has(rec.o));rec.o.material=white;}
   const silhouette=count(c);
   for(const rec of changed){rec.o.visible=rec.visible&&rec.o.isMesh&&!rec.material?.transparent;rec.o.material=own.has(rec.o)?white:black;}
   const visible=count(c),near=c.clone();near.far=Math.max(.5,c.position.distanceTo(a.position.clone().setY(a.position.y+1.25))*.6);near.updateProjectionMatrix();
   renderer.localClippingEnabled=true;white.clippingPlanes=[new T.Plane(new T.Vector3(0,1,0),-a.position.y-.45)];
   for(const rec of changed){rec.o.visible=rec.visible&&rec.o.isMesh&&!rec.material?.transparent&&!rec.actor&&!rec.o.userData.cameraIgnored;rec.o.material=white;}
   const foreground=count(near,true);
   return{silhouettePixels:silhouette,visiblePixels:visible,deviceFraction:silhouette?visible/silhouette:null,foregroundPixels:foreground,foregroundCropPixels:576*320,foregroundFraction:foreground/(576*320)};
  }finally{for(const rec of changed){rec.o.visible=rec.visible;rec.o.material=rec.material;}scene.background=bg;scene.fog=fog;renderer.shadowMap.autoUpdate=shadow;renderer.localClippingEnabled=clipping;renderer.setRenderTarget(oldTarget);renderer.setClearColor(clear,alpha);target.dispose();white.dispose();black.dispose();}
 };
});
