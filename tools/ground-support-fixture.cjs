const fs=require('node:fs'),base=require('./field-meadow-fixture.cjs');
const A='art/arrival-coherence/v01/ground-support';exports.A=A;
exports.prepare=async(page,variant='root',enabled=true)=>{
 const options={transform(file,body){
  if(file==='src/sphere/Planet.js')body=fs.readFileSync(A+'/preview-'+variant+'-src__sphere__Planet.js','utf8');
  if(file==='src/boot.js'&&enabled){const needle='planet.rebuildTerrain();';if(!body.includes(needle))throw Error('Missing terrain finalization');body=body.replace(needle,needle+'\nplanet.enableMeshGround({step:.025});');}
  return body;
 }};
 await page.route('**/src/sphere/PlanetSurfaceIndex.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(A+'/preview-src__sphere__PlanetSurfaceIndex.js','utf8')}));
 if(variant==='terraces')await require('./wayfarer-v02-fixture.cjs').prepare(page,'goal','mid',options);
 else await base.prepare(page,'after','mid',options);
};
