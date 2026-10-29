const fs=require('node:fs'),base=require('./field-meadow-fixture.cjs');
const A='art/arrival-coherence/v01/rock-faces',snapshot=JSON.parse(fs.readFileSync(A+'/baseline/manifest.json'));exports.A=A;
exports.prepare=async(page,phase='after',level='high')=>{
 if(!['before','after'].includes(phase)||!['high','low'].includes(level))throw Error('rock faces phase/level');
 for(const row of snapshot.files)await page.route('**/'+row.file,r=>{
  let source=row.preview;
  if(phase==='after'&&['src/sphere/Planet.js','src/world/TerracedRelief.js'].includes(row.file))source=A+'/preview-'+row.file.replaceAll('/','__');
  if(row.file==='src/world/MeadowField.js')source=A+'/fallback-src__world__MeadowField.js';
  let body=fs.readFileSync(source,'utf8');
  if(level==='low'&&row.file==='src/boot.js'){if(!body.includes('"refinementRounds":4'))throw Error('Expected high resolution spec');body=body.replace('"refinementRounds":4','"refinementRounds":3');}
  if(row.file==='src/sphere/Planet.js'){
   // Observation only: hash the untouched sphere/refinement topology BEFORE
   // heights are applied; both cases use exactly the same instrumentation.
   const marker='    const pos = geo.attributes.position;';
   body=body.replace(marker,marker+`\n    {const bytes=new Uint8Array(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength);let hash=2166136261;for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619);geo.userData.radialTopologyHash=(hash>>>0).toString(16);}`);
   if(phase==='before'){
    body=body.replace('  _build() {','  _build() {\n    const buildStarted=performance.now();').replace('    return mesh;\n  }\n\n  // 봉우리','    geo.userData.surfaceBuildMs=performance.now()-buildStarted;\n    return mesh;\n  }\n\n  // 봉우리');
    body=body.replace('function softenTerrainSurface(geo) {','function softenTerrainSurface(geo) {\n  const normalStarted=performance.now();').replace('// Refine only authored',`// Refine only authored`);
    const start=body.indexOf('function softenTerrainSurface(geo)'),end=body.indexOf('// Refine only authored',start),block=body.slice(start,end),last=block.lastIndexOf('}');
    body=body.slice(0,start)+block.slice(0,last)+'  geo.userData.rockFaceNormals={creaseDegrees:null,normalBuildMs:performance.now()-normalStarted};\n'+block.slice(last)+body.slice(end);
   }
  }
  return r.fulfill({contentType:'text/javascript',body});
 });
 for(const row of snapshot.assets)await page.route('**/'+row.file,r=>r.fulfill({contentType:row.file.endsWith('.glb')?'model/gltf-binary':row.file.endsWith('.png')?'image/png':'application/json',body:fs.readFileSync(row.preview)}));
 await base.prepare(page,'after','mid');
};
