const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/capture-fire-paving.cjs'),fault=process.argv.find(s=>s.startsWith('--fault='))?.split('=')[1];let s=fs.readFileSync(file,'utf8');s=s.slice(0,s.indexOf('for(const [id,camera'));
s=s.replace("B='reports/2026-10-24/evidence/fire-paving'","B='reports/2026-10-24/evidence/fire-masonry'").replace('shots:[],errors:[]','shots:[],errors:[],checks:[]').replace("await p.locator('#title .go').click();","await p.locator('#title .go').click({noWaitAfter:true,timeout:90000});");
if(fault==='layout')s=s.replace("await p.goto(","await p.route('**/foundry-static-v03.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync('assets/models/fire-temple/foundry-static-v01.glb')}));await p.goto(");
s+=`
${fault==='color'?"await p.evaluate(()=>{game.room.scene.traverse(o=>{if(o.isMesh&&o.material.name==='Fire coursed basalt'){const a=o.geometry.attributes.color;a.array.fill(a.normalized?(a.array instanceof Uint8Array?255:65535):1);a.needsUpdate=true;}});});":''}
const data=await p.evaluate(async metrics=>{const T=await import('/vendor/three/build/three.module.js'),scene=game.room.scene;scene.updateMatrixWorld(true);const result={rays:[],materials:[]};
for(const [kind,spec]of Object.entries(metrics)){const meshes=[],prefixes={fracture:['fracture-static-v03','fracture-static-v02'],foundry:['foundry-static-v03','Foundry'],steam:['steam-static-v03','Steam'],sanctum:['sanctum-static-v03','sanctum-static-v02']}[kind];scene.traverse(o=>{if(o.isMesh&&prefixes.some(n=>o.name.startsWith(n)))meshes.push(o);});
const wallMeshes=meshes.filter(o=>o.material.name.startsWith('Fire coursed')||o.material.name==='Fire recessed mortar');const targets=wallMeshes.length?wallMeshes:meshes.filter(o=>['Basalt • charcoal','Basalt • blue grey bevels','Recesses and grout'].includes(o.material.name));
const web=a=>new T.Vector3(a[0],a[2],-a[1]);
for(const g of spec.groups)for(const side of [-1,1]){const a=g.axis,t=g.thicknessAxis,lo=g.originalMin,hi=g.originalMax,mid=lo.map((n,i)=>(n+hi[i])/2),height=(hi[2]-lo[2])/g.courses;
const cast=(along,row)=>{const p=[...mid];p[a]=lo[a]+g.step*along;p[2]=lo[2]+height*(row+.5);p[t]=side<0?lo[t]-.5:hi[t]+.5;const d=[0,0,0];d[t]=-side;const ray=new T.Raycaster(web(p),web(d),0,1);const hit=ray.intersectObjects(targets,false)[0];if(!hit)return null;return{coordinate:[hit.point.x,-hit.point.z,hit.point.y][t],material:hit.object.material.name};};
const even=cast(.5,0),odd=cast(.5,1);result.rays.push({kind,wall:g.core,side,even,odd,recess:even&&odd?side*(even.coordinate-odd.coordinate):null});}
const wall=meshes.find(o=>o.material.name==='Fire coursed basalt'),a=wall?.geometry.attributes.color;let min=1,max=0;if(a)for(let i=0;i<a.count;i++){const c=a.getX(i);min=Math.min(min,c);max=Math.max(max,c);}result.materials.push({kind,texture:!!wall?.material.map,colorAttribute:!!a,min,max,roughness:wall?.material.roughness});}
const w=game.room.world,save=JSON.stringify(w.snapshot(game.roomActor));result.save=w.restore(JSON.parse(save))&&save===JSON.stringify(w.snapshot(game.roomActor));result.atmosphere=w.scene.userData.fireAtmosphere?.loaded;return result;},JSON.parse(fs.readFileSync('art/fire-masonry/v01/metrics.json')));
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);};report.measurements=data;
check('all 27 walls have alternating recessed joints on both faces',data.rays.length===54&&data.rays.every(r=>r.even&&r.odd&&r.recess>.068&&r.recess<.082),data.rays.filter(r=>!r.even||!r.odd||r.recess<=.068||r.recess>=.082));
check('four authored wall textures and primary vertex shades load',data.materials.length===4&&data.materials.every(m=>m.texture&&m.colorAttribute&&m.min>.8&&m.min<.94&&m.max>.99&&m.max-m.min>.08&&m.roughness>.85),data.materials);
check('native save and connected caldera are preserved',data.save&&data.atmosphere);
check('no browser exceptions',report.errors.length===0,report.errors);report.pass=report.checks.every(c=>c.pass);if(!report.pass)process.exitCode=1;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(B+'/check${fault?'-'+fault:''}.json',JSON.stringify(report,null,2));await browser.close();}})();
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
