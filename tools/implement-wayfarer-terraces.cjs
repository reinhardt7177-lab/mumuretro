const fs=require('node:fs'),assert=require('node:assert/strict');
const A='art/wayfarer-terraces/v01',B='reports/2026-10-26/evidence/wayfarer-terraces';
const spec=JSON.parse(fs.readFileSync(A+'/design-spec.json'));
function changed(file,mutate){const out=A+'/preview-'+file.replaceAll('/','__');assert(!fs.existsSync(out),'Preserve preview '+out);const source=fs.readFileSync(B+'/before-'+file.replaceAll('/','__'),'utf8'),body=mutate(source);assert.notEqual(body,source,file);fs.writeFileSync(out,body);}
function swap(body,from,to){assert(body.includes(from),'Missing source marker: '+from);return body.replace(from,to);}
changed('src/sphere/Planet.js',s=>{
 s=swap(s,"import { createLandscape } from '../world/Landscape.js';","import { createLandscape } from '../world/Landscape.js';\nimport { createTerracedRelief } from '../world/TerracedRelief.js';");
 s=swap(s,'if(this.landscape)height+=this.landscape.delta(dir);','if(this.landscape)height+=this.landscape.delta(dir);\n    if(this.terraces)height+=this.terraces.delta(dir,height);');
 s=swap(s,'  levelSite(id,direction,inner,outer,rebuild=true){','  applyTerraces(spec,protectedSites,trailSamples){\n    this.terraces=createTerracedRelief(this,spec,protectedSites,trailSamples);return this.terraces;\n  }\n\n  levelSite(id,direction,inner,outer,rebuild=true){');
 return swap(s,'const geo = this.levelSites.length?refineLevelSites(base,this.levelSites,R):base;','const refineSites=[...this.levelSites,...(this.terraces?.refinementSites||[])];\n    const geo = refineSites.length?refineLevelSites(base,refineSites,R):base;');
});
changed('src/boot.js',s=>{
 const marker="const overlookSite=planet.levelSite('wind-overlook'";
 assert(s.includes(marker));
 const setup='const terraceSpec='+JSON.stringify(spec.terrain)+';\n'+
 "const terraces=planet.applyTerraces(terraceSpec,[{dir:landingDir,radius:terraceSpec.preserveLanding},{dir:trailPlan.overlook,radius:terraceSpec.preserveOverlook},...forageSpots.map(s=>({dir:s.dir,radius:terraceSpec.preserveForage})),...legendSpots.map(s=>({dir:s.dir,radius:terraceSpec.preserveLegend})),...shrineSpots.map(s=>({dir:s.dir,radius:terraceSpec.preservePortal}))],trailPlan.samples);\n";
 s=s.replace(marker,setup+marker);
 return swap(s,'worldArtSpec, landscape, exteriorSites','worldArtSpec, landscape, terraces, exteriorSites');
});
changed('src/world/WorldArt.js',s=>s.replaceAll('field-boulders-v01.glb','field-boulders-v02.glb'));
changed('src/world/MeadowField.js',s=>{
 s=swap(s,'const data={radius:planet.R,first:','const data={terrainContract:planet.terraces?.contract||null,radius:planet.R,first:');
 return s.replaceAll('meadow-kit-v01.json','meadow-kit-v03.json').replaceAll('meadow-field-v01.png','meadow-field-v03.png');
});
fs.copyFileSync('assets/models/adventure/meadow-kit-v01.json',A+'/exports/meadow-kit-v03.json');
console.log('Created four source previews; root runtime unchanged. New terrain module is already in the art preview.');
