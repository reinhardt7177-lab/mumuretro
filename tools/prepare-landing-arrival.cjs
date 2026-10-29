const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A='art/landing-arrival/v01',B='reports/2026-10-26/evidence/landing-arrival';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(A,{recursive:true});fs.mkdirSync(B,{recursive:true});
if(fs.existsSync(B+'/baseline.json'))throw Error('Preserve the existing landing baseline');
const inventory={};
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.posix.join(p,e.name);if(e.isDirectory())walk(f);else inventory[f]=hash(fs.readFileSync(f));}}
for(const p of['src','assets','vendor'])walk(p);
for(const p of['index.html','fire-trial.html'])inventory[p]=hash(fs.readFileSync(p));
const files=['src/world/Landing.js','src/boot.js'];
for(const f of files)fs.copyFileSync(f,B+'/before-'+f.replaceAll('/','__'));
const palette={stone:'#6f6a60',brass:'#aa8342',beacon:'#b5e9ff',air:'#c2dce6'};
fs.writeFileSync(B+'/baseline.json',JSON.stringify({created:new Date().toISOString(),scope:'451-file state after Sift thresholds, before landing VFX; protected source and assets, no personal saves',files,inventory,palette},null,2));
fs.writeFileSync(A+'/blueprint.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="780" viewBox="0 0 1200 780"><rect width="1200" height="780" fill="#142b34"/><g fill="#efe7d5" font-family="Malgun Gothic,system-ui,sans-serif"><text x="44" y="58" font-size="28">착륙 귀환 장치 · 자체 VFX 설계</text><text x="44" y="90" font-size="17">기존 바닥/Blender 장치 보존 · 1.6초 도착 · 정면/측면/후면 동일 카메라 비교</text></g><g stroke="#adc5c7" fill="none"><path d="M60 610H760M145 610V170M580 610V170" stroke-dasharray="7 9"/><ellipse cx="365" cy="610" rx="220" ry="66" fill="#6f6a60"/><ellipse cx="365" cy="600" rx="170" ry="47" stroke="#b5e9ff" stroke-width="4"/><path d="M145 560V175Q360 140 580 175V560" stroke="#b5e9ff" stroke-opacity=".45" stroke-width="4"/><path d="M365 365v170m-45 74 45-74 40 74m-45-155-36 54m36-54 34 54" stroke="#efe7d5" stroke-width="12"/><circle cx="365" cy="341" r="22" fill="#efe7d5"/><path d="M220 595l8-38m280 43-4-43m-228 69 5-30m159 32-3-32" stroke="#b5e9ff" stroke-width="5"/></g><g fill="#efe7d5" font-family="Malgun Gothic,system-ui,sans-serif" font-size="18"><text x="160" y="710">판 반지름2.4m / 기존 접지·귀환 범위 유지</text><text x="650" y="220">가까이: 중앙은 맑게, 테두리만 부드럽게</text><text x="650" y="260">멀리: 낮은 푸른 봉화로 귀환 위치 식별</text><text x="650" y="340">옷 전체를 칠하던 순간 광원 축소</text><text x="650" y="380">바닥 파문은 판의 범위 안에 머문다</text><text x="650" y="420">사각 불티10개 → 부드러운 점20개/1배치</text><text x="650" y="510">색: 기존 장치의 파랑/청동/돌</text><text x="650" y="550">새 광원·Blender 모델·유료 생성 없음</text><text x="650" y="625" fill="#c4c7bd">미확인: 학교 FPS·학생 첫 반응</text></g></svg>`);
console.log(JSON.stringify({runtimeFiles:Object.keys(inventory).length,files,palette}));
