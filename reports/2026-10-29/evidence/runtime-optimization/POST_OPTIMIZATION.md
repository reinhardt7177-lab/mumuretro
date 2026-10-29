# 그레이드·출력 패스 병합 후보 검증

2026-10-29: **후보 정상 21조건 통과, 지정 contrast 고장 실제 픽셀 게이트 실패.** 검사 실행 시에는 제품 `src/render/Post.js`를 수정하지 않았다. 이후 Root 담당이 검증한 후보 bytes 그대로 제품에 설치했고 별도 성능 비교를 진행 중이다. 아래 결과는 설치 전 동일 페이지 후보 비교의 근거다.

## 변경

- [후보](candidate/Post.js)는 고정 Three.js r160 `OutputPass`를 상속한 `GradedOutputPass`에 기존 채도·대비·비네트 연산을 넣는다. 기존 `ShaderPass(GradeShader)`와 `OutputPass`의 두 전체화면 제출을 하나로 합친다.
- `OutputPass`의 `RawShaderMaterial`, 기존 톤매핑/색공간 청크, 노출/define 갱신, 출력 타깃 선택을 그대로 사용한다. vendor·화질·MSAA·블룸·원래 씬은 바꾸지 않는다. `grade.uniforms`, `saturation`, `bloomStrength` API를 유지한다.
- 이전 ShaderMaterial 통합의 재정의/미검증 실패 주석은 후보에 인용했고 [제품 원본 전체](before/src/render/Post.js)를 보존했다. 그 실패를 이번 방식의 성공 근거로 삼지 않는다.

## 실제 검사

[독립 도구](../../../../tools/check-post-optimization.cjs)는 fresh Headless Edge 156.0.4314.50 context 한 개를 사용한다. 기존 `arrival-performance-fixture.cjs.prepare(...,'after','mid','front',cameras)`로 현재 Root를 준비하고 루프를 멈춘다. 개인 사용자 프로필/실제 저장을 사용하지 않는다.

같은 페이지·같은 정지 씬·같은 카메라에서 legacy → candidate → candidate → legacy를 번갈아 렌더한다. 매번 브라우저 이벤트 루프로 돌아가기 전에 실제 기본 프레임버퍼의 `gl.readPixels` RGBA를 읽는다. 다른 검사/벤치와 병렬 실행하지 않았고 각 브라우저는 종료했다.

- 1280×800·DPR1, `mid/high/low/min` × `front/side/rear`: 12조건.
- 추가 390×844 세로·844×390 짧은 가로: 2조건.
- 같은 행성 씬에 `ship/balance/shadow/sift/water/fire/strata` look profile을 적용: 7조건. **실제 신전 진입이나 각 신전 전체 화면 검증이 아니다.**
- [정상 보고서](post-normal-2026-10-29T04-23-52-520Z/report.json): 21/21 통과. 모든 조건의 최대 채널 차이 1/255, 각 구현의 반복 차이 0, 배우/카메라/진행 snapshot 변화 0, page/console 오류 0.
- 모든 조건에서 draw 정확히 1회·전체화면 삼각형 1면 감소. mid 정면 453→452, 측면 463→462, 후면 728→727. min 정면 229→228.
- 두 composer 타깃 크기는 실제 캔버스와 일치한다. high MSAA 4, 나머지 0이 동일하다. 블룸 타깃 크기/활성 여부·프로필 uniform도 동일하다. shader link 실패나 톤매핑/색공간 재정의 오류는 관찰되지 않았다.
- [별도 지정 고장 보고서](post-fault-2026-10-29T04-24-36-114Z/report.json): 후보 contrast를 .2로 설정했을 때 첫 실제 픽셀 비교 최대 118/255, `pixel max exceeds 1/255`에서 실패하고 exit 1·`faultDetected:true`를 기록했다. draw/버퍼/GL 오류 조건은 그대로였다. 이 실패 출력을 정상 결과로 덮지 않았다.

서버의 `.mjs` MIME 설정이 없어 [legacy](browser-modules/legacy.mjs)·[candidate](browser-modules/candidate.mjs) 브라우저 사본만 동일 localhost URL에 보존 bytes 그대로 `text/javascript`로 라우팅했다. 상대 import는 원래 `/src/render/Post.js` 기준 절대 URL로 바꾸고 bare `three` import는 게임 importmap을 사용한다. Root 게임·자산 요청은 원래 서버 경로를 사용했다.

## 보존·한계

- 제품 Post 원본 SHA-256: `da8ebd3434ebe4960d0653844300df867f915e968bf6d845ecf48805be7215c1`.
- 검사한 후보 SHA-256: `f0ee3edbbd4cec8ee8c3c1617cf5e5a9f976dcbbdd1d7368046e08b7fdaf4198`.
- 후보 검사 전후 제품 Post·현재 Engine/Quality/LookProfiles/lighting와 지정 vendor 파일의 SHA를 대조했다. 이 담당은 후보를 보고서 폴더에만 썼고 제품 설치는 Root 담당이 뒤이어 수행했다.
- CPU `submitMs`는 캡처 부수 관찰이며 예열/교대 성능 벤치마크가 아니다. FPS·GPU 실행시간·학생 실기기·전체 게임 향상을 입증하지 않는다. 실제 씬 입력/퍼즐/저장 회귀는 Root 채택 뒤 별도 범위다.
- 허용된 최대 1/255 차이로 통과했으며 픽셀 완전 동일이라고 보고하지 않는다. 정상/고장 원시 결과와 브라우저 사본은 그대로 보존한다.
- 도구는 검사 시작 시 Root Post가 보존한 legacy와 같은지 확인한다. 설치 뒤 원본 보존 경로를 바꿔서 기존 근거를 덮거나 무조건 재실행하지 않는다. 후속 제품 성능·회귀는 Root 담당의 별도 출력 경로를 사용한다.
