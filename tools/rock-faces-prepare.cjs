const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),A='art/arrival-coherence/v01/rock-faces',BASE=A+'/baseline';process.chdir(ROOT);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');fs.mkdirSync(A,{recursive:true});
if(!fs.existsSync(BASE+'/manifest.json')){
 fs.mkdirSync(BASE,{recursive:true});const upstream='art/arrival-coherence/v01/combined/manifest.json',original=JSON.parse(fs.readFileSync(upstream)),snapshot={upstream,upstreamManifestSha256:sha(fs.readFileSync(upstream)),capturedAt:new Date().toISOString(),files:[],assets:[],baseInventory:original.baseInventory};
 for(const type of['files','assets'])for(const row of original[type]){const preview=BASE+'/'+row.file.replaceAll('/','__'),bytes=fs.readFileSync(row.preview);fs.writeFileSync(preview,bytes);snapshot[type].push({...row,originalPreview:row.preview,preview,sha256:sha(bytes)});}
 fs.writeFileSync(BASE+'/manifest.json',JSON.stringify(snapshot,null,2));
}
const snap=JSON.parse(fs.readFileSync(BASE+'/manifest.json')),source=file=>fs.readFileSync(snap.files.find(r=>r.file===file).preview,'utf8');
let terr=source('src/world/TerracedRelief.js');const ds=terr.indexOf('  function delta('),de=terr.indexOf('  function colorAt(',ds);if(ds<0||de<0)throw Error('Terrain profile block changed');
const oldDelta=terr.slice(ds,de),linear=oldDelta.replace('smooth(fraction,spec.faceStart,spec.faceEnd)','THREE.MathUtils.clamp((fraction-spec.faceStart)/(spec.faceEnd-spec.faceStart),0,1)')
 .replace('const offset=.11*Math.sin(d.x*34+d.z*53)+.065*Math.sin(d.y*61-d.z*29);','// Quantize signed distance along a local geological plane normal.\n    // Constant radial heights and the previous sine offset made bent caps.\n    const denominator=d.dot(centre)+.07*d.dot(east)-.035*d.dot(north);\n    const planeHeight=(radius+height)*denominator-radius,offset=.13;')
 .replace('const level=height/spec.stepHeight+offset','const level=planeHeight/spec.stepHeight+offset')
 .replace('const stepped=(whole+THREE.MathUtils.clamp((fraction-spec.faceStart)/(spec.faceEnd-spec.faceStart),0,1)-offset)*spec.stepHeight;','const stepped=(radius+(whole+THREE.MathUtils.clamp((fraction-spec.faceStart)/(spec.faceEnd-spec.faceStart),0,1)-offset)*spec.stepHeight)/denominator-radius;');
if(oldDelta===linear)throw Error('Expected cubic face profile');
terr=terr.slice(0,ds)+oldDelta.replace('function delta(','function refinementDelta(')+linear+terr.slice(de);
terr=terr.replace('shapeRevision:4,','shapeRevision:6,profile:"local-plane-clamped-linear",planeNormal:{east:.07,north:-.035},phaseOffset:.13,creaseDegrees:25,refinementProfile:"preserved-cubic-reference",').replace('},delta,influence,colorAt,refinementSites};','},delta,refinementDelta,influence,colorAt,refinementSites};');
terr=terr.replace('function colorAt(d,height,slope,out){\n    const weight=influence(d);','function colorAt(d,height,slope,out,weight=influence(d)){');
fs.writeFileSync(A+'/preview-src__world__TerracedRelief.js',terr);
let planet=source('src/sphere/Planet.js');
planet=planet.replace('  heightAt(dir) {','  heightAt(dir,referenceProfile=false) {').replace('if(this.terraces)height+=this.terraces.delta(dir,height);','if(this.terraces)height+=(referenceProfile?this.terraces.refinementDelta:this.terraces.delta)(dir,height);').replace('this.terraces?d=>this.heightAt(d):null','this.terraces?d=>this.heightAt(d,true):null');
planet=planet.replace('colorAt(dir,height,slope,out){terrainColor(height,slope,out);return this.terraces?this.terraces.colorAt(dir,height,slope,out):out;}','colorAt(dir,height,slope,out,exposure){terrainColor(height,slope,out);return this.terraces?this.terraces.colorAt(dir,height,slope,out,exposure):out;}');
planet=planet.replace('  _build() {','  _build() {\n    const buildStarted=performance.now();');
planet=planet.replace('    // 2) 면마다 색 — 고도와 경사 두 축으로 고른다','    const rockFaceFlags=new Uint8Array(n/3);\n    // 2) 면마다 색 — 고도와 경사 두 축으로 고른다');
planet=planet.replace('this.colorAt(up,hAvg,slope,col);','const exposure=this.terraces?this.terraces.influence(up):0;\n      this.colorAt(up,hAvg,slope,col,exposure);\n      if(slope>18&&exposure>.12)rockFaceFlags[f/3]=1;');
planet=planet.replace("    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));",`    // Constant per triangle, so the carpet clone can discard exposed-rock
    // fragments without moving any soil/collision vertices or changing UVs.
    const exposedRock=new Uint8Array(n);
    for(let f=0;f<rockFaceFlags.length;f++){const i=f*3;exposedRock[i]=exposedRock[i+1]=exposedRock[i+2]=rockFaceFlags[f];}
    geo.setAttribute('aExposedRock',new THREE.Uint8BufferAttribute(exposedRock,1,false));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));`);
