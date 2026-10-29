const fs=require('node:fs'),path=require('node:path'),fixture=require('./arrival-dais-fixture.cjs'),{A,B}=fixture;
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),phase=process.argv[2]||'goal',fault=(process.argv.find(x=>x.startsWith('--fault='))||'').slice(8);
const report={phase,fault,checks:[],errors:[]};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));
 await fixture.prepare(p,phase,'mid',{transform:(file,body)=>{
   if(fault==='contact'&&file==='src/world/LandmarkAssets.js')return body.replace('y-.22+.006','y-.22+.36');
   if(fault==='surface'&&file==='src/world/MeadowField.js')return body.replace("return(hash>>>0).toString(16);","return 'deliberately-mismatched-surface';");
   if(fault==='soil'&&file==='src/boot.js')return body.replace("const arrivalSite=planet.levelSite('arrival-dais',landingDir,3.2,5.2,false);",'const arrivalSite=null;').replace('grassAt: d => scatter.grassAt(d)*THREE.MathUtils.smoothstep(d.angleTo(landingDir)*R,2.64,2.95), pathAt: planetPathAt','grassAt: scatter.grassAt, pathAt: planetPathAt');
   return body;
 }});
 const data=await p.evaluate(()=>{
   const group=game.landing.group.getObjectByName('Mumu authored arrival dais');if(!group)return{missing:true};
   group.updateWorldMatrix(true,true);const meshes=group.children.filter(m=>m.isMesh),ray=new T.Raycaster(),frame=game.planet.frameAt(game.landing.pos),q=frame.quaternion,up=game.landing.dir,point=new T.Vector3(),direction=new T.Vector3();
   const samples=[];
   for(const r of [.08,.4,.8,1.3,1.8,2.12,2.3,2.43,2.55])for(let i=0;i<32;i++){
     const a=(i+.31)*Math.PI/16;point.set(Math.cos(a)*r,0,Math.sin(a)*r).applyQuaternion(q).add(game.landing.pos);direction.copy(point).normalize();
     const native=game.planet.surfaceAt(direction,new T.Vector3());ray.set(native.clone().addScaledVector(direction,2),direction.clone().negate());ray.far=4;
     const floor=ray.intersectObjects(meshes,false)[0],soil=ray.intersectObjects([game.planet.mesh,game.carpet.mesh],false)[0];
     samples.push({r,angle:a,native:native.length(),floor:floor?.point.length()??null,soil:soil?.point.length()??null,gap:floor?floor.point.length()-native.length():null,clear:!!floor&&(!soil||floor.distance<=soil.distance+.002)});
   }
   return{asset:group.userData,triangles:meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),materials:meshes.map(m=>({name:m.name,map:!!m.material.map,normalMap:!!m.material.normalMap,metalness:m.material.metalness,emissiveIntensity:m.material.emissiveIntensity})),samples,field:game.meadowField,site:game.planet.levelSites.find(s=>s.id==='arrival-dais'),support:game.planet.arrivalSupport?{height:game.planet.arrivalSupport.height,inner:game.planet.arrivalSupport.inner,outer:game.planet.arrivalSupport.outer}:null,cameraMeshes:meshes.filter(m=>game.worldCamera.entries.some(e=>e.source===m)).length,legacyPosts:game.landing.group.children.filter(m=>m.geometry?.type==='BoxGeometry'&&m.geometry.parameters.height===.9).length,routeCount:game.worldTrails.routes.filter(r=>r.reachable).length};
 });
 const contract=JSON.parse(fs.readFileSync(A+'/exports/arrival-dais-v03.json'));
 check('actual authored geometry and four material parts loaded',!data.missing&&data.asset.meshes===4&&data.triangles===contract.triangles&&data.triangles<=17000&&data.legacyPosts===0,{asset:data.asset,triangles:data.triangles,sourceTriangles:contract.triangles,legacyPosts:data.legacyPosts});
 check('stone mineral colour and normal textures with seated glass and bronze',data.materials.find(m=>m.name==='Arrival_Weathered')?.map&&data.materials.find(m=>m.name==='Arrival_Weathered')?.normalMap&&data.materials.find(m=>m.name==='Arrival_Aged')?.metalness<=.3&&data.materials.find(m=>m.name==='Arrival_Seated')?.emissiveIntensity>0,data.materials);
 const missing=data.samples.filter(s=>s.gap===null),maxGap=Math.max(...data.samples.filter(s=>s.gap!==null).map(s=>Math.abs(s.gap))),covered=data.samples.filter(s=>!s.clear);
 fs.writeFileSync(B+'/floor-samples-'+phase+(fault?'-fault-'+fault:'')+'.json',JSON.stringify(data.samples,null,2));
 check('visible floor follows native walking support without soil or grass covering it',!missing.length&&maxGap<=.05&&covered.length<=Math.floor(data.samples.length*.025),{sampleCount:data.samples.length,missing:missing.length,maxAbsoluteGap:maxGap,covered:covered.length,examples:covered.slice(0,6),worst:data.samples.slice().sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(0,5)});
 check('baked surface matches physical levelled patch and new route signature',data.field.loaded&&data.field.signature===data.field.expected&&data.field.materials===2&&data.site?.inner===3.2&&data.support?.height===.16&&data.routeCount===6,{field:data.field,site:data.site,support:data.support,routeCount:data.routeCount});
 check('all four actual opaque model parts join camera collision',data.cameraMeshes===4,{cameraMeshes:data.cameraMeshes});
 check('no browser exceptions',!report.errors.length,report.errors);report.pass=true;
 }catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(B+'/check-'+phase+(fault?'-fault-'+fault:'')+'.json',JSON.stringify(report,null,2));await browser.close();}})();
