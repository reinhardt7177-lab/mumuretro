const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const fixture=require('./field-meadow-fixture.cjs'),{A,B}=fixture;
const spec=JSON.parse(fs.readFileSync(A+'/design-spec.json')),W=spec.surface.width,H=spec.surface.height;
function png(rgba){
 const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const chunk=(name,data)=>{
  const type=Buffer.from(name),body=Buffer.concat([type,data]),length=Buffer.alloc(4),checksum=Buffer.alloc(4);
  length.writeUInt32BE(data.length);let crc=0xffffffff;for(const byte of body)crc=table[(crc^byte)&255]^(crc>>>8);
  checksum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([length,body,checksum]);
 };
 const header=Buffer.alloc(13);header.writeUInt32BE(W,0);header.writeUInt32BE(H,4);header[8]=8;header[9]=6;
 const lines=Buffer.alloc(H*(W*4+1));for(let y=0;y<H;y++)rgba.copy(lines,y*(W*4+1)+1,y*W*4,(y+1)*W*4);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('sRGB',Buffer.from([0])),chunk('IDAT',zlib.deflateSync(lines)),chunk('IEND',Buffer.alloc(0))]);
}
(async()=>{
 const file=A+'/exports/meadow-field-v01.png';if(fs.existsSync(file))throw Error('Preserve existing field bake');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  // Proposed colour only; baseline physics and route construction stay intact.
  await fixture.prepare(page,'before','mid',{transform:(file,body)=>file==='src/sphere/Planet.js'?fs.readFileSync(A+'/preview-src__sphere__Planet.js','utf8'):body});
  await page.evaluate(async()=>{window.bakeField={T:await import('three'),lighting:await import('/src/data/lighting.js'),sphere:await import('/src/sphere/Planet.js'),noise:await import('/src/util/noise.js')};});
  const rgba=Buffer.alloc(W*H*4);let pathTexels=0,grassTexels=0;
  for(let row=0;row<H;row+=16){
   const result=await page.evaluate(({W,H,row})=>{
    const{T,lighting,sphere,noise}=bakeField,dir=new T.Vector3(),colour=new T.Color(),grassColour=new T.Color(),soil=new T.Color(lighting.PATH.soil),pal=lighting.MEADOW.map(c=>new T.Color(c)),bytes=[];
    let paths=0,grass=0;
    for(let y=row;y<Math.min(H,row+16);y++)for(let x=0;x<W;x++){
     const lat=Math.PI/2-(y+.5)/H*Math.PI,lon=(x+.5)/W*Math.PI*2-Math.PI;
     dir.set(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
     const h=game.planet.heightAt(dir),slope=game.planet.slopeDegAt(dir),path=game.planetPathAt(dir),g=game.scatter.grassAt(dir);
     sphere.terrainColor(h,slope,colour);
     const t=T.MathUtils.clamp(noise.fbm(dir.x*6,dir.y*6,dir.z*6,2)*.5+.5,0,1),band=t*(pal.length-1),k=Math.min(pal.length-2,Math.floor(band));
     grassColour.copy(pal[k]).lerp(pal[k+1],band-k).multiplyScalar(1+noise.fbm(dir.x*24,dir.y*24,dir.z*24,2)*.025);
     // Colour cover is continuous. Actual grass exclusions remain unchanged.
     const cover=(1-T.MathUtils.smoothstep(slope,18,34))*(1-T.MathUtils.smoothstep(h,6.5,8));
     colour.lerp(grassColour,cover).lerp(soil,path).convertLinearToSRGB();
     bytes.push(Math.round(T.MathUtils.clamp(colour.r,0,1)*255),Math.round(T.MathUtils.clamp(colour.g,0,1)*255),Math.round(T.MathUtils.clamp(colour.b,0,1)*255),Math.round(path*255));
     paths+=path>.25;grass+=g>.01;
    }
    return{bytes,paths,grass};
   },{W,H,row});
   Buffer.from(result.bytes).copy(rgba,row*W*4);pathTexels+=result.paths;grassTexels+=result.grass;
   if(row%64===0)console.log('BAKED rows '+row+'/'+H);
  }
  const signatureData=await page.evaluate(()=>{
   const round=x=>Math.round(x*1e6),coords=d=>d.toArray().map(round),samples=[];
   for(let i=0;i<64;i++){const y=1-2*(i+.5)/64,angle=i*2.399963229728653,dir=new bakeField.T.Vector3(Math.sqrt(1-y*y)*Math.cos(angle),y,Math.sqrt(1-y*y)*Math.sin(angle));samples.push(round(game.planet.heightAt(dir)));}
   return{radius:game.planet.R,first:game.firstTrail.plan.samples.map(coords),routes:game.worldTrails.routes.map(r=>({id:r.id,dirs:r.dirs.map(coords)})),heightSamples:samples,colourSource:bakeField.sphere.terrainColor.toString().replace(/\r\n/g,'\n'),palette:{meadow:bakeField.lighting.MEADOW,soil:bakeField.lighting.PATH.soil,ground:bakeField.lighting.GROUND}};
  });
  let hash=2166136261;const signatureText=JSON.stringify(signatureData);for(let i=0;i<signatureText.length;i++)hash=Math.imul(hash^signatureText.charCodeAt(i),16777619);const signature=(hash>>>0).toString(16);
  fs.mkdirSync(A+'/exports',{recursive:true});if(fs.existsSync(file))throw Error('Field bake appeared during calculation');fs.writeFileSync(file,png(rgba));
  fs.writeFileSync(B+'/surface-bake.json',JSON.stringify({pass:true,width:W,height:H,pathTexels,grassTexels,bytes:fs.statSync(file).size,logicalRGBABytes:rgba.length,routeSignature:signature,signatureData,colourRecipe:'Continuous slope/height cover over shared terrainColor; colour only, unchanged grass exclusion and physics.',scope:'Offline colour/path raster from the actual unchanged planet; not game geometry, GPU memory measurement or original-game asset.'},null,2));
  console.log('FIELD_BAKE '+JSON.stringify({width:W,height:H,bytes:fs.statSync(file).size,signature}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

