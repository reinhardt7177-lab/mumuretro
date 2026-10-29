const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{A,B}=require('./world-horizon-fixture.cjs');
const file=path.resolve('tools/bake-field-meadow.cjs');let source=fs.readFileSync(file,'utf8');
source=source.replace("require('./field-meadow-fixture.cjs')","require('./world-horizon-fixture.cjs')").replaceAll('meadow-field-v01.png','meadow-field-v02.png');
const marker="await fixture.prepare(page,'before','mid',{transform:(file,body)=>file==='src/sphere/Planet.js'?fs.readFileSync(A+'/preview-src__sphere__Planet.js','utf8'):body});";
if(!source.includes(marker))throw Error('Bake preparation marker changed');source=source.replace(marker,"await fixture.prepare(page,'goal','mid');");
source=source.replace('actual unchanged planet','actual current planet and newly planned physical approach routes').replace('not game geometry','not new game geometry');
const finish="console.log('FIELD_BAKE '+JSON.stringify({width:W,height:H,bytes:fs.statSync(file).size,signature}));";
if(!source.includes(finish))throw Error('Bake output marker changed');source=source.replace(finish,`const metadata=JSON.parse(fs.readFileSync(A+'/exports/meadow-kit-v02.json'));metadata.routeSignature=signature;metadata.surface.approachClearings='world-horizon-v01';fs.writeFileSync(A+'/exports/meadow-kit-v02.json',JSON.stringify(metadata,null,2));`+finish);
fs.writeFileSync(B+'/bake-executed.cjs',source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
