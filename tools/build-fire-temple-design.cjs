// The same metre-based coordinates drive the diagram and the Blender scene.
const fs=require('node:fs'),path=require('node:path');
const OUT=path.join(__dirname,'../art/fire-temple/v01');fs.mkdirSync(OUT,{recursive:true});
const spec={version:1,date:'2026-10-20',status:'design-and-offline-model; not integrated into gameplay',coordinates:'Three.js x,y,z; y up; south +z; all building local floor origins y=0',
 palette:{basalt:'#343d44',edge:'#67727b',bronze:'#aa7f46',ash:'#c3b697',lava:'#ff742a',steam:'#8eb9c2'},
 hub:{id:'hub',x:0,z:0,radius:12,floor:0},
 entry:{id:'entry',x:0,z:23,width:8,depth:22,floor:0},
 rooms:[{id:'fracture',name:'균열 회랑',x:-28,z:1,width:20,depth:26,floor:0,wallHeight:7,pit:{z0:-3,z1:3,floor:-3},bridge:{x:-28,z:0,width:3.6,depth:6.4,floor:0},sockets:[[-29.4,4.3],[-26.6,4.3]],braces:[[-32,9],[-24,9]],goal:[-28,-8],
   loop:'Observe movement → carry two brace blocks → seat both → run test → cross and latch far anchor',states:['loose','braced','testing','stable','latched'],completion:'Both braces seated AND test stable AND actor at far anchor; not merely pressing E',reset:'Keep seated braces; recover carried brace at near bank; no full-room reset'},
 {id:'foundry',name:'熔岩 주조실',x:28,z:1,width:20,depth:26,floor:0,wallHeight:7,pit:{z0:-3,z1:3,floor:-3},bridge:{x:28,z:0,width:4,depth:6.4,floor:0},controls:[[24,7],[31,7]],goal:[28,-8],source:[35,-9],mouldCapacity:1,
   loop:'Rotate two channels → open source → fill bridge mould → close source → cool → cross',states:['empty','routing','filling','hot','cooling','solid','latched'],completion:'Full mould AND source closed AND cooling complete AND actor at far anchor',reset:'Misrouted lava goes into enclosed drain; preserve already solid bridge'},
 {id:'steam',name:'증기 승강실',x:0,z:-27,width:24,depth:20,floor:0,wallHeight:8,diverter:[-6,-21],turbine:[-7,-27],accessBridge:{x:0,z:-28,width:8,depth:3.6,floor:0},lift:{x:7,z:-31,width:3.6,depth:3.6,low:0,high:3.2},balcony:{x:0,z:-35,width:24,depth:4,floor:3.2},
   loop:'Divert steam to winch → latch access bridge → divert steam to lift → board and start → upper landing',states:['bridge_closed','bridge_moving','bridge_latched','lift_ready','ascending','upper_latched'],completion:'Bridge latched AND actor rides lift to upper landing; platform cannot rise without rider',reset:'Upper call lever and safe descent; bridge stays latched; board starts motion'},
 {id:'sanctum',name:'불꽃 수호자의 전당',x:0,z:-49,width:28,depth:16,floor:3.2,wallHeight:9,altar:[0,-53],
   loop:'Observe three permanent seals → cross upper passage → guardian dialogue → record and exit',states:['sealed','open','audience','recorded','sealed_complete'],completion:'Three room latches AND one completed audience event',reset:'Revisit record; never award twice; restore outside after event'}],
 corridors:[{id:'west',x:-13,z:8,width:10,depth:4,floor:0},{id:'east',x:13,z:8,width:10,depth:4,floor:0},{id:'north',x:0,z:-14.5,width:4.8,depth:5,floor:0},{id:'upper',x:0,z:-39,width:6,depth:4,floor:3.2}],
 progression:['entry','hub','fracture','hub','foundry','hub','steam','sanctum','outside'],
 locks:{foundry:'fracture.latched',steam:'foundry.latched',sanctum:'fracture.latched && foundry.latched && steam.upper_latched'},
 portal:{clearWidth:4.8,clearHeight:5.2,width:9.6,height:8.4,depth:1.4,archSpring:2.8},
 constraints:{actorHeight:1.5,actorRadius:.30,minimumPath:2.4,mainPath:3.6,minimumHeadroom:2.2,cameraTargetDistance:5,maximumStep:.28,floorDatum:0,noStairsBypassingLift:true},
 targetPlayMinutes:[12,18],runtimePlan:{newModule:'FireAdventure',save:'fire-specific version with legacy copy; keep mumuplanet.progress.v1',import:'Validate complete payload before applying; snapshot moving devices at stable endpoint',render:'GLB geometry + separate walk surfaces/camera occluders + runtime lava/steam VFX'},
 currentStage:{conceptImages:true,exactBlueprint:true,blender:'first map and portal fabrication',runtime:false,playtest:false}};
