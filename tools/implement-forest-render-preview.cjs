const fs=require('node:fs'),assert=require('node:assert/strict'),{A,B}=require('./forest-render-fixture.cjs');
let source=fs.readFileSync(B+'/before-src__world__Forage.js','utf8');
source=source.replace("import { josa } from '../util/josa.js';","import { josa } from '../util/josa.js';\nimport { batchStaticChildren } from './StaticMeshBatch.js';");
assert(source.includes('const site = BUILD[kind](dir, seed, beastId);'));
source=source.replace('const site = BUILD[kind](dir, seed, beastId);',`const site = BUILD[kind](dir, seed, beastId);
    // Only these parents own static child transforms. Candidates remain
    // separate so harvesting, regrowth and imported saves hide one choice.
    if (site.cands) {
      batchStaticChildren(site.group);
      for (const candidate of site.cands) batchStaticChildren(candidate.grp);
    }
    if (site.trap) batchStaticChildren(site.trap.crate);`);
fs.writeFileSync(A+'/preview-src__world__Forage.js',source);
console.log('Prepared candidate/crate batching preview; installed source unchanged.');
