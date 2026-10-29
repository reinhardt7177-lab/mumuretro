const fs=require('node:fs'),path=require('node:path'),fixture=require('./field-meadow-fixture.cjs'),{A,B}=fixture;
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const phase=process.argv.find(x=>x.startsWith('--phase='))?.split('=')[1]||'goal',fault=process.argv.find(x=>x.startsWith('--fault='))?.split('=')[1],fallback=process.argv.includes('--fallback'),touch=process.argv.includes('--touch');
const key=phase+'-'+(fault|| (fallback?'fallback':touch?'touch':'normal')),out=B+'/checks';fs.mkdirSync(out,{recursive:true});
const report={phase,fault,fallback,touch,checks:[],errors:[],scope:'Isolated real GLB/shader/controller tests. Prepared gallery/cache positions and synthetic GPU proximity probes are distinct from actual expedition walking.'};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(touch?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});
 const options={transform:(file,body)=>{
  if(file==='src/world/MeadowDetail.js'&&fault==='wind'){const marker='shader.uniforms.meadowTime=clock;';if(!body.includes(marker))throw Error('Wind injection marker missing');return body.replace(marker,'shader.uniforms.meadowTime={value:0};');}
  if(file==='src/world/MeadowDetail.js'&&fault==='cache'){const marker='while(cells.size>256)';if(!body.includes(marker))throw Error('Cache injection marker missing');return body.replace(marker,'while(cells.size>256000)');}
  if(file==='src/world/MeadowField.js'&&fault==='uv'){const marker="geometry.setAttribute('meadowUV',new THREE.BufferAttribute(values,3));";if(!body.includes(marker))throw Error('UV injection marker missing');return body.replace(marker,"values.fill(0);"+marker);}
  return body;
 },asset:(file,body)=>{
  if(fallback&&file==='meadow-clusters-v01.glb')return{status:404,body:'intentional missing authored grass'};
  if(fault==='signature'&&file==='meadow-kit-v01.json'){const meta=JSON.parse(body);meta.routeSignature='intentional-mismatch';return{body:JSON.stringify(meta)};}
  return{body};
 }};
 await fixture.prepare(page,phase,'mid',options);
 await page.evaluate(async fault=>{window.fieldModule=await import('/src/world/MeadowField.js');window.fieldAssets=fieldModule.meadowAssets;window.fieldQuality=(await import('/src/render/Quality.js')).quality;if(fault==='root')for(const g of fieldAssets.clusters){g.attributes.bendWeight.setX(0,1);g.attributes.bendWeight.needsUpdate=true;}if(fault==='orientation'){fieldAssets.texture.flipY=false;fieldAssets.texture.needsUpdate=true;}},fault);
 const asset=await page.evaluate(()=>({field:game.meadowField,model:fieldAssets.modelLoaded,surface:fieldAssets.surfaceLoaded,source:game.meadow.assetSource,dimensions:fieldAssets.texture&&[fieldAssets.texture.image.width,fieldAssets.texture.image.height],materials:game.meadow.group.children.map(m=>m.material.uuid),geometry:fieldAssets.clusters.map(g=>{const p=g.attributes.position,n=g.attributes.normal,w=g.attributes.bendWeight;let roots=0,badRoots=0,tips=0,badNormals=0,radius=0;for(let i=0;i<p.count;i++){if(Math.abs(p.getY(i))<1e-6){roots++;badRoots+=Math.abs(w.getX(i))>1e-6;}if(w.getX(i)>.999)tips++;badNormals+=Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)>.001;radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));}return{vertices:p.count,triangles:(g.index?.count||p.count)/3,minY:g.boundingBox.min.y,maxY:g.boundingBox.max.y,radius,roots,badRoots,tips,badNormals};})}));
 check('actual surface signature and 1024x512 field load',asset.field.loaded&&asset.field.materials===2&&asset.dimensions?.join('x')==='1024x512',asset.field);
 check('authored four tufts or deliberate legacy model fallback',fallback?!asset.model&&asset.source==='legacy-leaf-profiles':asset.model&&asset.geometry.length===4&&asset.source==='meadow-clusters-v01',asset);
 if(asset.field.loaded){
  const uv=await page.evaluate(()=>[game.planet.mesh,game.carpet.mesh].map(mesh=>{const p=mesh.geometry.attributes.position,a=mesh.geometry.attributes.meadowUV;let bad=0,seams=0,polar=0,badPolar=0;if(!a)return{missing:true};for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),length=Math.hypot(x,y,z),u=Math.atan2(z,x)/(Math.PI*2)+.5,v=Math.asin(Math.max(-1,Math.min(1,y/length)))/Math.PI+.5,d=Math.abs(a.getX(i)-u),wrapped=Math.min(d,Math.abs(d-1));bad+=!Number.isFinite(a.getX(i))||Math.abs(a.getY(i)-v)>1e-6||(Math.abs(y/length)<1-1e-10&&wrapped>1e-6);}for(let i=0;i<p.count;i+=3){if(a.getZ(i)>.5){polar++;const vertices=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,i+k)),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,Math.sign(vertices.reduce((n,v)=>n+v.y,0)),0));badPolar+=!ray.intersectTriangle(...vertices,false,new T.Vector3());}else seams+=Math.max(a.getX(i),a.getX(i+1),a.getX(i+2))-Math.min(a.getX(i),a.getX(i+1),a.getX(i+2))>.500001;}return{vertices:p.count,uvCount:a.count,bytes:a.array.byteLength,bad,seams,polar,badPolar};}));
  check('actual terrain and carpet UVs preserve spherical vertices and unwrap longitude seams',uv.every(g=>!g.missing&&g.uvCount===g.vertices&&g.bad===0&&g.seams===0&&g.polar===2&&g.badPolar===0),uv);
 }
 if(!fallback){
  check('four GLB geometries keep floor zero,54triangles,root weights and unit normals',asset.geometry.length===4&&asset.geometry.every((g,i)=>g.triangles===54&&Math.abs(g.minY)<1e-5&&Math.abs(g.maxY-[.28,.32,.37,.42][i])<1e-5&&g.radius<.43&&g.roots>=18&&g.badRoots===0&&g.tips>=2&&g.badNormals===0),asset.geometry);
  const gpu=await page.evaluate(()=>{
   const e=game.engine,r=e.renderer,m=game.meadow,oldTarget=r.getRenderTarget(),oldClock=m.clock.value,oldPlayer=m.playerUniform.value.clone(),sample=m.placements[0],source=sample.mesh;
   const scene=new T.Scene();scene.background=new T.Color(.02,.03,.03);scene.add(new T.AmbientLight(0xffffff,2));const material=source.material.clone();material.onBeforeCompile=source.material.onBeforeCompile;
   const leaf=new T.InstancedMesh(source.geometry,material,1);leaf.setMatrixAt(0,sample.matrix);leaf.setColorAt(0,new T.Color(.45,.7,.3));leaf.instanceMatrix.needsUpdate=true;scene.add(leaf);
   const up=sample.position.clone().normalize(),side=new T.Vector3(0,1,0).cross(up).normalize(),forward=new T.Vector3().crossVectors(side,up).normalize(),camera=new T.OrthographicCamera(-.43,.43,.43,-.43,.01,10),target=new T.WebGLRenderTarget(256,256);
   camera.up.copy(up);camera.position.copy(sample.position).addScaledVector(up,.53).addScaledVector(forward,1.3);camera.lookAt(sample.position.clone().addScaledVector(up,.15));
   const render=()=>{r.setRenderTarget(target);r.render(scene,camera);const b=new Uint8Array(256*256*4);r.readRenderTargetPixels(target,0,0,256,256,b);return b;};
   const delta=(a,b)=>{let pixels=0,total=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);pixels+=d>15;total+=d;}return{pixels,total};};
   m.playerUniform.value.set(10000,10000,10000);m.clock.value=0;const still=render();m.clock.value=1.7;const wind=render();m.clock.value=0;m.playerUniform.value.copy(sample.position).addScaledVector(side,.3);const body=render();
   // Root markers copy actual root weights into small quads, then run the real
   // material's vertex deformation on GPU. They are diagnostic geometry only.
   const p=source.geometry.attributes.position,w=source.geometry.attributes.bendWeight,positions=[],normals=[],colours=[],weights=[],indices=[];
   for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i))<1e-6){const first=positions.length/3;for(const[x,z]of[[-.006,-.006],[.006,-.006],[.006,.006],[-.006,.006]]){positions.push(p.getX(i)+x,0,p.getZ(i)+z);normals.push(0,1,0);colours.push(1,1,1);weights.push(w.getX(i));}indices.push(first,first+1,first+2,first,first+2,first+3);}
   const roots=new T.BufferGeometry();roots.setAttribute('position',new T.Float32BufferAttribute(positions,3));roots.setAttribute('normal',new T.Float32BufferAttribute(normals,3));roots.setAttribute('color',new T.Float32BufferAttribute(colours,3));roots.setAttribute('bendWeight',new T.Float32BufferAttribute(weights,1));roots.setIndex(indices);leaf.geometry=roots;
   m.playerUniform.value.set(10000,10000,10000);m.clock.value=0;const rootStill=render();m.clock.value=1.7;const rootWind=render();m.playerUniform.value.copy(sample.position).addScaledVector(side,.3);const rootBody=render();
   const result={wind:delta(still,wind),body:delta(still,body),rootsWind:delta(rootStill,rootWind),rootsBody:delta(rootStill,rootBody),rootPixels:rootStill.reduce((n,v,i)=>n+(i%4===1&&v>20),0)};
   m.clock.value=oldClock;m.playerUniform.value.copy(oldPlayer);r.setRenderTarget(oldTarget);target.dispose();roots.dispose();material.dispose();leaf.dispose();return result;
  });
  check('real leaf shader moves under time and synthetic body proximity',gpu.wind.pixels>40&&gpu.body.pixels>40,gpu);
  check('GPU root markers remain fixed under wind and proximity',gpu.rootPixels>10&&gpu.rootsWind.pixels===0&&gpu.rootsBody.pixels===0,gpu);
 }
 const samples=await page.evaluate(async()=>{
  if(!fieldAssets.texture||!game.meadowField.loaded)return[];const r=game.engine.renderer,old=r.getRenderTarget(),original=game.planet.mesh.material,mat=original.clone();mat.side=T.DoubleSide;mat.onBeforeCompile=shader=>{original.onBeforeCompile(shader);const marker='diffuseColor.rgb=texture2D(uMeadowField,fieldUV).rgb;';if(!shader.fragmentShader.includes(marker))throw Error('Actual field shader absent');shader.fragmentShader=shader.fragmentShader.replace(marker,marker+'\ngl_FragColor=vec4(diffuseColor.rgb,texture2D(uMeadowField,fieldUV).a);return;');};
  // Canvas2D discards RGB where path-mask alpha is zero. Decode the actual
  // unpremultiplied filter-0 RGBA raster instead of treating hidden RGB as black.
  const png=new Uint8Array(await(await fetch('/assets/models/adventure/meadow-field-v01.png')).arrayBuffer()),view=new DataView(png.buffer),chunks=[];
  for(let offset=8;offset<png.length;){const size=view.getUint32(offset),name=String.fromCharCode(...png.subarray(offset+4,offset+8));if(name==='IDAT')chunks.push(png.slice(offset+8,offset+8+size));offset+=12+size;}
  const lines=new Uint8Array(await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()),img=new Uint8Array(1024*512*4);
  for(let y=0;y<512;y++){if(lines[y*(4096+1)]!==0)throw Error('Expected field PNG filter zero');img.set(lines.subarray(y*(4096+1)+1,(y+1)*(4096+1)),y*4096);}
  const scene=new T.Scene(),geo=new T.BufferGeometry(),mesh=new T.Mesh(geo,mat),camera=new T.OrthographicCamera(-.015,.015,.015,-.015,.01,3),target=new T.WebGLRenderTarget(8,8,{type:T.FloatType}),rows=[];scene.add(mesh);
  const srgb=x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);
  for(let j=0;j<14;j++){
   let dir=game.firstTrail.plan.samples[Math.round(Math.floor(j/2)*(game.firstTrail.plan.samples.length-1)/6)].clone();
   if(j%2){const axis=new T.Vector3(0,1,0).cross(dir).normalize();for(const offset of[3.5,5,7]){const next=dir.clone().applyAxisAngle(axis,offset/game.planet.R);if(game.planetPathAt(next)<.1){dir=next;break;}}}
   const up=new T.Vector3(0,1,0).cross(dir).normalize(),right=new T.Vector3().crossVectors(up,dir).normalize(),centre=dir.clone().multiplyScalar(game.planet.R),positions=[];
   for(const[x,y]of[[-.05,-.05],[.05,-.05],[0,.07]])positions.push(...centre.clone().addScaledVector(right,x).addScaledVector(up,y).toArray());geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute([...dir,...dir,...dir],3));geo.setAttribute('color',new T.Float32BufferAttribute(new Array(9).fill(1),3));fieldModule.prepareMeadowUV?.(geo);geo.computeBoundingSphere();camera.up.copy(up);camera.position.copy(centre).add(dir);camera.lookAt(centre);r.setRenderTarget(target);r.render(scene,camera);const pixel=new Float32Array(4);r.readRenderTargetPixels(target,4,4,1,1,pixel);
   const u=Math.atan2(dir.z,dir.x)/(2*Math.PI)+.5,v=Math.asin(dir.y)/Math.PI+.5,x=u*1024-.5,y=(1-v)*512-.5,x0=Math.floor(x),y0=Math.floor(y),tx=x-x0,ty=y-y0,expected=[0,0,0,0];for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const index=(Math.max(0,Math.min(511,y0+dy))*1024+((x0+dx)%1024+1024)%1024)*4,weight=(dx?tx:1-tx)*(dy?ty:1-ty);for(let c=0;c<4;c++)expected[c]+=(c===3?img[index+c]/255:srgb(img[index+c]/255))*weight;}
   rows.push({sample:j,actual:Array.from(pixel),expected,cpuPath:game.planetPathAt(dir),error:Math.max(...expected.map((v,i)=>Math.abs(v-pixel[i])))});
  }
  r.setRenderTarget(old);target.dispose();mat.dispose();geo.dispose();return rows;
 });
 check('actual GPU sphere UV,sRGB decode and path mask match the baked raster',fault==='signature'?samples.length===0:samples.length===14&&samples.some(s=>s.cpuPath<.1)&&samples.some(s=>s.cpuPath>.9)&&samples.every(s=>s.error<.08&&Math.abs(s.actual[3]-s.cpuPath)<.25),samples);
 const sites=JSON.parse(fs.readFileSync(B+'/sites.json'));
 const placement=await page.evaluate(sites=>{
  const root=sites[0],snapshot=()=>game.meadow.placements.map(x=>[x.key,...x.matrix.elements]);fieldProbe.stage(root.dir,root.target);const first=snapshot();let maxCells=game.meadow.cacheStats.cells;
  for(const s of sites.slice(1,6)){fieldProbe.stage(s.dir,s.target);maxCells=Math.max(maxCells,game.meadow.cacheStats.cells);}fieldProbe.stage(root.dir,root.target);const second=snapshot();
  return{stable:JSON.stringify(first)===JSON.stringify(second),maxCells,stats:game.meadow.cacheStats,tufts:game.meadow.count,triangles:game.meadow.group.children.reduce((n,m)=>n+m.count*(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),fourDraws:game.meadow.group.children.length,rootGaps:game.meadow.placements.slice(0,32).map(x=>x.position.length()-game.planet.surfaceAt(x.position.clone().normalize()).length()-game.carpet.liftAt(x.position.clone().normalize()))};
 },sites);
 check('fixed placements return unchanged after cache eviction and roots follow carpet',placement.stable&&placement.rootGaps.every(g=>Math.abs(g+.015)<1e-5),placement);
 check('cell cache remains bounded and geometry budget does not exceed legacy mid',fallback||placement.maxCells<=256&&placement.stats.hits>0&&placement.tufts<=2400&&placement.triangles<=132000&&placement.fourDraws===4,placement);
 const saved=await page.evaluate(()=>{game.save(true);return localStorage.getItem('mumuplanet.progress.v1');});
 if(touch){await page.locator('#gfx').tap();await page.locator('.meadow-setting button').tap();}else await page.keyboard.press('g');
 const off=await page.evaluate(()=>({enabled:game.meadow.enabled,visible:game.meadow.group.visible,stored:localStorage.getItem('mumuplanet.meadow.enabled.v1')}));
 if(touch){await page.locator('.meadow-setting button').tap();await page.locator('#gfxWrap .x').tap();}else await page.keyboard.press('g');
 const levels=await page.evaluate(()=>{const rows=[];for(const name of['low','min','mid','high']){fieldQuality.pin(name);game.step(0);game.engine.render();rows.push({name,visible:game.meadow.group.visible,field:game.meadowField.loaded});}fieldQuality.pin('mid');return rows;});
 const savedAfter=await page.evaluate(()=>localStorage.getItem('mumuplanet.progress.v1'));
 const beforeEnvelope=JSON.parse(saved),afterEnvelope=JSON.parse(savedAfter),changed=Object.keys({...beforeEnvelope,...afterEnvelope}).filter(k=>JSON.stringify(beforeEnvelope[k])!==JSON.stringify(afterEnvelope[k]));
 check('native grass toggle and four quality tiers preserve local game save',!off.enabled&&!off.visible&&off.stored==='false'&&levels.every(l=>l.visible===['mid','high'].includes(l.name))&&changed.every(k=>k==='savedAt')&&afterEnvelope.savedAt>=beforeEnvelope.savedAt,{off,levels,changedEnvelopeKeys:changed,savedBefore:saved,savedAfter});
 await page.screenshot({path:out+'/'+key+'.png'});check('no browser or shader errors',!report.errors.length,report.errors);
 report.pass=report.checks.every(x=>x.pass);
 }catch(e){report.failure=e.stack;report.pass=false;console.error(e);}finally{fs.writeFileSync(out+'/'+key+'.json',JSON.stringify(report,null,2));await browser.close();if(!report.pass)process.exitCode=1;}
})();
