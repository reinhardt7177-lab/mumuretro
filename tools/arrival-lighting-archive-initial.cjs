// Restore and preserve the exact first candidate from its recorded response hashes.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),A='art/arrival-coherence/v01/lighting';
const report=JSON.parse(fs.readFileSync(A+'/candidate-01.json'));
for(const row of report.source){let s=fs.readFileSync(A+'/preview-'+row.file.replaceAll('/','__'),'utf8');
 if(row.file==='src/core/Engine.js')s=s.replace('const SHADOW_EXTENT_MAX = 40;','const SHADOW_EXTENT_MAX = 26;');
 if(row.file==='src/data/lighting.js')s=s.replace('sun:    0xffe6b0','sun:    0xffeed4').replace('shadow: 0xb8c9d6','shadow: 0xb4cfe5').replace('air:    0xa9cde5','air:    0xb4d6ed').replace('top:     0x4b9fdf','top:     0x559fda').replace('sun:   2.45,','sun:   2.3,').replace('hemi:  1.15,','hemi:  0.86,').replace('fill:  0.35,','fill:  0.38,').replace('fogNear:12,fogFar:100,skyTransition:.22,ground:0xb2a98a,environmentGain:.18,environmentKey:.20','fogNear:18,fogFar:105,skyTransition:.32,ground:0x9b8b67,environmentGain:.44,environmentKey:.38').replace('planetBloom:.035','planetBloom:.055');
 assert.equal(crypto.createHash('sha256').update(s).digest('hex'),row.previewSha256,row.file);
 fs.writeFileSync(A+'/candidate-01-'+row.file.replaceAll('/','__'),s);
}
console.log('Preserved all four exact candidate-01 HTTP bodies.');
