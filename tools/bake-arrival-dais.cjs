const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {A,B}=require('./arrival-dais-fixture.cjs'),file=path.resolve('tools/bake-field-meadow.cjs');
let source=fs.readFileSync(file,'utf8');
function replace(from,to){if(!source.includes(from))throw Error('Bake marker changed: '+from);source=source.replace(from,to);}
replace("require('./field-meadow-fixture.cjs')","require('./arrival-dais-fixture.cjs')");
source=source.replaceAll('meadow-field-v01.png','arrival-field-v01.png');
replace("const spec=JSON.parse(fs.readFileSync(A+'/design-spec.json')),W=spec.surface.width,H=spec.surface.height;","const W=1024,H=512;");
replace("await fixture.prepare(page,'before','mid',{transform:(file,body)=>file==='src/sphere/Planet.js'?fs.readFileSync(A+'/preview-src__sphere__Planet.js','utf8'):body});","await fixture.prepare(page,'goal','mid');");
replace('return{radius:game.planet.R,first:',"return{arrivalSupport:game.planet.arrivalSupport?{height:game.planet.arrivalSupport.height,inner:game.planet.arrivalSupport.inner,outer:game.planet.arrivalSupport.outer}:null,levelSites:game.planet.levelSites.map(s=>({id:s.id,dir:coords(s.dir),height:round(s.height),inner:s.inner,outer:s.outer})),radius:game.planet.R,first:");
const marker="console.log('FIELD_BAKE '+JSON.stringify({width:W,height:H,bytes:fs.statSync(file).size,signature}));";
replace(marker,"const metadata=JSON.parse(fs.readFileSync(A+'/exports/arrival-meadow-v01.json'));metadata.routeSignature=signature;metadata.surface.arrivalSite='physical plane3.2m,blend5.2m';fs.writeFileSync(A+'/exports/arrival-meadow-v01.json',JSON.stringify(metadata,null,2));"+marker);
source=source.replace('actual unchanged planet','actual planet with levelled arrival patch and newly derived physical routes').replace('unchanged grass exclusion','landing carpet clearing and all other grass exclusions unchanged');
fs.writeFileSync(B+'/bake-executed.cjs',source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
