const fs=require('node:fs'),{A,B}=require('./landing-arrival-fixture.cjs'),images=[],cards=[];
function img(file,label){images.push({file,label});return`<a href="../../../${file}"><img loading="lazy" src="../../../${file}" alt="${label}"></a><p>${label}</p>`;}
for(const id of['front-0.25','side-0.25','rear-0.25','front-0.8','side-0.8','rear-0.8','front-1.7','side-1.7','rear-1.7','far','min'])cards.push(`<article><h2>${id}</h2><div class="three">${[['before','이전 제품 · 준비 시점'],['goal','자체 시안 · 제품 연결 전'],['after','현재 제품 · 준비 시점']].map(([p,label])=>`<figure>${img(B+'/'+p+'-'+id+'.png',label)}</figure>`).join('')}</div></article>`);
const extra=[
 [A+'/blueprint.svg','자체 설계도 · 기존 플랫폼/접지·범위 유지'],
 [B+'/initial-goal-front.png','초기 시안 · 아직 옷을 더 밝게 칠하던 단계'],
 [B+'/initial-goal-far.png','초기 시안 · 먼 봉화가 너무 희미한 단계'],
 [B+'/pc-ship-return.png','PC · 실제 이동/귀환 뒤 저장 재접속'],
 [B+'/touch-ship-return.png','터치 · 실제 이동/귀환 뒤 저장 재접속'],
 ...['front','side','rear'].map(v=>[B+'/expedition-current/overlook-'+v+'.png','현재 능선/관측대 검사 · '+v+' 준비 카메라']),
 ['reports/2026-10-22/evidence/reference-observation/locations-23.png','Nintendo Locations0:23 보존 장면 · 공식 관찰, 원작 실행 아님'],
];
for(const[file,label]of extra)cards.push(`<article><h2>${label}</h2>${img(file,label)}</article>`);
fs.writeFileSync(A+'/review.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>무무 행성 · 착륙 빛 비교</title><style>*{box-sizing:border-box}body{margin:0;background:#142b34;color:#efe7d5;font:17px/1.7 system-ui,'Malgun Gothic',sans-serif}main{max-width:1600px;margin:auto;padding:24px}h1{font-size:30px}h2{font-size:20px}a{color:#b5e9ff}article{padding:18px;margin:24px 0;border:1px solid #688384;border-radius:12px;background:#1c343d}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}figure{margin:0;min-width:0}img{display:block;max-width:100%;width:100%;height:auto}p{overflow-wrap:anywhere}article> a img{max-height:800px;object-fit:contain}@media(max-width:750px){main{padding:12px}.three{grid-template-columns:1fr}h1{font-size:24px}}</style><main><h1>착륙 빛 · 몸과 길을 남기는 귀환 장치</h1><p>정면/측면/후면 0.25·0.8·1.7초, 먼 봉화와 최저 화질을 같은 카메라로 비교한다. 흰 화면 전환은 숨기고 세계 효과만 측정한 준비 장면이다. 자체 시안은 원작 이미지가 아니다. 실제 입력·능선/23m활공·저장 복원은 별도 검사다.</p><p><a href="../../../reports/2026-10-26/LANDING_ARRIVAL.md">변경·검사·비용·남은 격차</a> · <a href="../../../">게임</a> · <a href="../../../art/sift-thresholds/v01/review.html">직전 분리 신전 비교</a> · <a href="https://www.youtube.com/watch?v=12_Z1pJgClo&t=23s">공식 참고 장면 출처</a></p>${cards.join('')}</main>`);
fs.writeFileSync(A+'/review-manifest.json',JSON.stringify({comparisons:11,images,scope:'Prepared world VFX views, independent native input/regression evidence and official reference; no school-device or whole-game completion claim'},null,2));console.log('Built '+images.length+' review images.');
