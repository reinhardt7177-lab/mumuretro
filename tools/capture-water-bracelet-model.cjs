const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const OUT=path.join(__dirname,'../reports/2026-10-03/evidence/water-bracelet');
(async()=>{fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:920}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5512/art/water-bracelet-web/preview.html');await p.waitForFunction(()=>window.braceletPreview);
 await p.waitForTimeout(400);await p.locator('#stage').screenshot({path:path.join(OUT,'05-cuff-model.png')});
 await p.locator('#warm').click();await p.waitForTimeout(100);await p.locator('#stage').screenshot({path:path.join(OUT,'06-cuff-warm.png')});
 const data=await p.evaluate(()=>{const root=braceletPreview.cuff;root.rotation.set(0,0,0);root.updateMatrixWorld(true);let triangles=0,meshes=0;const parts=[];
  root.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;parts.push({name:m.name,position:Array.from(m.geometry.attributes.position.array),normal:Array.from(m.geometry.attributes.normal.array),uv:Array.from(m.geometry.attributes.uv?.array||[]),index:m.geometry.index?Array.from(m.geometry.index.array):null,matrix:m.matrixWorld.toArray(),color:m.material.color.toArray(),metalness:m.material.metalness,roughness:m.material.roughness,emissive:m.material.emissive.toArray(),clearcoat:m.material.clearcoat||0,map:m.material.map?.image?.toDataURL?.()||null});});return {meshes,triangles,parts};});
 fs.writeFileSync(path.join(__dirname,'../art/water-bracelet-web/model-source.json'),JSON.stringify(data));
 const metrics={meshes:data.meshes,triangles:data.triangles,previewErrors:errors};fs.writeFileSync(path.join(OUT,'model-metrics.json'),JSON.stringify(metrics,null,2));if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(metrics));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
