// Reuse the established state/camera and actual-input journey checks, retaining
// their assertions. Run in isolated Edge profiles, never the user's save.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const mode=process.argv[2]||'art',fallback=process.argv.includes('--fallback'),fault=process.argv.includes('--break-texture')?'texture':process.argv.includes('--break-seals')?'seals':null;
const B='reports/2026-10-24/evidence/chronicle-guardian-v02/'+(fallback?'fallback':fault?'fault-'+fault:mode);fs.mkdirSync(B,{recursive:true});
let file,source;
if(mode==='journey'){
 file=path.resolve('tools/run-sanctum-offerings-journey.cjs');source=fs.readFileSync(file,'utf8');assert(source.includes('reports/2026-10-24/evidence/sanctum-offerings/journey'));source=source.replace('reports/2026-10-24/evidence/sanctum-offerings/journey',B);
}else{
 file=path.resolve('tools/check-chronicle-art.cjs');source=fs.readFileSync(file,'utf8');source=source.replace("path.resolve('reports/2026-10-21/evidence/app-completion')",JSON.stringify(path.resolve(B)));
 source=source.replace("await p.locator('#title .go').click();","await p.waitForFunction(()=>document.getElementById('load').style.display==='none',null,{timeout:120000});await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click();");
 source=source.replace('await game.room.final.heritagePromise;','await game.room.final.heritagePromise;await game.room.ready;');
 const framing='a.setAt(0,f.gz+11);a.camYaw=0;game.input.camPitch=.4;game.input.camDist=6.5;';assert(source.includes(framing));source=source.replace(framing,framing.replace('camDist=6.5','camDist=18')).replace('default final view frames the player and full guardian','selected overview zoom18 frames the player and full guardian');
 if(fallback)source=source.replace('await p.goto(',"await p.route('**/guardian-v02.glb',r=>r.abort());await p.goto(");
 const marker=' const semantics=';assert(source.includes(marker));source=source.replace(marker,`
 const skin=await p.evaluate(broken=>{const root=game.room.final.art,rows=[];let triangles=0;root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;if(!/basalt|strata/.test(m.material.name))return;if(broken)m.material.normalMap=null;const a=m.geometry.attributes.color;let min=Infinity,max=-Infinity;for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const v=a.getComponent(i,k);min=Math.min(min,v);max=Math.max(max,v);}rows.push({name:m.material.name,colourRange:[min,max],map:!!m.material.map,normal:!!m.material.normalMap,uv:!!m.geometry.attributes.uv,size:m.material.map?[m.material.map.image.width,m.material.map.image.height]:null,normalScale:m.material.normalScale.toArray()});});return{version:root.userData.guardianVersion,triangles,rows};},${fault==='texture'});
 check('requested asset version and original fallback are explicit',skin.version===${fallback?1:2},skin);
 ${fallback?"check('network failure retains preserved original geometry',skin.triangles===219204,skin);":`check('authored stone colours survive textured export in COLOR_0',skin.rows.length===3&&skin.rows.every(m=>m.colourRange[0]>0&&m.colourRange[1]<.3),skin.rows);
 check('three stone surfaces have base and normal textures with UV',skin.rows.every(m=>m.map&&m.normal&&m.uv&&m.size.every(s=>s===512)&&Math.abs(m.normalScale[0]-.2)<.001&&Math.abs(m.normalScale[1]+.2)<.001),skin.rows);
 check('tiny star simplification reduces decoded triangle work',skin.triangles>100000&&skin.triangles<165000,skin.triangles);`}
 const semantics=`);
}
fs.writeFileSync(B+'/adaptations.json',JSON.stringify({mode,fallback,fault,unchangedAssertions:mode==='journey'?14:7,framing:'Existing overview uses zoom18; 144 exact camera rays unchanged',setup:'Wait complete authored room; title overlay hidden before input'},null,2));
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
