const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const B='reports/2026-10-24/evidence/chronicle-portal',A='art/chronicle-portal/v01',read=f=>JSON.parse(fs.readFileSync(f)),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const cases=[['portal','check.json',13],['asset-failure','fallback.json',12],['specimens','regressions/check-chronicle-evidence/check.json',12],['touch','regressions/check-chronicle-evidence-touch/touch.json',8],['journey','regressions/journey/strata-journey.json',14],['six-room-save','regressions/save/app-progress.json',7]].map(([name,file,count])=>{const r=read(B+'/'+file);assert(r.pass&&r.checks.length===count&&r.checks.every(c=>c.pass)&&!r.errors.length,name);return{name,file,checks:count};});
for(const [fault,name] of [['collision','actual run and jump stop against closed visible slab'],['visual','wall and solved fossils rise continuously with physical slab']]){const r=read(B+'/fault-'+fault+'.json');assert(!r.pass&&!r.errors.length&&r.checks.at(-1).name===name&&!r.checks.at(-1).pass,'designated fault '+fault);}
const before=read(B+'/before/report.json'),after=read(B+'/after/report.json'),goal=read(A+'/goal-cameras.json');const camera=s=>JSON.stringify([s.id,s.camera,s.target,s.fov,s.aspect]);
assert(before.pass&&after.pass&&before.shots.length===6&&after.shots.length===6);assert(before.shots.every((s,i)=>camera(s)===camera(after.shots[i])&&camera(s)===camera(goal.shots[i])),'six matched cameras');assert(JSON.stringify(before.contract)===JSON.stringify(after.contract),'same puzzle arrangement');
assert(after.shots.every(s=>s.portal.loaded&&s.door===(s.state==='open')),'current authored assets and door states');assert(read(B+'/review-check.json').pass);
assert(after.shots.every(s=>s.portal.metrics.meshes===22&&s.portal.metrics.materials===22&&s.portal.metrics.geometries===16&&s.portal.metrics.triangles===7372),'actual runtime model counts');
const manifest=read('dist/assets/release.json');for(const [file,expected] of Object.entries(manifest.files)){assert(hash('dist/'+file)===expected,'built '+file);let buf=fs.readFileSync(file);if(!file.startsWith('vendor/')&&/\.(html|js|css|json|svg|txt|md)$/.test(file))buf=Buffer.from(buf.toString().replace(/\r\n/g,'\n'));assert(crypto.createHash('sha256').update(buf).digest('hex')===expected,'source '+file);}
const metrics=read(A+'/model-metrics.json');assert(fs.statSync('assets/models/adventure/chronicle-portal-v01.glb').size===metrics.glbBytes);for(const part of Object.values(metrics).filter(x=>typeof x==='object'))assert(Math.abs(part.webMin[1])<.001,'grounded model');
const court=read('art/chronicle-court/v01/goal-cameras.json');assert(hash('art/chronicle-court/v01/chronicle-court-v01.blend')===court.sourceSha256&&hash('assets/models/adventure/chronicle-court-v01.glb')===court.modelSha256,'prior court preserved');
const files=['src/shrine/StrataPortal.js','src/shrine/Room.js','src/boot.js',A+'/chronicle-portal-v01.blend','assets/models/adventure/chronicle-portal-v01.glb','assets/models/adventure/chronicle-portal-v01.json','tools/check-strata-portal.cjs','tools/run-chronicle-portal-case.cjs'];
const result={pass:true,scope:'First-room lifting layer wall and passage; not whole chamber or app completion',normalChecks:cases.reduce((n,x)=>n+x.checks,0),cases,faults:2,buildFiles:Object.keys(manifest.files).length,matchedCameras:6,reviewImages:21,model:metrics,sourcePieces:139,uniqueMeshes:16,uniqueTriangles:7068,instanceRoots:8,instanceMeshes:22,instanceTriangles:7372,body:{movingSlab:1,fixedFrame:9},cameraMeshes:18,cost:after.shots.map((s,i)=>({id:s.id,beforeCalls:before.shots[i].calls,afterCalls:s.calls,beforeTriangles:before.shots[i].triangles,afterTriangles:s.triangles})),hashes:Object.fromEntries(files.map(f=>[f,hash(f)])),priorCourtPreserved:true,limits:['Goal renders use neutral studio lighting; game keeps pink time-temple environment','Fixed-camera prepared scenes are not movement proof; check.json contains input traversal evidence','Touch final carrying position and preceding extra placements are prepared; real final tap and passage movement verified','Render counters are not FPS or GPU memory measurements','No school hardware or student play session; no new public deployment','Other rooms, surrounding first-room architecture and the whole objective remain unfinished']};
fs.writeFileSync(B+'/verification-index.json',JSON.stringify(result,null,2));console.log(`PASS ${result.normalChecks} normal / ${result.faults} faults / ${result.buildFiles} build hashes / 21 gallery images`);
fs.writeFileSync('reports/2026-10-24/CHRONICLE_PORTAL.md',`# 지층의 문 — 실제 상승과 통과

시간 신전 첫 방에서 정답을 맞혀도 돌판이 남아 인물이 통과하던 문제를 고쳤다. 화석 네 개와 슬롯을 실은 석문이 올라가고, 두 추는 내려가며 줄 길이가 함께 변한다. 기존 지층 순서·오답 회수·저장 형식을 유지했다.

## 근거와 설계

- 소스/이전 실제 화면에서 확인: 네 지층판이 보이는 채로 뒤 통로만 열렸고, 판 자체에는 몸 충돌이 없었다.
- 우리 설계 선택: 1.35초 동안 3.45m 상승, 바닥부터 2.70m가 비면 통과 허용. 원작의 내부 수치나 실행 측정값이 아니다.
- 제작: [설계](../../art/chronicle-portal/v01/DESIGN.md) · [도면](../../art/chronicle-portal/v01/blueprint.svg) · [21장 비교](../../art/chronicle-portal/v01/review.html).
- 정면·측면·후면 × 닫힘·열림 6카메라를 목표와 실제에 일치시켰다. 목표는 Blender 장치 전용 중립 조명, 실제는 게임 전체의 분홍빛 환경이다. 최초 측면 시안의 기둥 잘림을 수정했고 최초 시안도 보존했다.

## 실제 연결

Blender 편집 원본과 GLB를 보존했다. 139개 편집 조각 → 원형 16메시/7,068삼각형, GLB 1,379,320바이트다. GLB 재질 8개, 이미지 2개, 텍스처 참조 14개이며 게임 인스턴스는 8루트·22메시·22재질·16공유 기하·7,372삼각형으로 직접 측정했다.

문짝 밑면0/높이4.96m, 지지 틀 밑면0/높이8.95m다. 동적 문 충돌 1개, 고정 틀 충돌9개, 실제 카메라 조회 메시18개를 연결했다. 기존 짧은 벽 틀의 몸·카메라 표면을 제거하고 코어 받침은 유지했다. 이전 전당 GLB/Blender 해시는 그대로다.

완료 저장은 즉시 열린 모습으로 복원한다. 이전 미완료 저장의 위치가 새 석문과 겹치면 앞쪽 안전 위치로 보정하고 화석 배치·운반 상태는 보존한다. 새 모델 다운로드 실패 시 기존 네 돌판과 밑면 보강으로 열림/통과를 유지한다. 이 경우 새 풀리·추 표현은 없다. 성공 슬롯은 과한 노란 면 대신 청동색으로 낮췄다.

## 검증

정상 **${result.normalChecks}판정**, 지정 고장 **2종**, **${result.buildFiles}실행 파일**의 원본/빌드 해시가 통과했다. [검증 인덱스](evidence/chronicle-portal/verification-index.json)

| 검사 | 판정 | 범위 |
|---|---:|---|
| 문/실제 입력 | 13 | 닫힌 문 달리기·점프, 네 화석 운반, 상승 중 몸/화석/추/줄, 앞뒤 통과·착지, 고정 기둥, 저장·재시작·구형 위치 |
| 다운로드 실패 | 12 | 실제 GLB 요청 차단, 기존 돌판 표시·동작·통과·저장 |
| 화석 장치 회귀 | 12 | 형태 대응·접지·받침/코어 충돌·운반·오답 회수·구형 상태 |
| 터치 | 8 | 실제 조이스틱 접근·집기·꽂기, 두 화면 HUD, 마지막 탭·개방 통과 |
| 시간 신전→엔딩 | 14 | 실제 운반·낙석 통과·표식 조작·헌납·귀환·소포 |
| 여섯 방 저장 | 7 | 운반 상태·재실행·비활성 방·물/불 컨트롤러 전환·개인 기록 분리 |

개인 브라우저 저장 대신 격리된 브라우저를 사용했다. 앞선 다섯 신전과 소포 보유 상태는 준비했다. 첫 방 PC 이동·운반·점프는 실제 게임 입력이며, 터치 마지막 검사는 앞선 추가 배치와 마지막 운반 위치를 준비하고 최종 탭·이동을 실제 터치로 수행했다. 전체 모바일 완주로 주장하지 않는다.

충돌 높이를 없애면 닫힌 문에 파고드는 고장을 잡고, 메시 상승만 멈추면 몸과 화면 불일치를 잡았다. 초기 구형 저장 검사는 서로 다른 seed를 비교해 거절됐으며 같은 seed로 바로잡았다. 초기 터치 검사는 통과 후 대상 없는 복도에서 액션 버튼을 기대하는 오류가 있어 원래 첫 방 HUD 검사 후 통과 검사를 수행하도록 고쳤다. 두 초기 결과를 보존했다.

기본 소스193모듈/538로컬 import/19벤더 해시, 저장 왕복·손상/백업, 음향 검사도 통과했다. 비교 갤러리21이미지를 PC1280/모바일390 너비에서 확인했다. 렌더 호출·삼각형 전후는 인덱스와 갤러리에 기록하며 FPS·GPU 메모리 측정값으로 해석하지 않는다.

## 남은 차이

중립 시안과 실제 분홍빛 환경의 재질 대비가 다르다. 가까운 기본 카메라에서는 높은 틀 전체가 잘리고 통과 틈 위주로 읽힌다. 주변 바닥·방 건축, 낙석 갱도/표식 장치는 다음 개선 대상이다. 학교 실기기 성능, 학생 첫 플레이 재미, 앱 전체 시각적 격차와 신규 공개 배포는 미완료다. 교실 함께하기 코드는 변경하지 않았고 이번 단계에서 새 3기기 검사는 수행하지 않았다.
`);
