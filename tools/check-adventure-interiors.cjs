// Isolated contexts; real E/carry/walk for the first puzzle. Other room entries and
// five final-entry orbs are fixtures, explicitly not six-temple completion proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'reports/2026-10-22/evidence/adventure-interiors');fs.mkdirSync(OUT,{recursive:true});
const fault=process.argv.find(a=>a.startsWith('--break-'))||null;
const report={fault,checks:[],errors:[],actualInputScope:'First balance puzzle and its door. Other scenes are staged entry/material checks; final-entry orbs are fixtures.'};
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});assert.ok(pass,name+': '+JSON.stringify(details));console.log('PASS '+name);};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/THREE|Shader|ERROR:/.test(m.text()))report.errors.push(m.text());});
if(fault==='--break-glyph')await p.route('**/interior-witness-v01.glb',r=>r.fulfill({status:404,body:'intentional missing model'}));
await p.goto(process.env.AUDIT_URL||'http://127.0.0.1:5512/');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();
await p.evaluate(async()=>{game.loop.stop();game.dialogue.close();game.brief.hide();(await import('./src/render/Quality.js')).quality.pin('mid');
window.ia={async enter(id){if(game.mode==='room')game.exitShrine();if(id==='strata')for(const s of game.shrines.shrines.slice(0,5))game.shrines.markCleared(s);if(id!=='ship'){const s=game.shrines.shrines[game.SHRINES.findIndex(s=>s.id===id)],r=game.roomFor(s);await r.ready;game.enterShrine(s);}game.dialogue.close();game.brief.hide();await game.engine.interiorArt?.ready;await game.room?.interiorArt?.ready;},
 tick(n=1,intent={}){for(let i=0;i<n;i++){game.dialogue.close();game.brief.hide();game.input.setTestIntent(intent);game.step(1/60);}},
 walk(x,z){const a=game.roomActor;let n=0;while(Math.hypot(x-a.position.x,z-a.position.z)>.1&&n++<2400){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1});}if(n>=2400)throw Error('actual walk blocked '+[x,z,...a.position.toArray()]);this.tick();},
 act(){this.tick(1,{action:true});this.tick();}};});