spec.rooms[1].name='용암 주조실';
spec.rooms[2].pit={z0:-30,z1:-24,floor:-3};
spec.rooms[2].accessBridge.z=-27;spec.rooms[2].accessBridge.depth=6.4;
spec.rooms[2].lift.z=-31.2;
fs.writeFileSync(path.join(OUT,'design-spec.json'),JSON.stringify(spec,null,2));
const esc=t=>String(t).replaceAll('&','&amp;').replaceAll('<','&lt;');
let out=[];const add=s=>out.push(s),rect=(x,y,w,h,fill,stroke='#63737b',r=0)=>add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`),txt=(x,y,s,size=18,c='#e9e4d4')=>add(`<text x="${x}" y="${y}" font-size="${size}" fill="${c}">${esc(s)}</text>`);
add(`<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="1120" viewBox="0 0 1700 1120"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#263943" stroke-width=".5"/></pattern><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#e8bd72" stroke-width="1.2"/></marker></defs><rect width="1700" height="1120" fill="#101e27"/><rect width="1700" height="1120" fill="url(#grid)"/><g font-family="Malgun Gothic,Arial,sans-serif">`);
txt(42,52,'흔들리는 사당 · 화산과 지진 신전',34);txt(43,85,'V01 / 2026.10.20     정확한 제작 평면도 · 1칸=5m · 웹 Y↑ / 북쪽 −Z',18,'#93bac7');
rect(25,113,355,940,'#172a34','#465d68',14);txt(48,150,'게임의 흐름',24);
const cards=[['01 · 중앙 홀','먼저 목적지를 보고, 방을 하나씩 연다.','완료 표지는 중앙 홀에 계속 남는다.'],['02 · 균열 회랑','받침 두 개로 다리를 고정하고 시험한다.','흔들림이 멎은 다리를 직접 건너 잠근다.'],['03 · 용암 주조실','수로를 잇고 용암으로 빈 틀을 채운다.','흐름을 끊고 굳은 돌길을 건넌다.'],['04 · 증기 승강실','증기로 접근 다리를 내려 영구 고정한다.','동력을 승강기로 바꿔 탑승한 뒤 올라간다.'],['05 · 수호자의 전당','세 문양이 열린 상층 통로로 진입한다.','신과 대화 → 기록 → 바깥으로 자동 퇴장.']];
cards.forEach((c,i)=>{const y=192+i*142;rect(44,y-25,317,116,'#20343f','#465964',8);txt(58,y,c[0],21,'#ecc589');txt(58,y+31,c[1],14);txt(58,y+57,c[2],14);if(i<4)txt(192,y+106,'↓',24,'#ecc589');});
txt(48,951,'실패해도 해결한 부분은 보존',18,'#a7d1cd');txt(48,980,'낙하 → 가까운 안전 발판에서 재시도',14);txt(48,1008,'대기·회전 중 저장 → 안정 상태로 복원',14);
const scale=7.9,originX=800,originY=595,px=x=>originX+x*scale,py=z=>originY+z*scale;
const box=(r,fill='#3b4b51')=>rect(px(r.x-r.width/2),py(r.z-r.depth/2),r.width*scale,r.depth*scale,fill,'#b5b4a3');
spec.corridors.forEach(c=>box(c,'#57656a'));box(spec.entry,'#57656a');
add(`<circle cx="${px(0)}" cy="${py(0)}" r="${12*scale}" fill="#586167" stroke="#c6a76b" stroke-width="3"/>`);
for(const r of spec.rooms){box(r);if(r.pit){rect(px(r.x-r.width/2+.3),py(r.pit.z0), (r.width-.6)*scale,(r.pit.z1-r.pit.z0)*scale,'#1b1717','#df7d46');if(r.bridge)box({...r.bridge},r.id==='fracture'?'#b3a68b':'#b96b40');}
 txt(px(r.x-r.width/2)+10,py(r.z-r.depth/2)+23,r.name,17,'#e8c383');txt(px(r.x-r.width/2)+10,py(r.z-r.depth/2)+44,`${r.width} × ${r.depth}m / 바닥 +${r.floor.toFixed(1)}m`,12,'#a9cad1');}
