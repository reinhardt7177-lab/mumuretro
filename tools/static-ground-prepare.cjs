const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const A='art/arrival-coherence/v01/static-ground',B='reports/2026-10-27/evidence/arrival-static-ground',C='art/arrival-coherence/v01/combined';
assert(!fs.existsSync(A+'/manifest.json'),'Preserve static ground baseline');fs.mkdirSync(A+'/snapshot/exports',{recursive:true});fs.mkdirSync(B,{recursive:true});
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const combined=JSON.parse(fs.readFileSync(C+'/manifest.json')),snapshot=[];
for(const row of combined.files){const out=A+'/snapshot/'+path.basename(row.preview);fs.copyFileSync(row.preview,out);snapshot.push({file:row.file,preview:out,sha256:sha(out)});}
const assets=[];for(const row of combined.assets){const out=A+'/snapshot/exports/'+path.basename(row.preview);fs.copyFileSync(row.preview,out);assets.push({file:row.file,preview:out,sha256:sha(out)});}
const files=['src/world/Scatter.js','src/world/Forage.js','src/world/Kitchen.js','src/world/Waterway.js'],changes=[];
const swap=(s,a,b)=>{assert(s.includes(a),'Missing source '+a);return s.replace(a,b);};
const exactHeight=(radius,withLift)=>`let y=${radius} + planet.groundHeightAt(_gn.copy(w).normalize()) - w.length();
    if(planet.meshGroundActive){
      const base=w.clone(),axis=new THREE.Vector3(0,1,0).transformDirection(g.matrixWorld),probe=new THREE.Vector3(),normal=new THREE.Vector3();
      const gap=height=>{probe.copy(base).addScaledVector(axis,height);return probe.length()-${radius}-planet.groundHeightAt(normal.copy(probe).normalize());};
      for(let i=0;i<4;i++){const error=gap(y);if(Math.abs(error)<1e-7)break;const derivative=(gap(y+.01)-error)/.01;if(!Number.isFinite(derivative)||Math.abs(derivative)<.05)break;y-=error/derivative;}
    }
    return y${withLift?'+lift':''};`;
for(const file of files){const old='src/'+file.slice(4),previous=A+'/before-'+file.replaceAll('/','__'),out=A+'/preview-'+file.replaceAll('/','__');fs.copyFileSync(old,previous);let body=fs.readFileSync(old,'utf8');
 if(file.endsWith('/Scatter.js')){
  body=swap(body,'radius=planet.surfaceAt(position.clone().normalize()).length()','radius=planet.groundSurfaceAt(position.clone().normalize()).length()');
  body=swap(body,'c.matrix.setPosition(planet.surfaceAt(c.dir));delete c.branchCollider;','c.matrix.setPosition(planet.groundSurfaceAt(c.dir));delete c.branchCollider;');
 }
 if(file.endsWith('/Forage.js')){
  body=swap(body,'const fr = planet.frameAt(planet.surfaceAt(dir), 0);','const fr = planet.frameAt(planet.surfaceAt(dir), 0);\n    // Keep the authored orientation; frameAt itself reprojects analytically.\n    fr.position.copy(planet.groundSurfaceAt(dir));');
  body=swap(body,'return planet.R + planet.heightAt(_gn.copy(w).normalize()) - w.length();',exactHeight('planet.R',false));
  for(const p of ['_pa.copy(up)','_pb.copy(up).addScaledVector(_e1, d).normalize()','_pc.copy(up).addScaledVector(_e2, d).normalize()'])body=swap(body,'planet.surfaceAt('+p+',','planet.groundSurfaceAt('+p+',');
 }
 if(file.endsWith('/Kitchen.js')){
  body=swap(body,'const fr = planet.frameAt(planet.surfaceAt(kdir), 0);','const fr = planet.frameAt(planet.surfaceAt(kdir), 0);\n  // Height only: preserve kdir, local axes, recipe coordinates and interaction.\n  fr.position.copy(planet.groundSurfaceAt(kdir));');
  body=swap(body,'return R + planet.heightAt(_gn.copy(w).normalize()) - w.length() + lift;',exactHeight('R',true));
 }
 if(file.endsWith('/Waterway.js'))body=swap(body,'return planet.surfaceAt(d).addScaledVector(d, liftAt(d) + lift);','return planet.groundSurfaceAt(d).addScaledVector(d, liftAt(d) + lift);');
 new vm.SourceTextModule(body,{identifier:file});fs.writeFileSync(out,body);changes.push({file,before:previous,beforeSha256:sha(previous),preview:out,sha256:sha(out)});
}
// Existing source files remain external originals. This is a separate, frozen
// combined fixture plus four height-only alternatives, never a root install.
const manifest={createdUtc:new Date().toISOString(),A,B,combinedSource:C,combinedSnapshot:snapshot,assets,changes,status:'preview only; initial analytic fallback remains until mesh index enabled',enable:'After paintTrail and enableMeshGround, call scatter.reseat() again before camera entries are constructed',soilVsCarpet:'scatter/root anchors use bare rendered soil; Forage layFlat keeps carpet lift; Kitchen keeps its authored carpet lift; Waterway keeps carpet lift + authored offset',rootUnchanged:changes.every(r=>sha(r.file)===r.beforeSha256)};
assert(manifest.rootUnchanged);fs.writeFileSync(A+'/manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({files:changes.map(r=>r.file),snapshotModules:snapshot.length,snapshotAssets:assets.length,rootUnchanged:true}));
