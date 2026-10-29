const fs=require('node:fs'),{A,B}=require('./field-meadow-fixture.cjs');
const spec=JSON.parse(fs.readFileSync(A+'/design-spec.json')),model=JSON.parse(fs.readFileSync(A+'/cluster-metrics.json')),bake=JSON.parse(fs.readFileSync(B+'/surface-bake.json')),routes=JSON.parse(fs.readFileSync(B+'/routes.json')),sites=JSON.parse(fs.readFileSync(B+'/sites.json'));
const metadata={version:1,routeSignature:bake.routeSignature,surface:spec.surface,variants:model.variants,placement:spec.placement,tufts:spec.tufts,palette:spec.palette,source:A+'/meadow-clusters-v01.blend'};
fs.writeFileSync(A+'/exports/meadow-kit-v01.json',JSON.stringify(metadata,null,2));
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const start=(title,sub)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><style>text{font-family:'Malgun Gothic',sans-serif;fill:#e5ede5}.title{font-size:30px;font-weight:bold}.sub{font-size:17px;fill:#b7c6c5}.label{font-size:19px}.small{font-size:16px;fill:#c1cfcc}.panel{fill:#20353a;stroke:#4b6465;stroke-width:1.5}</style><rect width="1440" height="900" fill="#12282e"/><text class="title" x="48" y="58">${esc(title)}</text><text class="sub" x="48" y="92">${esc(sub)}</text>`;
const lonlat=d=>[Math.atan2(d[2],d[0])*180/Math.PI,Math.asin(d[1])*180/Math.PI];
const local=d=>{const[lon,lat]=lonlat(d);return[82+(lon+26)/50*780,690-(lat+4)/34*530];};
let space=start('행성 들길 — 실제 경로와 표면 제작 도면','자체 설계 · 현재455파일 상태의 실제 구면 경로를 투영 · 높이/충돌/시설 위치 유지 · 게임 화면이 아님');
space+='<rect class="panel" x="40" y="120" width="850" height="650" rx="14"/><rect class="panel" x="916" y="120" width="484" height="650" rx="14"/>';
for(let lon=-20;lon<=20;lon+=10){const x=82+(lon+26)/50*780;space+=`<path d="M${x} 160V690" stroke="#49615f" stroke-dasharray="4 8"/><text class="small" x="${x-12}" y="724">${lon}°</text>`;}
for(let lat=0;lat<=30;lat+=10){const y=690-(lat+4)/34*530;space+=`<path d="M82 ${y}H862" stroke="#49615f" stroke-dasharray="4 8"/><text class="small" x="46" y="${y+6}">${lat}°</text>`;}
const firstParts=[[]];for(const d of routes.first){const part=firstParts.at(-1),previous=part.at(-1);if(previous&&Math.acos(Math.max(-1,Math.min(1,d.reduce((n,v,i)=>n+v*previous[i],0))))*routes.radius>2.6)firstParts.push([]);firstParts.at(-1).push(d);}
for(const part of firstParts)space+=`<polyline points="${part.map(d=>local(d).map(v=>v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#e8c787" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
const names={landing:'착륙 / 출발',ridge:'능선 접근',meadow:'들길',overlook:'조망 / 활공 보상',waterway:'수로 / 다음 단서'};
for(const [i,s]of spec.sites.entries()){const site=sites.find(x=>x.id===s.id),[x,y]=local(site.dir);space+=`<circle cx="${x}" cy="${y}" r="13" fill="#f3d6a1"/><text x="${x-5}" y="${y+6}" style="fill:#213333;font-size:17px">${i+1}</text><text class="label" x="${x+20}" y="${y-16}">${names[s.id]}</text>`;}
space+='<text class="label" x="944" y="156">보존하는 실제 행성 경로 6갈래</text><rect x="942" y="180" width="430" height="252" rx="8" fill="#162a30"/>';
const colours=['#e4ca8b','#81b49f','#9eabc6','#baabcc','#cbab8f','#a3ba82'];
routes.routes.forEach((r,i)=>{let parts=[[]];for(const d of r.dirs){const [lon,lat]=lonlat(d),p=[942+(lon+180)/360*430,432-(lat+90)/180*252],part=parts.at(-1);if(part.length&&Math.abs(part.at(-1)[0]-p[0])>215)parts.push([]);parts.at(-1).push(p);}for(const part of parts)space+=`<polyline points="${part.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${colours[i]}" stroke-width="3"/>`;});
const notes=['실제 위치·길은 보존. 표면 색만 연속화','길 중심은 흙 · 주변 빈터는 기존 함수 유지','새 입체 풀은 최대17m · 기존4번 그리기','낮음/최저: 구운 지면만 · G로 풀 끄기','각 신전 입구·숲도 동일 시점으로 확인','팔레트·목표 카메라를 아래 도면에 고정'];
notes.forEach((n,i)=>space+=`<text class="small" x="944" y="${478+i*43}">• ${n}</text>`);
space+='<text class="sub" x="48" y="821">원작 근거: Nintendo 공식 Locations 보존 장면0:23 / 0:50 · 실제 원작 실행·내부 지형 수치의 복원 아님</text><text class="sub" x="48" y="857">도면의 선은 제작 검토용. 게임 지면에 눈금·고리·연결선을 추가하지 않는다.</text></svg>';
fs.writeFileSync(A+'/spatial-blueprint.svg',space);
let tuft=start('낮고 이어지는 풀 — Blender 제작·팔레트 도면','자체 제작 목표 · 로컬 바닥Y=0 · 4종×9잎 · 종당54삼각형 · 중간/높음 최대2,400군락');
tuft+='<rect class="panel" x="40" y="120" width="870" height="650" rx="14"/><rect class="panel" x="936" y="120" width="464" height="650" rx="14"/>';
for(let v=0;v<4;v++){const cx=155+v*204,h=spec.tufts.heights[v],base=575;tuft+=`<path d="M${cx-80} ${base}H${cx+80}" stroke="#e4cfaa" stroke-width="3"/>`;for(let blade=0;blade<9;blade++){const root=cx+(blade%3-1)*27+(Math.floor(blade/3)-1)*5,height=h*(blade===8?1:.7+blade%4*.08)*750,lean=(blade%2?1:-1)*(10+blade);tuft+=`<path d="M${root-5} ${base}Q${root+lean*.2} ${base-height*.7} ${root+lean} ${base-height}Q${root+10+lean*.4} ${base-height*.45} ${root+5} ${base}Z" fill="${spec.palette.meadow[(blade+v)%4]}"/>`;}tuft+=`<text class="label" x="${cx-52}" y="625">${h.toFixed(2)}m / 54면</text><text class="small" x="${cx-59}" y="663">변형 ${v+1} · 뿌리 분산</text>`;}
tuft+='<text class="label" x="70" y="158">측면 형상 목표 · 그림은 치수 설명용이며 실제 GLB는 별도 측정</text><text class="small" x="70" y="711">뿌리는3×3영역에 분산 · 끝은 곡선 · 지면은 고정 · 잎 끝만 바람/접근에 반응</text>';
spec.palette.meadow.forEach((c,i)=>tuft+=`<rect x="${962+i*103}" y="190" width="88" height="62" rx="5" fill="${c}"/><text class="small" x="${962+i*103}" y="278">${c}</text>`);
[['흙길',spec.palette.soil],['바위',spec.palette.stone],['공기',spec.palette.air]].forEach(([n,c],i)=>tuft+=`<rect x="${962+i*140}" y="322" width="118" height="62" rx="5" fill="${c}"/><text class="small" x="${962+i*140}" y="413">${n} ${c}</text>`);
['목표 카메라1280×800 / FOV62°','거리7.6m / pitch0.32rad','정면0° / 측면90° / 후면180°','실제 잔디 카펫 높이에 뿌리 배치','팔레트·중간 안개는 자체 선택','학교 기기FPS·학생 평가는 미확인'].forEach((n,i)=>tuft+=`<text class="small" x="962" y="${474+i*43}">• ${n}</text>`);
tuft+='<text class="sub" x="48" y="821">첫 별 모양/얼룩진 시안은 initial-sparse에 보존. 실제 시제품24시점이 나아진 뒤 제품 연결을 판단한다.</text><text class="sub" x="48" y="857">Blender 편집 원본·GLB·같은 카메라의 실제 렌더는 도면과 구분해 보존한다.</text></svg>';
fs.writeFileSync(A+'/tuft-palette.svg',tuft);
console.log(JSON.stringify({metadata:metadata.routeSignature,diagrams:2,variants:model.variants.length,glbBytes:fs.statSync(A+'/exports/meadow-clusters-v01.glb').size,fieldBytes:bake.bytes}));
