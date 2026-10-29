const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const A='art/arrival-coherence/v01/combined',B='reports/2026-10-27/evidence/arrival-coherence',fault=process.argv.includes('--fault'),report={previewOnly:true,fault,checks:[],trials:[]};
(async()=>{
 const context=vm.createContext({console,performance}),cache=new Map();
 async function load(file){if(cache.has(file))return cache.get(file);let source=fs.readFileSync(file,'utf8');if(fault&&file.endsWith('preview-src__sphere__SurfaceActor.js'))source=source.replace('this.maxStepHeight = .22','this.maxStepHeight = 0');const m=new vm.SourceTextModule(source,{context,identifier:file});cache.set(file,m);await m.link(s=>load(s==='three'?'vendor/three/build/three.module.js':file.includes('preview-')?'src/sphere/'+s.replace('./',''):path.posix.normalize(path.posix.dirname(file)+'/'+s)));await m.evaluate();return m;}
 const T=(await load('vendor/three/build/three.module.js')).namespace,{SurfaceActor}=(await load(A+'/preview-src__sphere__SurfaceActor.js')).namespace;
 function planet(height){const p={R:68,heightAt:height,surfaceAt(d){const v=d.clone().normalize();return v.multiplyScalar(this.R+height(v));},projectToSurface(v){v.normalize();return v.multiplyScalar(this.R+height(v));}};return p;}
 function run(kind,h,dt){const p=planet(d=>{const x=Math.atan2(d.z,d.y)*68;return kind==='slope'?Math.max(0,x)*h:x>=0?h:0;}),a=new SurfaceActor(p);a.position.copy(p.surfaceAt(new T.Vector3(0,Math.cos(-.7/68),Math.sin(-.7/68))));a.heading.set(0,0,1);a._initFrame();a.maxClimbTan=1.3;let max=0;for(let i=0;i<Math.ceil(1/dt);i++){const d=new T.Vector3(0,0,1).addScaledVector(a.up,-a.up.z).normalize();a.move(d,dt,3.6);max=Math.max(max,a.position.length()-68);}return{kind,h,dt,end:Math.atan2(a.position.z,a.position.y)*68,max};}
 for(const dt of[1/120,1/60,1/30])for(const [kind,h]of[['step',.16],['step',.22],['step',.6],['slope',3]])report.trials.push(run(kind,h,dt));
 const check=(name,pass)=>{report.checks.push({name,pass});assert(pass,name);};
 check('native actor crosses a low stone lip at 120/60/30 Hz',report.trials.filter(t=>t.kind==='step'&&t.h<=.22).every(t=>t.end>1&&Math.abs(t.max-t.h)<1e-6));
 check('high ledges and continuous steep slopes stay blocked',report.trials.filter(t=>t.h>.22).every(t=>t.end<.4&&t.max<.23));
 report.pass=true;console.log(JSON.stringify(report));
})().catch(e=>{report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(()=>fs.writeFileSync(B+'/step-'+(fault?'fault':'normal')+'.json',JSON.stringify(report,null,2)));