const maps=[];
async function materialCheck(id){
await p.evaluate(id=>ia.enter(id),id);
if(fault==='--break-environment')await p.evaluate(()=>game.engine.scene.environment=null);
const data=await p.evaluate(async()=>{const T=await import('three'),scene=game.engine.scene,r=game.engine.renderer,old=r.getRenderTarget(),camera=new T.PerspectiveCamera(45,1,.1,20);camera.position.set(0,0,3);const probe=new T.Scene(),m=new T.MeshStandardMaterial({color:0xb99a68,metalness:1,roughness:.32}),mesh=new T.Mesh(new T.SphereGeometry(.8,32,20),m);probe.add(mesh);const rt=new T.WebGLRenderTarget(64,64,{type:T.FloatType}),a=new Float32Array(64*64*4),b=new Float32Array(a.length);r.setRenderTarget(rt);r.render(probe,camera);r.readRenderTargetPixels(rt,0,0,64,64,a);probe.environment=scene.environment;r.render(probe,camera);r.readRenderTargetPixels(rt,0,0,64,64,b);let energy=0,lit=0,changed=0;for(let i=0;i<a.length;i+=4){for(let k=0;k<3;k++)energy+=Math.abs(a[i+k]-b[i+k]);if(b[i]+b[i+1]+b[i+2]>20)lit++;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>.0001)changed++;}const mask=new T.MeshBasicMaterial({color:0xffffff});mesh.material=mask;r.render(probe,camera);r.readRenderTargetPixels(rt,0,0,64,64,a);let coverage=0;for(let i=0;i<a.length;i+=4)if(a[i]>.5)coverage++;r.setRenderTarget(old);rt.dispose();mesh.geometry.dispose();m.dispose();mask.dispose();return{changed,coverage,assigned:!!scene.environment,map:scene.environment?.uuid,energy,lit,info:scene.userData.interiorDirection};});
check(id+' environment assigned',data.assigned,data);
check(id+' actual linear HDR reflection changes pixels',data.energy>1&&data.coverage>500&&data.changed/data.coverage>.9,data);
maps.push(data.map);
if(id==='ship')return;
if(fault==='--break-clearance')await p.evaluate(()=>{const a=game.room.interiorArt,m=a.meshes[0],T=m.matrixWorld.constructor,mat=new T();m.getMatrixAt(0,mat);mat.elements[12]=0;mat.elements[14]=a.bindings[0].point.z;m.setMatrixAt(0,mat);});
const kit=await p.evaluate(async()=>{const T=await import('three'),r=game.room.interiorArt;if(!r)return{};let minGap=Infinity,seatError=0;for(let i=0;i<r.bindings.length;i++){const d=r.bindings[i],inverse=new T.Matrix4().makeRotationY(-d.yaw);for(let j=0;j<2;j++){const box=new T.Box3(),mat=new T.Matrix4();r.meshes[0]?.getMatrixAt(i*2+j,mat);const geo=r.meshes[0]?.geometry;if(!geo)continue;for(const part of r.meshes){part.getMatrixAt(i*2+j,mat);const attr=part.geometry.getAttribute('position');for(let v=0;v<attr.count;v++){const p=new T.Vector3().fromBufferAttribute(attr,v).applyMatrix4(mat).sub(d.point).applyMatrix4(inverse);box.expandByPoint(p);}}minGap=Math.min(minGap,Math.min(Math.abs(box.min.x),Math.abs(box.max.x))-d.halfWidth);seatError=Math.max(seatError,Math.abs(box.min.y));}}return{count:r.bindings.length,meshes:r.meshes.length,minGap,seatError,occluders:r.meshes.slice(0,2).every(m=>game.room.dungeon.rects.cameraOccluders?.includes(m)),profile:r.scene.userData.interiorDirection?.profile};});
check(id+' actual Blender glyphs instanced',kit.meshes===3&&kit.count>=3,kit);
check(id+' physical geometry keeps passage clear and floor seated',kit.minGap>=.099&&kit.seatError<1e-5&&kit.occluders,kit);
}
await materialCheck('ship');await materialCheck('balance');
check('unresolved door starts dim',await p.evaluate(()=>game.room.interiorArt.bindings.every(b=>b.on===false)));
if(fault==='--break-witness-collision')await p.evaluate(()=>{game.roomActor.obstacles=game.roomActor.obstacles.filter(o=>!o.interiorWitness);});
const body=await p.evaluate(()=>{const r=game.room,b=r.interiorArt.bindings[0],p=b.positions[1],a=game.roomActor;a.setAt(p[0],p[2]+2);a.camYaw=0;ia.tick(100,{y:1});const stopped=Math.abs(a.position.z-p[2]);a.position.set(...p);const embedded=a.position.clone();a._pushOut(a.position);const recovered=a.position.distanceTo(embedded);a.position.set(p[0],p[1]+2.5,p[2]);const above=a.position.clone();a._pushOut(a.position);return{stopped,oldSaveRecovered:recovered>.439,aboveUntouched:a.position.distanceTo(above)<1e-6};});
check('actual input stops at witness; embedded save and other floors recover correctly',body.stopped>=.439&&body.stopped<.55&&body.oldSaveRecovered&&body.aboveUntouched,body);
if(fault==='--break-signal')await p.evaluate(()=>game.room.interiorArt.bindings[0].read=()=>false);
const solve=await p.evaluate(async()=>{const T=await import('three'),r=game.room,g=r.gates[0].gate,t=ia;
r.restart();r.hasProgress=true;game.roomActor.setAt(0,10);t.walk(g.choices.find(c=>c.n===3).x,4.2);t.act();if(g.count!==3)throw Error('Actual count selection failed');
for(let i=0;i<3;i++){const h=g.stock[i].home;t.walk(5.5,3.5);t.walk(h.x,h.z+.8);t.act();if(g.held!==i)throw Error('Actual pickup failed');t.walk(5.5,3.5);t.walk(5.5,-8.1);t.walk(g.cells[i].x,-8.1);t.act();}
let n=0;while(!r.dungeon.doors.r1.opened&&n++<180)t.tick();t.tick(12);const binding=r.interiorArt.bindings.find(b=>b.id==='r1'),colour=new T.Color();r.interiorArt.light.getColorAt(0,colour);const sign={on:binding.on,age:binding.age,rgb:colour.toArray()};
t.tick(80);game.roomActor.camYaw=0;game.roomActor._camPlaced=false;game.roomActor.updateCamera(game.engine.camera,game.input,0);game.engine.render();return{solved:g.solved,opened:r.dungeon.doors.r1.rect.open,sign};});
check('actual E carrying solves and lights the correct door',solve.solved&&solve.opened&&solve.sign.on&&solve.sign.rgb[1]>.4,solve);
await p.screenshot({path:path.join(OUT,'actual-solved-signal.png')});
const crossed=await p.evaluate(()=>{ia.walk(5.5,-9);ia.walk(0,-10);ia.walk(0,-18);game.engine.render();return game.roomActor.position.z;});
check('actual input crosses the newly lit passage',crossed< -17,{z:crossed});
await p.screenshot({path:path.join(OUT,'actual-first-door.png')});
const restoration=await p.evaluate(async()=>{const r=game.room,a=r.interiorArt,s=r.exportState(game.roomActor),before=JSON.stringify(s),{syncInteriorScene}=await import('./src/render/InteriorDirection.js');syncInteriorScene(r.scene,.25);syncInteriorScene(r.scene,.25);const unchanged=JSON.stringify(r.exportState(game.roomActor))===before,restored=r.importState(s);return{unchanged,restored,steady:a.bindings[0].age===a.spec.witness.pulseSeconds,solved:a.bindings[0].on};});
check('render feedback cannot change exported puzzle/save state',restoration.unchanged,restoration);
check('save restoration is steady, without replaying celebration',restoration.restored&&restoration.steady&&restoration.solved,restoration);
await p.emulateMedia({reducedMotion:'reduce'});
const accessibility=await p.evaluate(async()=>{const T=await import('three'),r=game.room,a=r.interiorArt,{syncInteriorScene}=await import('./src/render/InteriorDirection.js'),{quality}=await import('./src/render/Quality.js');a.bindings[0].age=.3;syncInteriorScene(r.scene,0);const c=new T.Color();a.light.getColorAt(0,c);const reduced=Math.abs(c.r-a.solved.r)+Math.abs(c.g-a.solved.g)+Math.abs(c.b-a.solved.b)<1e-6;quality.pin('min');game.engine.render();const visible=a.meshes.every(m=>m.visible);quality.pin('mid');r.restart();return{reduced,visible,reset:a.bindings.every(b=>!b.on)};});
check('reduced motion, lowest quality and restart preserve clear status',accessibility.reduced&&accessibility.visible&&accessibility.reset,accessibility);
await p.emulateMedia({reducedMotion:'no-preference'});
for(const id of ['shadow','sift','water','fire','strata'])await materialCheck(id);
if(fault==='--break-twilight')await p.evaluate(()=>{game.room.scene.traverse(o=>{if(o.isHemisphereLight)o.intensity=.35;});});
const twilight=await p.evaluate(()=>{let light;game.room.scene.traverse(o=>{if(o.isHemisphereLight)light=o;});return{intensity:light?.intensity,sky:light?.color.toArray(),skyLuma:light?light.color.r*.2126+light.color.g*.7152+light.color.b*.0722:0};});
check('twilight front fill remains separate from star count',twilight.intensity>.6&&twilight.skyLuma>.3,twilight);
check('seven independently authored environment maps',new Set(maps).size===7,maps);
const src=JSON.parse(fs.readFileSync(path.join(ROOT,'art/adventure-interiors/v01/design-spec.json'))),runtime=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/models/adventure/interior-art-v01.json'))),metrics=JSON.parse(fs.readFileSync(path.join(ROOT,'art/adventure-interiors/v01/model-metrics.json')));
check('runtime uses shared authored contract',JSON.stringify(src)===JSON.stringify(runtime));
check('editable Blender source, byte and geometry budgets',fs.statSync(path.join(ROOT,'art/adventure-interiors/v01/interior-witness-v01.blend')).size>10000&&metrics.bytes<src.budget.glbBytesMax&&metrics.models.every(m=>m.triangles<src.budget.trianglesPerGlyphMax&&m.webFloorY===0),metrics);
check('no browser or shader errors',!report.errors.length,report.errors);report.pass=true;
}catch(e){report.failure=e.stack;report.pass=false;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(path.join(OUT,(fault?fault.slice(2):'report')+'.json'),JSON.stringify(report,null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
