const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {A,B}=require('./arrival-coherence-fixture.cjs'),file=path.resolve('tools/bake-field-meadow.cjs');
let source=fs.readFileSync(file,'utf8');
function swap(from,to){if(!source.includes(from))throw Error('Bake marker changed: '+from);source=source.replace(from,to);}
swap("require('./field-meadow-fixture.cjs')","require('./arrival-coherence-fixture.cjs')");
swap("const spec=JSON.parse(fs.readFileSync(A+'/design-spec.json')),W=spec.surface.width,H=spec.surface.height;","const W=1024,H=512;");
source=source.replaceAll('meadow-field-v01.png','arrival-coherent-field-v01.png');
swap("await fixture.prepare(page,'before','mid',{transform:(file,body)=>file==='src/sphere/Planet.js'?fs.readFileSync(A+'/preview-src__sphere__Planet.js','utf8'):body});","await fixture.prepare(page,'goal','mid');");
swap("noise:await import('/src/util/noise.js')","noise:await import('/src/util/noise.js'),layers:await import('/src/world/MeadowLayers.js'),field:await import('/src/world/MeadowField.js')");
swap('sphere.terrainColor(h,slope,colour);','game.planet.colorAt(dir,h,slope,colour);');
swap('const cover=(1-T.MathUtils.smoothstep(slope,18,34))*(1-T.MathUtils.smoothstep(h,6.5,8));','const cover=bakeField.layers.fieldCoverAt(dir,game.planet.R,h,slope);');
const from=source.indexOf('  const signatureData=await page.evaluate('),to=source.indexOf('  fs.mkdirSync(A+',from);
if(from<0||to<0)throw Error('Signature block missing');
source=source.slice(0,from)+`  const signature=await page.evaluate(()=>bakeField.field.surfaceSignature(game.planet,game.firstTrail.plan,game.worldTrails));\n  const signatureData={method:'actual exported surfaceSignature',sharedPatch:true,sharedPlanetColour:true};\n`+source.slice(to);
swap("console.log('FIELD_BAKE '+JSON.stringify({width:W,height:H,bytes:fs.statSync(file).size,signature}));",`const metadata=JSON.parse(fs.readFileSync(A+'/exports/arrival-groundcover-v01.json'));metadata.routeSignature=signature;metadata.surface.colourCover='shared layered patch field, actual planet.colorAt and routes';fs.writeFileSync(A+'/exports/arrival-groundcover-v01.json',JSON.stringify(metadata,null,2));const manifest=JSON.parse(fs.readFileSync(A+'/manifest.json'));manifest.assets.push({file:'assets/models/adventure/arrival-coherent-field-v01.png',preview:file});fs.writeFileSync(A+'/manifest.json',JSON.stringify(manifest,null,2));console.log('FIELD_BAKE '+JSON.stringify({width:W,height:H,bytes:fs.statSync(file).size,signature}));`);
source=source.replace('Continuous slope/height cover over shared terrainColor; colour only, unchanged grass exclusion and physics.','Layered deterministic patch cover over actual planet.colorAt. Plant placement uses the same patch field; authored routes remain unchanged.').replace('actual unchanged planet','combined preview planet');
fs.writeFileSync(B+'/bake-executed.cjs',source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