for(const s of spec.rooms[0].sockets)rect(px(s[0]) -4,py(s[1])-4,8,8,'#e6bd75');for(const s of spec.rooms[0].braces)rect(px(s[0]) -5,py(s[1])-5,10,10,'#a6bec1');
const lava=[[35,-9],[35,-6],[28,-6],[28,3]];add(`<polyline points="${lava.map(p=>`${px(p[0])},${py(p[1])}`).join(' ')}" fill="none" stroke="#fa873f" stroke-width="6"/>`);
const s=spec.rooms[2];box({...s.accessBridge},'#9e906c');box({...s.lift,floor:0},'#b59b68');box({...s.balcony},'#7b938f');
add(`<path d="M${px(-6)} ${py(-21)}L${px(-6)} ${py(-27)}L${px(0)} ${py(-28)}M${px(-6)} ${py(-21)}L${px(7)} ${py(-21)}L${px(7)} ${py(-31)}" fill="none" stroke="#93c3cf" stroke-width="3"/>`);
txt(px(0)-30,py(0)-4,'中央 홀'.replace('中央','중앙'),20,'#f1d29b');txt(px(0)-35,py(0)+20,'지름 24m',14);txt(px(-2),py(24),'입구',18);
const segments=[[[0,30],[0,8],[-13,8],[-23,8],[-28,4],[-28,-8]],[[0,7],[13,8],[24,8],[28,4],[28,-8]],[[0,-6],[0,-20],[-6,-21],[-6,-28],[7,-28],[7,-31],[7,-35],[0,-39],[0,-50]]];
segments.forEach(route=>add(`<polyline points="${route.map(p=>`${px(p[0])},${py(p[1])}`).join(' ')}" fill="none" stroke="#e8bd72" stroke-width="2" stroke-dasharray="7 6" marker-end="url(#arrow)"/>`));
txt(441,1060,'← 서 / −X',17);txt(1038,1060,'동 / +X →',17);txt(772,118,'북 / −Z ↑',16);txt(752,916,'남 / +Z ↓',16);
rect(1190,113,485,940,'#172a34','#465d68',14);txt(1215,151,'높이와 제작 기준',24);
const line=(x1,y1,x2,y2,c='#b9c5c0',w=2)=>add(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" fill="none"/>`);
txt(1214,196,'단면 A–A · 입구 → 상층 전당',18,'#e8bd72');line(1218,330,1430,330);line(1430,330,1430,255);line(1430,255,1640,255);rect(1395,314,53,16,'#a78d5b');line(1421,309,1421,261,'#94c4d0');txt(1220,358,'±0.00m 기준 바닥',14);txt(1453,242,'+3.20m 상층 바닥',14);txt(1394,392,'승강기만 연결 / 우회 계단 없음',15,'#cbd8cf');
txt(1214,450,'정문 모듈 · 아래 면은 바닥 y=0',18,'#e8bd72');rect(1280,494,300,210,'#26383f','#c4a166');rect(1355,574,150,130,'#17242d','#d0ad70');add(`<path d="M1355 574A75 75 0 0 1 1505 574" fill="#17242d" stroke="#d0ad70" stroke-width="2"/>`);line(1218,704,1640,704,'#8fb8c2');txt(1305,730,'전체 9.6m × 8.4m × 깊이 1.4m',15);txt(1280,759,'유효 개구부 4.8m × 최고 5.2m',15);
[['기본 통로', '3.6m / 최소 2.4m'],['캐릭터 / 머리 여유','키 1.5m / 최소 2.2m'],['건축물 기준','밑면 y=0 · 각 층 바닥에 배치'],['승강 높이','3.2m · 탑승 확인 후 움직임'],['균열 간격','6.0m · 점프로 건너뛰기 방지'],['미구현 구분','설계·Blender 모델 / 게임 연결 전']].forEach((r,i)=>{const y=810+i*35;txt(1215,y,r[0],14,'#a4c9d1');txt(1380,y,r[1],14);});
txt(42,1092,'설계 제안이며 게임에 적용된 화면이 아닙니다. 배치·바닥·치수는 design-spec.json이 기준입니다.',16,'#a1c1cc');add('</g></svg>');
fs.writeFileSync(path.join(OUT,'blueprint.svg'),out.join('\n'));
// Report the explicit design invariants; this does not certify gameplay.
fs.writeFileSync(path.join(OUT,'design-metrics.json'),JSON.stringify({units:'metres',bounds:{x:[-38,38],z:[-57,34]},roomCount:spec.rooms.length,hubDiameter:24,floors:[0,3.2],minimumPath:2.4,mainPath:3.6,portal:spec.portal,designOnly:true,playtest:false},null,2));
console.log('Wrote metre-based design, blueprint and design measurements. No runtime files changed.');
