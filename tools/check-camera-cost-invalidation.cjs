const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),fixture=require('./camera-cost-fixture.cjs');
const phase=process.env.CAMERA_COST_PHASE||'after',fault=process.argv.includes('--fault'),report={phase,fault,checks:[],scope:'Synthetic callbacks alter the shared ray on a miss; no game save or browser.'};
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);assert(pass,name);};
(async()=>{
 const T=await import(pathToFileURL(path.resolve('vendor/three/build/three.module.js')).href),context=vm.createContext({console}),modules=new Map(),three=new vm.SyntheticModule(Object.keys(T),function(){for(const[k,v]of Object.entries(T))this.setExport(k,v);},{context});
 async function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);let source=fixture.source(file,phase);if(fault&&file.endsWith('SceneRayQuery.js')){const from='if(!hit)this.boxRange.set(raycaster.ray,raycaster.far);';assert(source.includes(from),'callback invalidation fault marker');source=source.replace(from,'/* deliberate stale caster range after callback */');}const m=new vm.SourceTextModule(source,{context,identifier:file});modules.set(file,m);await m.link(spec=>spec==='three'?three:load(path.resolve(path.dirname(file),spec)));return m;}
 const module=await load('src/render/SceneRayQuery.js');await module.evaluate();const{SceneRayQuery}=module.namespace;
 for(const variant of['origin','direction','far'])for(const callback of['raw','any']){
  const box=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({side:T.DoubleSide}));box.position.set(5,0,-3);box.updateMatrixWorld(true);
  const custom=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial());custom.position.x=100;custom.updateMatrixWorld(true);
  const mutate=ray=>{if(variant==='origin')ray.ray.origin.x=5;else if(variant==='direction')ray.ray.direction.set(5,0,-7).normalize();else ray.far=20;return false;};
  if(callback==='raw')custom.raycast=ray=>{mutate(ray);};else custom.raycastAny=mutate;
  const caster=new T.Raycaster(new T.Vector3(variant==='far'?5:0,0,4),new T.Vector3(0,0,-1),0,variant==='far'?.1:20),reference=caster.clone?caster.clone():new T.Raycaster(caster.ray.origin.clone(),caster.ray.direction.clone(),caster.near,caster.far);mutate(reference);
  const expected=[];T.Mesh.prototype.raycast.call(box,reference,expected);
  const q=new SceneRayQuery();q.update([custom,box]);const actual=q.any(caster);
  check(callback+' callback changing '+variant+' refreshes subsequent spatial tests',expected.length>0&&actual===true,{hits:expected.length,actual,fallback:q.stats.fallback});
 }
 report.pass=true;
})().catch(e=>{report.pass=false;report.failure=e.stack;console.error(e.message);process.exitCode=1;}).finally(()=>fs.writeFileSync(fixture.B+'/'+phase+'-callback'+(fault?'-fault':'')+'.json',JSON.stringify(report,null,2)));
