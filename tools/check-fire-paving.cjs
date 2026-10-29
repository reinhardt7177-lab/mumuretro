const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/capture-fire-paving.cjs'),fault=process.argv.find(s=>s.startsWith('--fault='))?.split('=')[1];
let src=fs.readFileSync(file,'utf8');src=src.slice(0,src.indexOf('for(const [id,camera'));
src=src.replace('shots:[],errors:[]','shots:[],errors:[],checks:[]');
if(['hub','sanctum'].includes(fault)){const k=fault==='hub'?'fracture':'sanctum';src=src.replace("if(phase==='goal')",`await p.route('**/${k}-static-v02.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync('assets/models/fire-temple/${k}-static-v01.glb')}));if(phase==='goal')`);}
src+=`
const data=await p.evaluate(async()=>{const T=await import('/vendor/three/build/three.module.js'),w=game.room.world;w.scene.updateMatrixWorld(true);const hub=[],sanctum=[];w.scene.traverse(o=>{if(!o.isMesh)return;if(o.name.startsWith('fracture-static-v02')||o.name.startsWith('Fracture'))hub.push(o);});w.sanctum.root.children[0].traverse(o=>{if(o.isMesh)sanctum.push(o);});
const samples=(meshes,r,z,y)=>Array.from({length:12},(_,i)=>{const a=(i+.17)*Math.PI*2/12,x=Math.cos(a)*r,zz=z+Math.sin(a)*r;const ray=new T.Raycaster(new T.Vector3(x,y+.08,zz),new T.Vector3(0,-1,0),0,.20);return{x,z:zz,top:ray.intersectObjects(meshes,false)[0]?.point.y,collision:w.rects.floorAt(x,zz,y)};});
const save=JSON.stringify(w.snapshot(game.roomActor));return{hub:samples(hub,9.6,0,0),sanctum:samples(sanctum,3.4,-50,3.2),stateRoundTrip:w.restore(JSON.parse(save))&&save===JSON.stringify(w.snapshot(game.roomActor)),meshes:{hub:hub.length,sanctum:sanctum.length},textures:hub.filter(o=>o.material.map).length};});
report.measurements=data;const check=(name,pass)=>{report.checks.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name);};
check('hub has grounded paving instead of raised decorative circles',data.hub.every(p=>p.top>=-.041&&p.top<=.002&&p.collision===0));
check('sanctum has no raised floor circles and keeps its 3.2m walking level',data.sanctum.every(p=>p.top>=3.10&&p.top<=3.202&&p.collision===3.2));
check('authored basalt texture is loaded',data.textures>0);
check('native fire save round trip remains exact',data.stateRoundTrip);
check('no browser exceptions',report.errors.length===0);
report.pass=report.checks.every(c=>c.pass);if(!report.pass)process.exitCode=1;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(B+'/check${fault?'-'+fault:''}.json',JSON.stringify(report,null,2));await browser.close();}})();
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(src,file);
