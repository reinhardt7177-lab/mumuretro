require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fixture=require('./world-horizon-fixture.cjs'),{B}=fixture,{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const phase=process.argv[2]||'goal',fault=process.argv.find(x=>x.startsWith('--break-')),report={phase,fault,checks:[],errors:[],scope:'Prepared geometry/GPU views plus separate actual walking verifier; no original-game runtime or student hardware'};
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});assert.ok(pass,name+': '+JSON.stringify(details));console.log('PASS '+name);};
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function transform(file,body){
 if(fault==='--break-collider'&&file==='src/world/Scatter.js')return body.replace('if(colliders[i].approachPruned)colliders.splice(i,1);','if(false)colliders.splice(i,1);');
 if(fault==='--break-fade'&&file==='src/render/HorizonBackdrop.js')return body.replace('float altitude=smoothstep(uFade.x,uFade.y,vHorizonLocal.y);','float altitude=1.;');
 if(fault==='--break-anchor'&&file==='src/render/Sky.js')return body.replace('this._ground.copy(this.planet.surfaceAt(up));','this._ground.copy(camera.position);');
 if(fault==='--break-focus'&&file==='src/world/WoodlandStyle.js')return body.replace('foliageFocusEnabled.value=1;','foliageFocusEnabled.value=0;');
 if(fault==='--break-depth'&&file==='src/render/HorizonBackdrop.js')return body.replace('depthWrite:false,depthTest:true','depthWrite:false,depthTest:false');
 if(fault==='--break-wood-fade'&&file==='src/world/WoodlandStyle.js')return body.replace('injectWoodlandWind(leaves,time);injectFoliageFade(leaves);','injectWoodlandWind(leaves,time);injectFoliageFade(leaves);injectFoliageFade(bark);');
 return body;
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 async function prepare(which,options={}){const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});await fixture.prepare(page,which,'mid',options);return page;}
 async function snapshot(page){return page.evaluate(()=>{
  const rows=[],matrix=new T.Matrix4(),col=new T.Color();for(const m of game.scatter.meshes)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);m.getColorAt(i,col);rows.push({kind:m.userData.natureKind,name:m.name,m:matrix.toArray(),c:col.toArray()});}
  return{rows,counts:{...game.scatter.counts},colliders:game.scatter.colliders.map(c=>({kind:c.kind,dir:c.dir.toArray(),r:c.r,height:c.height,m:c.matrix?.toArray()})),terrain:Array.from(game.planet.mesh.geometry.attributes.position.array),carpet:Array.from(game.carpet.mesh.geometry.attributes.position.array),routes:game.worldTrails.routes.map(r=>({id:r.id,dirs:r.dirs.map(d=>d.toArray())})),removed:game.scatter.approachClearance?.removed||[],assets:game.sky.backdrop?.contract||null,surface:game.meadowField,foliageCameraSolids:game.worldCamera.entries.filter(e=>e.source.userData.natureKind?.startsWith('canopy')).length};
 });}
 const oldPage=await prepare('before'),old=await snapshot(oldPage);await oldPage.close();
 const page=await prepare(phase,{transform}),now=await snapshot(page);
 check('the authored backdrop is actually decoded and attached, with three drawing meshes',now.assets?.revision==='v03'&&now.assets.meshes.length===3,now.assets);
 const oldRows=new Set(old.rows.map(hash)),nowRows=new Set(now.rows.map(hash)),removedRows=old.rows.filter(row=>!nowRows.has(hash(row)));
 check('only seven complete tree pairs are removed; every other transform and colour is exact',now.removed.length===7&&old.rows.length-now.rows.length===14&&now.rows.every(row=>oldRows.has(hash(row)))&&removedRows.length===14&&removedRows.every(row=>row.kind==='trunk'||row.kind.startsWith('canopy')),{removed:now.removed.map(t=>({portal:t.portal,sample:t.sample})),before:old.counts,after:now.counts,removedInstances:removedRows.length});
 const oldBodies=new Set(old.colliders.map(hash));check('the seven removed trees leave no ground collider while all remaining bodies match',old.colliders.length-now.colliders.length===7&&now.colliders.every(c=>oldBodies.has(hash(c))),{before:old.colliders.length,after:now.colliders.length});
 check('terrain, carpet, actual routes and the existing surface signature stay unchanged',hash(old.terrain)===hash(now.terrain)&&hash(old.carpet)===hash(now.carpet)&&hash(old.routes)===hash(now.routes)&&now.surface.loaded&&now.surface.signature==='f352fa1d',{terrain:hash(now.terrain),routes:hash(now.routes),surface:now.surface});
 check('non-solid leaves never enter the camera solid list',now.foliageCameraSolids===0,{entries:now.foliageCameraSolids});
 const anchor=await page.evaluate(()=>{const a=game.player,c=game.engine.camera,s=game.sky,b=s.backdrop,position=c.position.clone();s.update(a,c);b.group.updateMatrixWorld(true);const before=b.group.matrixWorld.toArray(),point=new T.Vector3().fromBufferAttribute(b.meshes[0].geometry.attributes.position,40).applyMatrix4(b.meshes[0].matrixWorld),screen=point.clone().project(c);c.position.addScaledVector(new T.Vector3(1,0,0).applyQuaternion(c.quaternion),.6);c.updateMatrixWorld(true);s.update(a,c);b.group.updateMatrixWorld(true);const after=b.group.matrixWorld.toArray(),changed=point.clone().project(c).distanceTo(screen)*400;c.position.copy(position);c.updateMatrixWorld(true);s.update(a,c);return{unchanged:JSON.stringify(before)===JSON.stringify(after),pixelMovement:changed};});
 check('background anchor follows ground rather than orbiting camera translation',anchor.unchanged&&anchor.pixelMovement>.2,anchor);
 const clip=await page.evaluate(poses=>{let maximum=0;const old=game.player.position.clone(),camera=game.engine.camera;for(const pose of poses){game.player.position.fromArray(pose.actor);camera.position.fromArray(pose.camera);game.sky.update(game.player,camera);game.sky.backdrop.group.updateMatrixWorld(true);for(const mesh of game.sky.ridges){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){if(p.getY(i)<=2)continue;maximum=Math.max(maximum,new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).distanceTo(camera.position));}}}game.player.position.copy(old);camera.position.fromArray(poses[0].camera);return{maximumDistance:maximum,far:camera.far,poses:poses.length};},JSON.parse(fs.readFileSync(B+'/before.json')).shots);
 check('visible backdrop vertices stay inside the camera far range at all 24 fixed poses',clip.poses===24&&clip.maximumDistance<clip.far,clip);
 const shader=await page.evaluate(fault=>{
  const r=game.engine.renderer,source=game.sky.backdrop.meshes[0].material,material=source.clone(),rt=new T.WebGLRenderTarget(64,64),scene=new T.Scene(),camera=new T.OrthographicCamera(-1.2,1.2,1.2,-1.2,.1,10),oldTarget=r.getRenderTarget(),oldClear=r.getClearColor(new T.Color()),oldAlpha=r.getClearAlpha(),pixels=new Uint8Array(64*64*4);
  let mesh,red;function sample(height,occluder){scene.clear();const geometry=new T.PlaneGeometry(2,2).translate(0,height,0);geometry.setAttribute('color',new T.Float32BufferAttribute(Array(geometry.attributes.position.count*3).fill(1),3));mesh=new T.Mesh(geometry,material);scene.add(mesh);camera.position.set(0,height,5);camera.lookAt(0,height,0);if(occluder){red=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({color:0xff0000,toneMapped:false}));red.position.set(0,height,1);scene.add(red);}r.setRenderTarget(rt);r.setClearColor(0,0);r.render(scene,camera);r.readRenderTargetPixels(rt,0,0,64,64,pixels);const i=(32*64+32)*4,result=Array.from(pixels.slice(i,i+4));mesh.geometry.dispose();if(red){red.geometry.dispose();red.material.dispose();red=null;}return result;}
  try{return{bottom:sample(.5,false),upper:sample(30,false),foreground:sample(30,true),depthTest:material.depthTest,depthWrite:material.depthWrite};}finally{material.dispose();rt.dispose();r.setRenderTarget(oldTarget);r.setClearColor(oldClear,oldAlpha);game.engine.render();}
 },fault);
 check('actual horizon shader fades the low base while keeping the upper cliff',shader.bottom[3]===0&&shader.upper[3]===255,shader);
 check('opaque foreground stays in front of decorative terrain',shader.foreground[0]===255&&shader.foreground[1]===0&&shader.foreground[2]===0&&shader.depthTest&&!shader.depthWrite,shader);
 await page.addScriptTag({path:'tools/world-horizon-mask.js'});
 const woodland=JSON.parse(fs.readFileSync(B+'/sites.json')).find(s=>s.id==='woodland');report.focusViews=[];
 for(let i=0;i<8;i++){
  await page.evaluate(({s,yaw})=>fieldProbe.stage(s.dir,s.target,yaw),{s:woodland,yaw:i*Math.PI/4});
  const row=await page.evaluate(async()=>{const view=await import('/src/world/WoodlandStyle.js');view.setFoliageFocus(null);const disabled=horizonMask(game.player.mesh);view.setFoliageFocus(game.player);const enabled=horizonMask(game.player.mesh);return{disabled,enabled};});report.focusViews.push({yaw:i*45,...row});
 }
 const improved=report.focusViews.filter(v=>v.enabled.visible>v.disabled.visible+5);
 // If prepared woodland cameras have no relevant leaves, do not invent a gain.
 check('real woodland views clear body-covering foliage while keeping rigid wood visible',improved.length>0&&report.focusViews.every(v=>v.enabled.foliage===0&&v.enabled.wood>=v.disabled.wood&&v.enabled.visible>=v.disabled.visible)&&report.focusViews.every(v=>v.enabled.visibleFraction>.88),{improved:improved.length,views:report.focusViews});
 report.actualFocusGainObserved=improved.length>0;
 check('no browser or shader errors',!report.errors.length,report.errors);
 report.pass=true;await page.close();
}catch(error){report.pass=false;report.failure=error.stack;console.error(error);}finally{fs.writeFileSync(B+'/check-'+phase+(fault?'-'+fault.slice(2):'')+'.json',JSON.stringify(report,null,2));await browser.close();if(!report.pass)process.exitCode=1;}})();
