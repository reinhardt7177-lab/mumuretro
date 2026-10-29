// Reused verification modules must not update earlier report/artifact folders.
const fs=require('node:fs'),path=require('node:path'),{fileURLToPath}=require('node:url'),root=path.resolve('.'),allowed=path.resolve('reports/2026-10-26/evidence/field-meadow');
function inspect(file){if(typeof file==='number')return;const full=path.resolve(file instanceof URL?fileURLToPath(file):Buffer.isBuffer(file)?file.toString():file);for(const dir of['reports','art','src','assets','vendor']){const protectedRoot=path.join(root,dir);if((full===protectedRoot||full.startsWith(protectedRoot+path.sep))&&full!==allowed&&!full.startsWith(allowed+path.sep))throw Error('Field verification output outside its evidence directory: '+path.relative(root,full));}}
for(const name of['writeFileSync','appendFileSync','createWriteStream','mkdirSync']){const original=fs[name];fs[name]=function(file,...args){inspect(file);return original.call(this,file,...args);};}
for(const name of['writeFile','appendFile','mkdir']){const original=fs.promises[name];fs.promises[name]=async function(file,...args){inspect(file);return original.call(this,file,...args);};}
module.exports={allowed,inspect};
