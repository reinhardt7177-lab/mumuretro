const fs=require('node:fs'),assert=require('node:assert/strict'),A='art/wayfarer-terraces/v02',B='reports/2026-10-27/evidence/wayfarer-terraces-v02',spec=JSON.parse(fs.readFileSync(A+'/design-spec.json'));
function swap(s,a,b){assert(s.includes(a),'Missing marker '+a);return s.replace(a,b);}
function preview(file,fn){const source=fs.readFileSync(B+'/before-'+file.replaceAll('/','__'),'utf8');fs.writeFileSync(A+'/preview-'+file.replaceAll('/','__'),fn(source));}
preview('src/sphere/Planet.js',s=>{
 s=swap(s,"import { createLandscape } from '../world/Landscape.js';","import { createLandscape } from '../world/Landscape.js';\nimport { createTerracedRelief } from '../world/TerracedRelief.js';");
 s=swap(s,'if(this.landscape)height+=this.landscape.delta(dir);','if(this.landscape)height+=this.landscape.delta(dir);\n    if(this.terraces)height+=this.terraces.delta(dir,height);');
 s=swap(s,'  levelSite(id,direction,inner,outer,rebuild=true){','  applyTerraces(spec,protectedSites,trailSamples){\n    this.terraces=createTerracedRelief(this,spec,protectedSites,trailSamples);return this.terraces;\n  }\n\n  colorAt(dir,height,slope,out){terrainColor(height,slope,out);return this.terraces?this.terraces.colorAt(dir,height,slope,out):out;}\n\n  levelSite(id,direction,inner,outer,rebuild=true){');
 s=swap(s,'const geo = this.levelSites.length?refineLevelSites(base,this.levelSites,R):base;','const refineSites=[...this.levelSites,...(this.terraces?.refinementSites||[])];\n    const geo = refineSites.length?refineLevelSites(base,refineSites,R,this.terraces?.contract.refinementRounds||2,this.terraces?d=>this.heightAt(d):null):base;');
 s=swap(s,'      terrainColor(hAvg, slope, col);','      this.colorAt(up,hAvg,slope,col);');
 s=swap(s,'function refineLevelSites(source,sites,radius){','function refineLevelSites(source,sites,radius,rounds=2,heightAt=null){');
 s=swap(s,'for(let round=0;round<2;round++){','for(let round=0;round<rounds;round++){');
 s=swap(s,'if(!sites.some((s,j)=>mid.dot(s.dir)>cosines[j]))continue;','if(!sites.some((s,j)=>round<(s.rounds||2)&&mid.dot(s.dir)>cosines[j]))continue;');
 return swap(s,'const k=edgeKey(x,y);if(!edges.has(k))edges.set(k,mid.clone().multiplyScalar(radius));','if(round>=3&&heightAt){const hx=heightAt(x.clone().normalize()),hy=heightAt(y.clone().normalize());if(Math.abs(heightAt(mid)-(hx+hy)*.5)<.012)continue;}const k=edgeKey(x,y);if(!edges.has(k))edges.set(k,mid.clone().multiplyScalar(radius));');
});
preview('src/boot.js',s=>{
 const setup='const terraceSpec='+JSON.stringify(spec.terrain)+';\n'+"const terraces=planet.applyTerraces(terraceSpec,[{dir:landingDir,radius:terraceSpec.preserveLanding},{dir:trailPlan.overlook,radius:terraceSpec.preserveOverlook},...forageSpots.map(s=>({dir:s.dir,radius:terraceSpec.preserveForage})),...legendSpots.map(s=>({dir:s.dir,radius:terraceSpec.preserveLegend})),...shrineSpots.map(s=>({dir:s.dir,radius:terraceSpec.preservePortal}))],trailPlan.samples);\n";
 s=swap(s,"const arrivalSite=planet.levelSite('arrival-dais'",setup+"const arrivalSite=planet.levelSite('arrival-dais'");
 return swap(s,'worldArtSpec, landscape, exteriorSites','worldArtSpec, landscape, terraces, exteriorSites');
});
preview('src/world/WorldArt.js',s=>s.replaceAll('field-boulders-v01.glb','field-boulders-v02.glb'));
preview('src/world/MeadowField.js',s=>swap(s,'const data={arrivalSupport:','const data={terrainContract:planet.terraces?.contract||null,arrivalSupport:'));
console.log('Created 466-based source previews. Arrival floor support and soil separation preserved; no root edits.');