planet=planet.replace('    softenTerrainSurface(geo);','    softenTerrainSurface(geo,rockFaceFlags,25);\n    geo.userData.rockFaceNormals.exposedAttributeBytes=exposedRock.byteLength;');
planet=planet.replace('    return mesh;\n  }\n\n  // 봉우리','    geo.userData.surfaceBuildMs=performance.now()-buildStarted;\n    return mesh;\n  }\n\n  // 봉우리');
const ns=planet.indexOf('function softenTerrainSurface('),ne=planet.indexOf('// Refine only authored',ns);if(ns<0||ne<0)throw Error('Normal smoother block changed');
const smoother=`// Shared positions stay shared. Only exposed limestone contacts reject normals
// across a 25 degree crease; grassy terrain keeps the original full smoothing.
function softenTerrainSurface(geo,rockFaces,creaseDegrees=25) {
  const started=performance.now(),p=geo.attributes.position,n=geo.attributes.normal,c=geo.attributes.color,groups=new Map();
  for(let i=0;i<p.count;i++){
    const key=\`\${Math.round(p.getX(i)*10000)},\${Math.round(p.getY(i)*10000)},\${Math.round(p.getZ(i)*10000)}\`;
    let group=groups.get(key);if(!group){group=[];groups.set(key,group);}group.push(i);
  }
  const cosine=Math.cos(creaseDegrees*Math.PI/180);let scratch=new Float64Array(192),sharpGroups=0,sharpCorners=0,rejected=0,maxMembers=0;
  for(const group of groups.values()){
    maxMembers=Math.max(maxMembers,group.length);const sharp=group.some(i=>rockFaces[Math.floor(i/3)]!==0);
    if(!sharp){let nx=0,ny=0,nz=0,r=0,g=0,b=0;for(const i of group){nx+=n.getX(i);ny+=n.getY(i);nz+=n.getZ(i);r+=c.getX(i);g+=c.getY(i);b+=c.getZ(i);}const len=Math.hypot(nx,ny,nz)||1;for(const i of group){n.setXYZ(i,nx/len,ny/len,nz/len);c.setXYZ(i,r/group.length,g/group.length,b/group.length);}continue;}
    sharpGroups++;sharpCorners+=group.length;if(scratch.length<group.length*6)scratch=new Float64Array(group.length*6);
    // Finish the entire group before overwriting its original face normals.
    for(let k=0;k<group.length;k++){
      const i=group[k],x=n.getX(i),y=n.getY(i),z=n.getZ(i);let nx=0,ny=0,nz=0,r=0,g=0,b=0,count=0;
      for(const j of group){if(x*n.getX(j)+y*n.getY(j)+z*n.getZ(j)<cosine){rejected++;continue;}nx+=n.getX(j);ny+=n.getY(j);nz+=n.getZ(j);r+=c.getX(j);g+=c.getY(j);b+=c.getZ(j);count++;}
      const len=Math.hypot(nx,ny,nz)||1,o=k*6;scratch[o]=nx/len;scratch[o+1]=ny/len;scratch[o+2]=nz/len;scratch[o+3]=r/count;scratch[o+4]=g/count;scratch[o+5]=b/count;
    }
    for(let k=0;k<group.length;k++){const i=group[k],o=k*6;n.setXYZ(i,scratch[o],scratch[o+1],scratch[o+2]);c.setXYZ(i,scratch[o+3],scratch[o+4],scratch[o+5]);}
  }
  geo.userData.rockFaceNormals={creaseDegrees,sharpGroups,sharpCorners,rejectedNormalPairs:rejected,rockFaces:rockFaces.reduce((a,b)=>a+b,0),maxSharedCorners:maxMembers,normalBuildMs:performance.now()-started};
}

`;
planet=planet.slice(0,ns)+smoother+planet.slice(ne);fs.writeFileSync(A+'/preview-src__sphere__Planet.js',planet);
// Keep both comparisons explicitly on the same vertex-colour fallback.
let meadow=source('src/world/MeadowField.js');const before='record={loaded:!!meadowAssets.texture&&matched,';if(!meadow.includes(before))throw Error('Field load record changed');meadow=meadow.replace(before,'record={loaded:false,comparisonFallback:true,');fs.writeFileSync(A+'/fallback-src__world__MeadowField.js',meadow);
const manifest={previewOnly:true,baseline:BASE+'/manifest.json',changes:['src/sphere/Planet.js','src/world/TerracedRelief.js'],comparisonOnly:'src/world/MeadowField.js forced same fallback on baseline and candidate',topology:'Original cubic profile drives adaptive refinement; only heights/normals/colours change',variants:[{id:'high',rounds:4,expectedTriangles:243688,note:'Actual frozen combined snapshot after v05 support; earlier pre-v05 source had243600'},{id:'low',rounds:3,expectedTriangles:179440}],files:['preview-src__sphere__Planet.js','preview-src__world__TerracedRelief.js','fallback-src__world__MeadowField.js'].map(f=>({preview:A+'/'+f,sha256:sha(fs.readFileSync(A+'/'+f))}))};fs.writeFileSync(A+'/manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({snapshotFiles:snap.files.length,snapshotAssets:snap.assets.length,output:A}));
