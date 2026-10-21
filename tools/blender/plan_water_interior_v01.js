// Deterministic planning drawing. Units and paths are proposal data, not a playable scene.
const fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../../art/glacier-water-temple/interior/v01');fs.mkdirSync(out,{recursive:true});
const rooms=[
 {id:'ice',title:'1실 · 얼음길',w:14,d:18,items:[['공급조',-4,4,'water'],['회수 펌프',-5,2,'machine'],['얼음길',0,9,'ice'],['착지·복귀로 잠금',0,12.5,'machine'],['출구',0,17,'goal']],route:[[0,1],[-3,4],[0,6],[0,12.5],[0,17]],water:[[-4,4],[-4,7],[0,9]],return:[[-1,9],[-5,9],[-5,2],[-4,4]],gap:[7,11],returnX:-5.8},
 {id:'collector',title:'2실 · 집수실',w:18,d:20,items:[['가열 용기',-2,5,'water'],['회수조·펌프',-5,4,'machine'],['증기 상승관',4,7,'vapor'],['집수판 Y=5.0',4,14,'ice'],['수조 Y=3.0',1,15,'water'],['부표 다리',0,17,'machine'],['출구 Y=3.0',0,19,'goal']],route:[[0,1],[-7,3],[-7,13],[-4,14],[1,15],[0,19]],water:[[-2,5],[4,5],[4,14],[1,15]],return:[[4,14],[6,14],[6,4],[-5,4],[-2,5]],gap:[16,18],returnX:null},
 {id:'cycle',title:'3실 · 순환의 성소',w:22,d:24,items:[['공급조 6',-5,4,'water'],['회수 펌프',-8,4,'machine'],['얼음길 4',0,11,'ice'],['착지·돌다리 잠금',0,15,'machine'],['가열 용기',5,5,'water'],['수문·집수판',7.5,20,'ice'],['성소 목표 5',0,20,'goal']],route:[[0,1],[-5,4],[0,7],[0,15],[7.5,15],[7.5,20]],water:[[-5,4],[0,7],[0,11],[5,8],[5,5],[9,5],[9,20],[7.5,20],[0,20]],return:[[7.5,20],[10,20],[10,3],[-8,3],[-8,4],[-5,4]],gap:[8.8,13.4],returnX:-7}
];
fs.writeFileSync(path.join(out,'layout-spec.json'),JSON.stringify({status:'proposed; validate jump reach, sightlines and collisions in blockout',datum:'Each room floor Y=0; X horizontal, Z from entrance toward exit. Layout footprints are illustrative.',rooms},null,2));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="1320" viewBox="0 0 1680 1320"><defs><marker id="walk" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#e1ac47"/></marker><marker id="flow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#2cbbc8"/></marker></defs><style>text{font-family:'Malgun Gothic',sans-serif;fill:#dfeaf1} .small{font-size:15px} .label{font-size:15px;paint-order:stroke;stroke:#15262e;stroke-width:4px;stroke-linejoin:round}</style><rect width="1680" height="1320" fill="#0e1b23"/><text x="45" y="55" font-size="30">물의 팔찌 · 신전 내부 제작 도면 v01</text><text x="45" y="86" font-size="17">계획 도면 — 장식보다 바닥·물길·복구 동선 우선 / 단위 m / 아직 게임에서 검증하지 않은 치수</text>`;
const colors={water:'#247c94',ice:'#78cddd',machine:'#99763e',goal:'#6d9370',vapor:'#9276a4'};
rooms.forEach((r,idx)=>{
 const ox=45+idx*550,oy=150,scale=17; const px=x=>ox+245+x*scale,pz=z=>oy+490-z*scale;
 svg+=`<rect x="${ox}" y="115" width="525" height="590" rx="12" fill="#15262e"/><text x="${ox+20}" y="151" font-size="22">${r.title} · ${r.w} × ${r.d}m</text>`;
 const ry=pz(r.d);svg+=`<rect x="${px(-r.w/2)}" y="${ry}" width="${r.w*scale}" height="${r.d*scale}" fill="#34434a" stroke="#a8b7b9" stroke-width="3"/>`;
 svg+=`<rect x="${px(-r.w/2)}" y="${pz(r.gap[1])}" width="${r.w*scale}" height="${(r.gap[1]-r.gap[0])*scale}" fill="#133e51"/><rect x="${px(-1.4)}" y="${pz(r.gap[1])}" width="${2.8*scale}" height="${(r.gap[1]-r.gap[0])*scale}" fill="#76bdd0" opacity=".65"/>`;
 if(r.returnX!==null)svg+=`<rect x="${px(r.returnX-.6)}" y="${pz(r.gap[1]+.5)}" width="${1.2*scale}" height="${(r.gap[1]-r.gap[0]+1)*scale}" fill="#c9b681" stroke="#efd483" stroke-dasharray="5 4"/>`;
 const line=(pts,color,dash,marker)=>`<polyline points="${pts.map(p=>`${px(p[0])},${pz(p[1])}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" ${dash?'stroke-dasharray="7 5"':''} ${marker?`marker-end="url(#${marker})"`:''}/>`;
 svg+=line(r.return,'#b594d8',true,null)+line(r.water,'#2cbbc8',false,'flow')+line(r.route,'#e1ac47',true,'walk');
 r.items.forEach(([name,x,z,t],i)=>{svg+=`<circle cx="${px(x)}" cy="${pz(z)}" r="9" fill="${colors[t]}" stroke="#e6eff2"/><text class="label" x="${px(x)+13}" y="${pz(z)+(i%2?19:-11)}">${esc(name)}</text>`;});
 svg+=`<text x="${ox+25}" y="675" font-size="15">入口側 Z=0 ／ 出口側 +Z ／ 地面 Y=0</text>`;
});
svg+=`<text x="45" y="746" font-size="18" fill="#e1ac47">금색 점선: 플레이어 이동　청록: 물/증기 경로　보라 점선: 회수 배관　연갈색: 고정되는 복귀 다리</text>`;
const section=(x,title,upper,lines)=>{svg+=`<rect x="${x}" y="790" width="780" height="270" rx="12" fill="#15262e"/><text x="${x+22}" y="826" font-size="22">${title}</text><path d="M${x+35} 1010H${x+745}" stroke="#d6d1b4" stroke-width="5"/><text x="${x+40}" y="1040" font-size="15">기준 바닥 Y=0 · 기둥과 계단은 이 바닥에서 시작</text><path d="M${x+180} 1008L${x+350} 902H${x+650}" stroke="#b5b7a8" stroke-width="9" fill="none"/><text x="${x+370}" y="932" font-size="16">${upper}</text><rect x="${x+75}" y="970" width="70" height="37" fill="#247c94"/><path d="M${x+110} 970V855H${x+560}" fill="none" stroke="#b594d8" stroke-width="4"/><path d="M${x+545} 850l65 15" stroke="#7fe3ec" stroke-width="8"/><path d="M${x+607} 869V893" stroke="#2cbbc8" stroke-width="4" stroke-dasharray="4 4"/><text x="${x+170}" y="850" font-size="15">증기 관로 → 냉각판 → 물받이</text></rect>`;};
section(45,'2실 단면 · 냉각판은 계단에서 접근','관리 회랑 Y=3.0 / 판 Y=5.0');section(865,'3실 단면 · 먼저 위를 준비한 뒤 아래서 가열','관리 회랑 Y=2.4 / 판 Y=4.6');
svg+=`<text x="45" y="1110" font-size="21">제작 전 확인</text><text x="45" y="1150" font-size="17">① 점프 거리 실측으로 도랑 폭 확정　② 팔찌 사거리 6m·벽 가림 확인　③ 차가운 판은 준비 상태 유지</text><text x="45" y="1190" font-size="17">④ 회수 펌프는 공급조로만 연결　⑤ 고정 착지판이 복귀 다리를 잠금　⑥ 부분 얼음·추락·저장 복구 시험</text><text x="45" y="1240" font-size="16">도면의 선은 연결 관계를 표시합니다. 물·증기·보행의 실제 높이와 장치 크기는 다음 블록아웃에서 검증합니다.</text></svg>`;
svg=svg.replaceAll('入口側 Z=0 ／ 出口側 +Z ／ 地面 Y=0','입구 Z=0 / 출구 +Z / 바닥 Y=0').replaceAll('</text></rect>','</text>');
fs.writeFileSync(path.join(out,'floorplan-sections.svg'),svg);
