const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const A='art/arrival-coherence/v01/combined',B='reports/2026-10-27/evidence/arrival-coherence';
const terrace='art/wayfarer-terraces/v02',cover='art/arrival-coherence/v01/groundcover',light='art/arrival-coherence/v01/lighting',ground='art/arrival-coherence/v01/ground-support';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(A+'/exports',{recursive:true});fs.mkdirSync(B,{recursive:true});
if(fs.existsSync(A+'/manifest.json'))throw Error('Preserve existing combined preview');
const rows=new Map(),add=(file,source)=>rows.set(file,fs.readFileSync(source,'utf8').replace(/\r\n/g,'\n'));
for(const file of ['src/boot.js','src/sphere/Planet.js','src/world/MeadowField.js','src/world/TerracedRelief.js','src/world/WorldArt.js'])add(file,terrace+'/preview-'+file.replaceAll('/','__'));
add('src/sphere/Planet.js',ground+'/preview-terraces-src__sphere__Planet.js');
add('src/sphere/PlanetSurfaceIndex.js',ground+'/preview-src__sphere__PlanetSurfaceIndex.js');
for(const {file}of JSON.parse(fs.readFileSync(light+'/preview-files.json')).files)add(file,light+'/preview-'+file.replaceAll('/','__'));
const {files,transform}=require('./arrival-groundcover-transforms.cjs');
for(const file of files)rows.set(file,transform(file,rows.get(file)||fs.readFileSync(file,'utf8')));
add('src/world/MeadowLayers.js',cover+'/preview-src__world__MeadowLayers.js');
add('src/ui/MapPage.js','src/ui/MapPage.js');
function edit(file,from,to){assert(rows.get(file).includes(from),'Missing merge marker '+file+': '+from);rows.set(file,rows.get(file).replace(from,to));}
edit('src/ui/MapPage.js','terrainColor(h, slope, _c);','planet.colorAt(_d, h, slope, _c);');
edit('src/ui/MapPage.js',"import { terrainColor } from '../sphere/Planet.js';\n",'');
edit('src/boot.js','planet.paintTrail(planetPathAt);','planet.paintTrail(planetPathAt);\n// Authoring/site selection stays analytic; movement follows the rendered soil triangles.\nplanet.enableMeshGround({step:.025});');
edit('src/world/MeadowField.js','colourSource:terrainColor.toString()',"colourSource:terrainColor.toString()+'\\n'+planet.colorAt.toString()");
edit('src/world/MeadowField.js',"import {MEADOW_LAYERS} from './MeadowLayers.js';","import {MEADOW_LAYERS,fieldCoverAt} from './MeadowLayers.js';");
edit('src/world/MeadowField.js','plantLayers:MEADOW_LAYERS,','plantLayers:MEADOW_LAYERS,fieldCoverSource:fieldCoverAt.toString(),');
edit('src/world/MeadowField.js','arrival-field-v01.png','arrival-coherent-field-v01.png');
edit('src/world/MeadowLayers.js',"import {fbm} from '../util/noise.js';","import {fbm} from '../util/noise.js';\nimport {MathUtils} from 'three';");
rows.set('src/world/MeadowLayers.js',rows.get('src/world/MeadowLayers.js')+`\n// Colour and actual plant clumps share one deterministic patch field.\nexport function fieldCoverAt(direction,radius,height,slope){\n const patch=plantPatchAt(direction,radius),s= MathUtils.smoothstep(patch,MEADOW_LAYERS.fieldCoverLow,MEADOW_LAYERS.fieldCoverHigh);\n return (1-MathUtils.smoothstep(slope,18,34))*(1-MathUtils.smoothstep(height,6.5,8))*(MEADOW_LAYERS.fieldCoverMinimum+(1-MEADOW_LAYERS.fieldCoverMinimum)*s);\n}\n`);
const assets=[['arrival-groundcover-v01.glb',cover+'/exports/arrival-groundcover-v01.glb'],['arrival-groundcover-v01.json',cover+'/exports/arrival-groundcover-v01.json'],['field-boulders-v02.glb',terrace+'/exports/field-boulders-v02.glb']];
for(const [name,source]of assets)fs.copyFileSync(source,A+'/exports/'+name);
const inventory=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())walk(f);else inventory.push({file:f,sha256:sha(fs.readFileSync(f))});}}
for(const dir of ['src','assets','vendor'])walk(dir);for(const f of ['index.html','fire-trial.html','vercel.json'])if(fs.existsSync(f))inventory.push({file:f,sha256:sha(fs.readFileSync(f))});
const manifest={status:'preview, not installed',baseInventory:inventory,files:[],assets:assets.map(([name])=>({file:'assets/models/adventure/'+name,preview:A+'/exports/'+name})),pending:['lighting final low/min/title candidate','fresh actual field bake','terrain detail visual and cost selection','dais v04 decision','integrated native input/save/regression']};
for(const [file,body]of rows){const preview=A+'/preview-'+file.replaceAll('/','__');fs.writeFileSync(preview,body);manifest.files.push({file,preview,beforeSha256:fs.existsSync(file)?sha(fs.readFileSync(file)):null,previewSha256:sha(body)});}
fs.writeFileSync(A+'/manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({files:rows.size,assets:assets.length,preservedInventory:inventory.length,status:manifest.status}));
