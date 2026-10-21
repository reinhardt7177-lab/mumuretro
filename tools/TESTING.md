# 무무 행성 검사 도구

퀘스트 안내: 로컬 서버 5512에서 `node tools/check-quest-guide.cjs`를 실행한다. PC·모바일 목표 전환과 토글, 저장 상태 불변, 오버레이, 닫힌 문·장애물 경로와 잠긴 사당 제외를 확인한다.

프로젝트 루트에서 실행한다. 브라우저 검사는 Playwright와 Edge가 있는 환경을 기준으로 한다. 다른 설치 경로를 사용할 때는 `AUDIT_NODE_MODULES`에 Playwright가 들어 있는 `node_modules` 경로를 지정한다. 기본 패키지 경로에 설치돼 있으면 이 환경변수는 필요 없다.

## 브라우저 없이 확인

```powershell
node --experimental-vm-modules tools/check-source.cjs
node tools/check-save.mjs
node tools/check-audio.cjs
node --experimental-vm-modules tools/check-state.cjs
```

| 도구 | 확인하는 것 |
|---|---|
| `check-source.cjs` | 소스 문법, 상대 import, 로컬 Three 모듈, 라이브러리 해시, 음악 파일 |
| `check-save.mjs` | 저장 왕복, 버전·입력 검사, 저장 차단, 백업·용량 실패 시 원본 보존 |
| `check-audio.cjs` | 모의 Audio/RAF로 음소거·음악 전환·설정 보존·음원 매핑 |
| `check-state.cjs` | 실제 THREE와 상태 모듈로 장치·채집·덫·요리·지도 복원. Canvas 호출은 계측용 대체 구현 사용 |

지도 복원 검사가 실제 실패를 잡는지 확인하는 명령은 다음과 같다. **이 명령만 exit 1이 정상이다.** 앱 파일을 바꾸지 않고 테스트 VM 안의 지도 그리기를 제거한다.

```powershell
node --experimental-vm-modules tools/check-state.cjs --break-map-restore
```

## 실제 브라우저 통합

### 앱 전체 마감 · 2026-10-21 최신

기존 소스·사용자 브라우저의 실제 기록을 수정하지 않는 격리 Edge 검사를 사용한다. 5512 제작 서버와 `AUDIT_NODE_MODULES`를 준비한다.

```powershell
node tools/check-notebook-pages.cjs
node tools/notebook-check.cjs
node tools/check-strata-journey.cjs
node tools/check-chronicle-art.cjs
node tools/check-app-progress.cjs
node tools/check-endflow.cjs
node tools/check-github-integration.cjs
node tools/check-quest-guide.cjs
```

수첩 페이지 19개는 360px·가로 화면·터치·글자 크기·모든 기록 접근·숨긴 새 기록·상태 보존을 검사한다. 지층 완주 14개는 오프닝과 앞선 다섯 구슬만 준비한 뒤 코어·낙석·문·헌납·각성·마지막 구슬·범선 귀환·소포 엔딩을 실제 입력으로 진행한다. 수호자 7개는 실제 GLB 바닥·높이·고정 문양·봉인의 의미·인출/복원·버전 1 시각 저장·144개 카메라와 기본 프레이밍을 확인한다. 여섯 방 동시 저장 7개는 들고 있는 물체와 모든 비활성 방·별도 컨트롤러가 재접속/전환 후 유지되는지 확인한다.

`check-notebook-pages.cjs --break-next`, `check-strata-journey.cjs --break-core-tip`, `check-chronicle-art.cjs --break-seals`는 각각 버튼·드릴 끝·봉인 ID를 검사 환경에서만 고장 낸다. **각 명령은 고장을 검출해 exit 1이어야 한다.** 정상 결과와 실패 주입 결과는 `reports/2026-10-21/evidence/app-completion/`에 따로 기록한다. A~X의 F는 직선형 네 사당만 검사하며 물·불의 완주는 아래 현재 전용 도구로 증명한다.

교실 서버는 `교실서버.cmd` 또는 `node server/app.cjs 5514 --share`로 실행한다. `check-classroom-server.cjs`, `check-coop.cjs`, `check-coop-balance.cjs`, `check-coop-balance-http.cjs`는 별도 임시 포트에서 정원·소유권·서버 판정·토큰 비공개·파일 제공 범위를 확인한다. `AUDIT_URL=http://교사PC주소:5514`를 지정하고 `check-coop-room-browser.cjs`를 실행하면 독립 브라우저 3개로 공동 상태·모든 문·수호자까지 실제 보행·원래 범선 복귀·개인 저장과 대화 격리를 검사한다. 세 대의 실제 학생 기기 성능·학교 와이파이 연결 시험과 구분한다.

`capture-app-review.cjs`는 1280×800 중간 화질로 실제 여덟 장면과 렌더 수치를 기록하고 `art/app-completion/review.html`을 만든다. 위치를 준비하는 검수 캡처이며 퍼즐 완주 검사로 세지 않는다. 이전의 `check-water-court.cjs`와 `check-shrine-progress.cjs`는 개편 전 퍼즐 형식의 역사적 회귀 도구다. 현재 물은 `check-water-adventure.cjs`, 불은 `check-fire-adventure.cjs`, 현재 전체 저장은 `check-app-progress.cjs`를 우선한다.

### 불의 신전 전체 · 2026-10-21

로컬 서버 5512와 `AUDIT_NODE_MODULES`를 준비한 뒤 아래 순서로 실행한다. 본편 검사가 실제 이동으로 얻은 전당 체크포인트를 만들며, 마지막 검사는 이 자료로 시제품의 대화 복원만 검사한다.

```powershell
node tools/check-fire-fracture.cjs
node tools/check-fire-foundry.cjs
node tools/check-fire-steam.cjs
node tools/check-fire-adventure.cjs
node tools/check-fire-migration.cjs
node tools/check-fire-sanctum.cjs
node tools/check-fire-adventure.cjs --break-reward
```

마지막 명령은 검사 브라우저에서 보상 커밋만 끊는다. **자동 퇴장·보상 검사에서 exit 1이 정상**이다. 그 외 여섯 도구는 33+33+37+27+21+12=163개를 검사한다. 실제 학생 재미·실기기 성능 검사와 구분한다. 새 코드의 결과는 `reports/2026-10-21/evidence/fire-adventure/`와 기존 각 방 evidence에 남는다.

본편은 `mumuplanet.progress.v1` 안의 불의 신전 v3 기록, 시제품은 별도 `mumuplanet.fire-trial.v3`을 사용한다. 실제 사용자 프로필을 테스트 자료로 사용하지 않는다. 기존 원문과 다른 신전 진행 보존도 검사한다. [완성 범위·측정·공통 검사 실패](../reports/2026-10-21/FIRE_ADVENTURE_COMPLETE.md)를 함께 읽는다.

### 팔찌·광선 · 2026-10-03

```powershell
node tools/check-water-bracelet-fx.cjs
node tools/check-water-bracelet-fx.cjs --break-wrist
node tools/capture-water-bracelet-model.cjs
```

첫 명령은 격리된 Edge에서 실제 이동·E 획득·Q/R 시전, 손목 밀착, 광선 시작·끝, 프레임별 밝기, 팔 복귀, 저장 불변, 회수·오버레이·퇴장, 저화질·동작 줄이기를 검사한다. 두 번째 명령은 검사 브라우저에서 팔찌를 본에서 떼고 0.5m 이동하므로 **exit 1이 정상**이다. 사용자 저장은 건드리지 않는다. 세 번째 명령은 실제 웹 모델 확대 캡처와 Blender 보존용 JSON을 만든다.

근거는 `reports/2026-10-03/evidence/water-bracelet/`에 저장한다. 확대 화면은 `/art/water-bracelet-web/preview.html`이다. 모바일 캡처는 화면 크기 검사이며 실제 태블릿의 GPU 성능 검증이 아니다.

### 현재 물 신전 · 2026-10-02 개편

5512 로컬 서버를 켜고 공통 `AUDIT_NODE_MODULES` 경로를 지정해 실행한다.

```powershell
node tools/check-water-adventure.cjs
node tools/check-water-adventure-safety.cjs
```

첫 검사는 입장만 준비하고 실제 이동·운반·점프·승강·변환으로 세 방과 신의 자동 퇴장을 확인한다. 해법 방향은 자동 조향하므로 학생 재미 검사와 구분한다. 두 번째는 구형 v1/v2 기록 10가지, 실제 운반 중 새로고침, 잘못된 저장의 원자적 거부, 키보드 반복, 모바일 버튼·수첩 정지·물 회수·요청 힌트·세 화면 크기를 확인한다. 결과와 게임 캡처는 `reports/2026-10-02/evidence/water-adventure/`에 저장한다.

첫 목표 단의 충돌 높이를 0.7u 높이는 고장 주입은 다음과 같다. **이 명령은 exit 1이 정상이다.** 파일과 개인 저장은 바꾸지 않으며, 보행이 막히는 오류가 `failure-injection.json`에 남아야 한다.

```powershell
node tools/check-water-adventure.cjs --break-first-step
```

아래의 `check-water-court.cjs` 설명은 구형 물 신전 검증의 보관 기록이다. 현재 물 신전에는 집수판·온도 손잡이·세 밸브가 없으므로 현재 완주를 검증할 때 사용하지 않는다.

### 공통 웹 기능과 과거 구간 검사

아래 도구들은 로컬 서버와 격리된 브라우저를 직접 열고 끝나면 닫는다. 개인 브라우저의 저장 기록은 사용하지 않는다.

```powershell
node tools/quality-check.cjs
node tools/check-endflow.cjs
node tools/check-traversal.cjs
node tools/check-waterway.cjs
```

`quality-check.cjs`는 외부 호스트를 전부 막고 시작·실제 소포까지 걷기·수첩·음향·정지·복구·엔딩을 확인한다. 엔딩과 사당 완료 상태는 별도로 준비하므로 일반 플레이 완주 검사와 구분한다. `check-endflow.cjs`는 엔딩 복원, 저장 차단·손상·백업 실패, 중단 대사를 다룬다.

`check-traversal.cjs`는 구면 보행, 공중 고도, 활공·착지·점프 버퍼·포즈·카메라를 검사하며 고도 보존 실패 주입을 포함한다. `check-waterway.cjs`는 두 단독 해법, 반사광 교차, 0°C 융해, 중간 저장, 장치 반환, 출구 충돌을 검사하며 융해 온도 실패 주입을 포함한다.

수첩의 화면 크기·빈/가득 찬 기록·폰트 차단·키보드·터치 검사는 실행 중인 정적 서버를 사용한다.

```powershell
node tools/serve-local.cjs 5500
```

다른 터미널에서:

```powershell
$env:AUDIT_URL = 'http://127.0.0.1:5500/'
node tools/notebook-check.cjs
node tools/check-waterway-browser.cjs
node tools/check-water-court.cjs
node tools/check-shrine-progress.cjs
node tools/check-mirror-gallery.cjs
node tools/check-shade-court.cjs
node tools/check-silhouette-court.cjs
node tools/check-shadow-sanctum.cjs
node tools/check-sieve-court.cjs
node tools/check-sort-court.cjs
node tools/check-evaporation-court.cjs
node tools/check-sift-sanctum.cjs
$env:EXPEDITION_URL = $env:AUDIT_URL
node tools/check-expedition.cjs
```

수첩 검사는 내장 M과 동일하게 개별 편지의 내부 스크롤을 높이 660px 미만에서 허용한다. 전체 종이와 다른 면은 해당 크기 기준으로 검사한다. 검사 결과는 `tmp/`에 생성된다. 최종 제출 당시의 결과와 화면은 [개선 보고서의 근거 폴더](../reports/2026-09-08/evidence/rebirth/)에 보존한다.

`check-expedition.cjs`는 연구실 완료 상태만 준비한 뒤, 내림판에서 능선·들길을 실제 입력으로 걷는다. 활공막 획득·활공·착지, 공중/가열 중 수첩 정지, 이어하기와 보행 고장 검출을 확인한다. 경로의 목표 방향은 자동 조향하므로 일반 사용자의 탐험 시간·길 찾기 이해도 측정과 구분한다.

`check-water-court.cjs`는 연구실 완료와 물 사당 입장만 준비한 뒤, 입구에서 실제 이동 입력으로 얼리기·미끄럼·좌우 회랑·다리·온도 퍼즐을 거쳐 구슬과 귀환 장치까지 진행한다. 3u 고도, 옆면 진입 차단, 위아래 상호작용, 재접속·재입장·옛 저장·손상 백업, 모바일 E·수첩을 검사한다. 높은 난이도에서 오른쪽 회랑부터도 진행한다. 이동 고도와 밸브 복원을 일부러 제거한 실행이 정상 검증 조건을 만족하지 못함을 확인한다. 내장 A~W의 실행과 검사 후 물 사당 상태 보존도 포함한다.

카메라의 반복 배치 메시 검사는 조각별 경계를 사용한다. 조각 사이 빈 공간과 실제 물체를 구별하고, 물체를 빈 곳으로 옮기면 점유를 검출하는지 함께 확인한다. 결과와 실제 캡처는 `tmp/water-court/`에 나온다. 게임 시뮬레이션을 빠르게 진행하므로 캡처 전에 시작 화면과 전환 섬광의 실제 애니메이션 종료를 기다린다.

`check-waterway-browser.cjs`는 퍼즐 앞 위치를 준비하고 장치 사이를 실제 입력으로 이동한다. 온열기와 거울 각각의 단독 해결, 중간/완료 저장, 이전 저장 호환, 물 사당 입출구, 터치 E 및 점프 홀드를 확인한다. 터치 검사는 Edge의 모바일 에뮬레이션이다. 새 기능 증거는 [대표 구간 근거 폴더](../reports/2026-09-08/evidence/expedition/)에 보존한다.

내장 전체 검사는 격리된 게임 화면의 개발자 콘솔에서 `game.loop.stop(); __selftest()`로 실행할 수 있다. `true`와 `ALL PASS`뿐 아니라 A~W 모든 그룹이 실행됐는지 확인한다. 검사 중에는 진행 기록 저장을 차단한다.

`check-shrine-progress.cjs`는 물 이외 다섯 사당의 저장을 검사한다. 첫 관문까지 실제 이동 입력으로 걷고, 추·체·화석을 들고 브라우저를 새로 연 뒤 장치까지 걸어서 놓는다. 후반 라운드·신전은 접근 상태를 준비한 뒤 장치의 실제 상호작용 메서드로 풀며, 단계마다 같은 씨앗의 새 방을 만들어 복원한다. 전체 사당을 일반 조작만으로 완주했다는 뜻은 아니다. 게임 시간은 수동 `step`과 자동 조향으로 제어한다.

이 검사는 중간 체질·물통 검사·기울어진 저울·낙석·용암 발판, 다섯 종류의 신전과 구슬, 손상 백업, 옛 완료 기록, 다섯 사당 동시 저장, 힌트·난이도·비활성 사당의 시간 정지도 다룬다. 복원 코드에서 손에 든 물건의 복원을 제거한 브라우저가 정상 조건을 만족하지 못하는지 확인한다. 내장 A~W가 진행 중인 사당들과 저장소를 바꾸지 않는지도 검사한다. 결과는 `tmp/shrine-progress/`, 제출 근거는 `reports/2026-09-08/evidence/shrine-progress/`다.

`check-mirror-gallery.cjs`는 개편 전에 실제 브라우저에서 저장한 `evidence/mirror-gallery/legacy-save.json`을 읽는다. 기존 각도·힌트·완료한 첫 관문을 복원한 뒤 새 형식으로 재저장하고 다시 연다. 연결 다리에서 거울방까지 실제 이동 입력으로 걸어 세 거울을 E로 돌리고 열린 문을 통과한다. 앞의 그림자 밟기 관문 완료와 출발 위치만 검사 준비용으로 설정한다. 전체 그림자 사당을 보행으로 완주하는 검사는 아니다.

8개 씨앗의 512가지 각도 조합, 세 번 반사의 필요성, 입사·반사각과 광선 연결, 실제 렌더 끝점, 잘못된 완료 값의 원자적 거부, 합법적인 보행 위치에서 144개 카메라 방향을 검사한다. 광선 경계 처리를 제거하거나 가까운 벽 앞 카메라 최소 거리를 옛 값으로 되돌린 실행이 각각 고장을 검출하는지도 확인한다. PC 수첩과 Edge 모바일 에뮬레이션의 터치 E·수첩을 포함한다. 전체 렌더 패스를 합산한 호출 수와 캡처는 `tmp/mirror-gallery/`에 나온다. 게임 시간만 수동 진행하며 전환 섬광과 브라우저 UI 프레임은 정상 종료시킨다.

`capture-mirror-baseline.cjs`는 개편 전 근거를 보존하기 위한 도구다. 기존 저장 파일이 있거나 이미 거울 회랑이 적용된 소스에서는 실행을 거부한다. 보존된 원본 `before.json`의 `calls:1`은 마지막 후처리 패스만 센 초기 측정 오류이므로 성능 비교에 쓰지 않는다.

`check-shade-court.cjs`는 개편 전 실제 저장을 읽어 등불의 회전 위치·노출량·힌트·안전한 재개 위치를 확인한다. 바닥 위 실제 삼각형을 내려다보는 광선과, 등불에서 바닥으로 향하는 광선의 기둥 충돌을 각각 검사한다. 두 결과를 안전 판정과 비교하며 다섯 위상의 9,590개 지점을 조사한다. 표시 메시만 1u 옮긴 브라우저가 불일치를 검출하는지도 확인한다.

보행은 기본 사당 입구에서 시작한다. 각 실행의 초기 난이도·등불 위상만 설정한 뒤, 등불이 실제로 움직이는 동안 보통 이동 속도 3.6u/s로 걷는다. 검사 전용 `shade-walk-planner.js`가 시간에 따른 그늘과 노출 여유를 고려해 자동 조향하며, 게임에는 경로나 정답 표시를 추가하지 않는다. 세 실행의 완주 시간은 사용자 플레이 시간이나 학습 효과가 아니다. 노출 경고·실패 복귀, 중간 저장, 완료 후 왕복, 기둥 충돌, 144개 카메라 방향, 모바일 수첩의 시간 정지도 검사한다. 결과는 `tmp/shade-court/`다.

`capture-shade-baseline.cjs`는 원본 화면·불일치 표본·이전 저장을 보존하는 도구다. 기존 근거를 덮어쓰지 않으며, 개편 후 소스로 원본을 다시 만들 수 없게 검사한다. 제출 근거는 `reports/2026-09-08/evidence/shade-court/`에 보존한다.

`check-silhouette-court.cjs`는 개편 전 저장에서 물체 거리·문제 순서·라운드·힌트·잡은 상태를 이관한다. 실제 판 꼭짓점을 투영해 크기 법칙과 비교하고, 화면 위 18,605개 지점에서 불투명 받침대 부품 전체의 광선 충돌과 표시 그림자를 독립적으로 비교한다. 화면 밖으로 커진 그림자의 잘림, 투영면과 문틀의 간격, 자동 정답 방지, 잘못된 목표 값의 원자적 거부도 확인한다.

앞의 두 관문 완료와 연결 다리 출발만 준비한 뒤, 난이도 0·3·5에서 이동 입력으로 걸어 손잡이를 잡고 세 번의 크기를 맞춰 출구를 지난다. 검사 도구는 정답 거리를 알고 조향한다. 잡기 간격의 저장·재접속, 손잡이에서 벗어났을 때 놓기, 실제 부품 충돌, 카메라 144시점과 앞 회랑 등불 32위상, 터치 잡기·놓기·수첩 정지를 포함한다. 세로·가로·PC 크기에서 긴 안내와 알림이 겹치지 않는지 조사하며 그림자 폭을 30% 줄이거나 예전 고정 알림 위치를 적용했을 때 고장이 검출되어야 한다. 출력은 `tmp/silhouette-court/`, 제출 근거는 `reports/2026-09-08/evidence/silhouette-court/`에 둔다.

`capture-silhouette-baseline.cjs`는 개편 전 실제 저장·화면·큐브의 투영 오차를 보존한 도구다. 이미 근거 파일이 있거나 개편이 적용된 소스에서는 실행을 거부한다.

`check-shadow-sanctum.cjs`는 개편 전 실제 신전의 중간 저장과 각성·구슬 낙하 중 저장을 읽는다. 방향 8개×높이 3개의 55,296개 바닥 표본에서 실제 수호상 부품의 광선 충돌, 표시 삼각형과 투영 계산을 비교한다. 24개 그림자의 구별, 높이를 올렸을 때 길이 감소, 목표의 외곽선, 바퀴 표시와 높이 가로대의 위치, PC 기본 입구 시점의 등불 가시성도 확인한다. 별도 브라우저에 표시 그림자만 0.8u 옮기는 오류를 주입해 검출해야 한다.

앞의 세 관문 완료와 연결 다리 출발만 준비한 뒤 난이도 0·3·5에서 실제 이동 입력으로 양쪽 손잡이까지 걷고 E로 조작한다. 방향·높이를 함께 맞춰야 풀리고, 깨어나는 수호상과 내려오는 구슬을 이어서 복원하며, 한 번 얻은 구슬은 중복 지급하지 않아야 한다. 완료 여부만 있는 옛 기록도 다룬다. 검사 도구가 정답을 알고 자동 조향하므로 전체 사당의 사용자 완주 검사와 구분한다. 수호상 충돌, 144개 카메라 시점, 모바일의 두 손잡이 터치와 각성·보상 중 수첩 정지도 포함한다. 결과는 `tmp/shadow-sanctum/`, 제출 근거는 `reports/2026-09-08/evidence/shadow-sanctum/`에 둔다.

`capture-shadow-sanctum-baseline.cjs`는 개편 전 실제 저장 두 개·화면·광학 불일치를 보존한다. 옛 불일치 표본은 원기둥 받침대와 몸통만 대상으로 하므로 옛 석상 전체의 오차율로 쓰지 않는다. 이미 근거가 있거나 개편된 소스에서는 다시 실행하지 못하게 막는다. 새 신전은 메시 구조 대신 의미를 기록하는 버전 2 형식이므로, `check-shrine-progress.cjs`의 손상 검사는 해당 형식에서 높이를 범위 밖으로 바꾸어 원자적 거부를 확인한다.

`check-sieve-court.cjs`는 개편 전 끼운 체·나뉜 재료 저장과, 아래 재료를 다시 올린 뒤 체를 들고 있는 저장을 읽는다. 체 살의 실제 행렬에서 간격을 재고 알갱이 메시의 경계 크기와 비교한다. 광선으로 구멍과 살을 구분하며, 21가지 재료·체 중간 상태의 위·아래 소속과 표시를 검사한다. 구멍만 절반으로 줄인 별도 브라우저에서 분리 기준과의 모순을 검출해야 한다.

입구부터 실제 이동 입력으로 세 주문·두 단계 재체질을 끝내고 문을 지난다. 검사 도구가 정답을 알고 조향한다. 새 저장 재접속, 복원된 체 사용, 찬 작업대 앞과 다른 곳에서 체 돌려놓기, 중복 소유 거부, 작업대·접시 충돌, 144개 카메라 시점, 모바일 E와 수첩 정지를 포함한다. 결과는 `tmp/sieve-court/`, 제출 근거는 `reports/2026-09-08/evidence/sieve-court/`에 보관한다. `check-shrine-progress.cjs`도 새 충돌에 맞게 선반·작업대의 중심 대신 실제 조작 지점으로 걸어간다.

`capture-sieve-baseline.cjs`는 기존 화면과 두 저장 기록을 보존한다. 이미 기록이 있거나 새 작업장이 적용된 소스에서는 실행을 거부한다. 실제 게임 서버가 실행 중이어야 한다.

## 성질로 나누기 작업장

`check-sort-court.cjs`는 공통 AUDIT_NODE_MODULES와 로컬 서버 설정을 사용한다. 개편 전 물속 검사 40% 진행 저장과 손·수조가 함께 점유된 저장을 새 모델로 이관한다. 여섯 부력 결과, 동일 형상·재질, 자석 반응, 중복 소유 거부, 반환, 새 저장 재접속을 검사한다. 가라앉는 방향을 뒤집은 별도 브라우저에서는 오류가 검출되어야 한다.

실제 보행 입력으로 시료 18회 관찰, 오분류 회수, 세 기준 해결과 문 통과를 수행한다. 검사 도구가 정답을 알고 조향한다. 144개 카메라 시점과 모바일 수첩 정지·E 꺼내기를 포함한다. 수첩 닫기 뒤 입력 보호 프레임과 다음 정상 프레임을 모두 진행한다. 출력은 `tmp/sort-court/`, 제출 근거는 `reports/2026-09-08/evidence/sort-court/`다. `capture-sort-baseline.cjs`는 개편 전 소스용이며 기존 증거를 덮어쓰지 않는다.

## 거름과 증발 작업장

`check-evaporation-court.cjs`는 공통 AUDIT_NODE_MODULES와 로컬 서버 설정을 사용한다. 개편 전 거른 물통을 내려놓은 저장과 들고 있는 저장을 이관한다. 다섯 혼합물 상태의 성분 표시와 모래·종이 면의 간격, 새 저장 재접속, 불가능한 소금 소유 거부를 확인한다. 소금 결정을 일부러 숨긴 별도 브라우저에서 표시 오류를 잡아야 한다.

실제 이동 입력으로 잘못 가열하기, 물로 초기화, 잘못된 거름 단계에서 반환, 다시 들기, 세 단계 완료와 문 통과를 수행한다. 자동 검사는 정답 순서를 알고 조향한다. 144개 카메라 시점, 모바일 수첩 정지와 E 가열을 포함한다. 출력은 `tmp/evaporation-court/`, 제출 근거는 `reports/2026-09-09/evidence/evaporation-court/`다. `capture-evaporation-baseline.cjs`는 개편 전 소스용이며 기존 증거를 덮어쓰지 않는다.

## 마지막 분리 신전

`check-sift-sanctum.cjs`는 공통 AUDIT_NODE_MODULES와 로컬 서버 설정을 사용한다. 개편 전 완성한 그릇과 두 단계 중간 진행, 든 화로를 복원한다. 아홉 가지 그릇 상태와 분리 결과의 공간 간격, 도구 소유권 검증, 새 저장 재접속을 검사한다. 재료를 겹치게 만든 별도 브라우저에서는 오류를 검출해야 한다.

실제 보행으로 잘못된 순서·잘못된 도구·중간 회수·다섯 정상 적용·눈 각성·구슬 획득과 중복 획득 방지를 확인한다. 정답은 검사 도구가 알고 조향한다. 144개 카메라 시점, 모바일 수첩 정지와 E 조합을 포함한다. 출력은 `tmp/sift-sanctum/`, 제출 근거는 `reports/2026-09-09/evidence/sift-sanctum/`다. 기준 캡처 도구는 개편 전 소스에서만 실행하며 원본 저장을 덮어쓰지 않는다.

공통 G·H 카메라 검사는 무작위 장치 내부를 출발점으로 삼지 않는다. 각 구간의 같은 깊이에서 원·캡슐 충돌 반경 밖 보행 지점을 고르고, 없으면 실패로 기록한다. 후퇴 85%·고체 내부 금지 기준을 유지한다.

## 체질 동작 연출

`check-sieve-motion.cjs`는 5512 서버와 공통 AUDIT_NODE_MODULES를 사용한다. 세 체에서 모든 낙하 입자가 실제 망의 빈 곳을 통과하는지, 큰 입자가 남는지, 프레임 간격에 따라 결과가 달라지지 않는지 검사한다. 중간 저장·다음 조작·재시작·수첩 정지·동작 줄이기와 고장 주입도 포함한다. `capture-sieve-motion.cjs`는 실제 렌더링을 고정 시점 WebM 영상으로 기록한다. 결과 위치는 `reports/2026-09-09/evidence/sieve-motion/`다.

## 균형의 사당 v02

`check-balance-temple.cjs`는 실제 보행으로 다섯 상자 정렬, 두 판 2:2 배치, 지지대 이동과 지레 수평, 마지막 문 통과, 자동 대사·퇴장·밀봉을 검사한다. `check-balance-mobile.cjs`는 3·4개 풀이, 모든 지지점의 비어 있지 않은 해법, 잘못된 정답 거부, 모바일 E·재접속·이전 기록 변환을 확인한다. 공통 AUDIT_NODE_MODULES와 5512 서버를 사용한다. 출력은 `reports/2026-09-09/evidence/balance-temple/`이다.

## 우주 범선 검사 상세

`check-starsail.cjs`는 공통 AUDIT_NODE_MODULES와 5512 로컬 서버를 사용한다. 실제 보행으로 윈치 회수·수첩 획득·항로 설정·행성 진입을 검사한다. 귀환·기존 저장·잘못된 저장·회수 중 저장 복원·모바일 E와 수첩·A~X·선실과 빈 갑판의 고체 구별·화질별 렌더링을 포함한다. 결과와 실제 화면은 `reports/2026-09-09/evidence/starsail/`에 기록한다. `quality-check.cjs`의 시작 동선도 윈치 회수 후 작업대로 이동한다.

## GitHub 통합 검사 상세

`check-github-integration.cjs`는 공통 AUDIT_NODE_MODULES와 5512 로컬 서버를 사용한다. DPR 2에서 화질별 실제 캔버스·후처리 크기, 창 크기 변경, 자동 하향·수동 고정, 사당 조명, 설정 중 일시 정지, PC·폰·가로 화면·태블릿 버튼 겹침과 터치·키보드 조작을 검사한다. A~X 실행 전후 전체 저장 스냅샷과 화질도 같아야 한다. 렌더링 크기 갱신을 일부러 끊으면 오류를 검출해야 한다. 결과는 `reports/2026-09-09/evidence/github-integration/`에 기록한다.


## 엔진 이전 자산 검사

`node tools/check-heritage-assets.cjs`는 5512 서버와 공통 `AUDIT_NODE_MODULES`를 사용한다. 원본 보존 해시, GLB 해시, 50개 모델의 WebGL 로드·유효 정점·그리기, 최종 노멀맵을 확인한다. 게임에서는 신 모델·외관·물 신전 E 진입·수첩 넘김·18번 여닫기 후 메인 WebGL 유지·G 풀 토글·저장·낮은 화질의 풀 자동 숨김을 확인한다. 테스트 브라우저의 기록은 실제 사용자 기록과 분리된다.

결과는 `reports/2026-10-02/evidence/asset-transfer/report.json`에 저장한다. `pass: true`만 전체 통과다. 장면 확인용 화면은 준비한 위치에서 촬영하며 퍼즐을 모두 직접 푼 증거는 아니다. `--runtime-only`는 해시 확인 후 이전에 검증한 모델 렌더링 목록을 재사용해 게임 연결만 다시 검사한다.

## 화산 신전 · 균열 회랑 시제품

현재 세 방 저장은 `mumuplanet.fire-trial.v2`다. 기존 두 방 v1과 회랑 키는 이관 입력으로 보존한다. 아래 회랑 검사도 새 묶음 저장에서 운반 상태를 읽고, 모바일 복원은 이전 회랑 형식의 실제 이관을 거친다.

`node tools/check-fire-fracture.cjs`는 5512 서버와 공통 `AUDIT_NODE_MODULES`를 사용한다. `/fire-trial.html`을 격리된 Edge에서 실행한다. 본편 기록을 표식으로 만들어 변경되지 않는지 확인하며 사용자의 브라우저 기록에는 접근하지 않는다.

입구 → 중앙 홀 → 균열 회랑을 실제 `Input`·`RoomActor` 이동으로 통과한다. 빈 고정구·한쪽 고정 실패, 운반과 배치, 추락·재도전, 수첩 정지, 양쪽 고정 후 시험, 실제 다리 횡단·잠금·홀 복귀, 운반 중 및 완료 후 새로고침을 검사한다. 검사 도구는 해법을 알고 조향한다. 장치로 순간 이동하거나 완료 상태를 만들어 정상 완주를 대신하지 않는다.

카메라 36시점의 고체 내부 진입·시험대 시야, 390×844·844×390·1024×768 HUD, 터치 문맥 버튼·점프·이동·수첩, 잘못된 기록과 저장 용량 초과도 포함한다. 모바일 검사는 터치 가능한 브라우저 에뮬레이션이며 실제 학생 기기 성능·재미 검토가 아니다.

결과와 실제 렌더는 `reports/2026-10-20/evidence/fire-fracture/`에 기록한다. 정상 결과는 `report.json`의 `pass: true`와 33개 통과다. `--smoke`는 입구 이동·자산·카메라만 확인한다. `--break-bridge`는 테스트 브라우저의 다리 충돌 높이만 일부러 잘못 바꾼다. 이때 실제 횡단 중 추락을 검출해 종료 코드 1이 나와야 하며, `failure-injection.json`에 원인이 남는다. 코드·사용자 저장·모델은 바꾸지 않는다.

## 화산 신전 · 용암 주조실 연속 플레이

`node tools/check-fire-foundry.cjs`는 같은 5512 서버·`AUDIT_NODE_MODULES`·격리 Edge를 사용한다. 새 게임에서 오른쪽 문에 접근해 잠금을 확인하고, 실제 입력으로 회랑을 완주해 문을 연 뒤 주조실까지 연속 진행한다. 수로 회전, 잘못된 흐름·한쪽 연결, 부분 충전과 새로고침, 열린 공급의 냉각 방지, 뜨거운 틀의 복귀, 재가열, 실제 돌길 횡단·잠금·홀 복귀를 검사한다.

두 방 기록을 적용하기 전 전체 검증·원본 이관 보존·보관/용량 실패를 확인한다. Blender 실측 바닥과 주입구 통행 여유, 카메라 36시점, 다리와 일치하는 황금 가루 경로, 실제 터치 밸브, 390×844·844×390·1024×768 표시도 포함한다. 정상 결과는 `reports/2026-10-20/evidence/fire-foundry/report.json`의 `pass: true`와 33개 통과다.

`--break-cold-floor`는 테스트 브라우저에서 굳은 길의 충돌 높이만 -3m로 바꾼다. 정상 경로를 걸어 횡단하다 추락을 검출해 종료 코드 1이 나와야 한다. `failure-injection.json`에 근거가 남는다. 학생 재미와 실제 기기 성능을 검증하는 도구는 아니다.

## 화산 신전 · 증기 승강실과 상층

`node tools/check-fire-steam.cjs`는 5512·공통 `AUDIT_NODE_MODULES`·격리 Edge를 사용한다. 입구에서 회랑·주조실을 실제 입력으로 완주해 북쪽 문을 열고 세 번째 방을 진행한다. 동력 분기, 다리 하강·잠금과 중간 복원, 빈 승강대의 첫 상승 거부, 실제 탑승·운행·점프·상층 하차, 호출과 왕복, 하층/상층 보행 구분을 확인한다.

37개 검사는 승강대와 승객의 컨트롤러 업데이트 전/후 발 높이, 실제 운행 중 새로고침, v1 원문·사본 보관과 저장 실패, 모순된 기록 거부, 상층 36개 카메라 시점, 높이에 맞는 황금 가루, 터치 E·수첩과 세 화면 크기를 포함한다. 결과는 `reports/2026-10-21/evidence/fire-steam/report.json`의 `pass: true`로 확인한다. 기존 두 도구는 각 33개를 계속 실행한다. 기능 검사와 학생 재미·실제 기기 성능은 별개다.

`--break-rider-transport`는 테스트 브라우저에서 승강대가 승객에게 전달한 이동량만 되돌린다. 기존 컨트롤러가 나중에 바닥 높이를 보정하기 **전** 발 높이 오차를 검출해 종료 코드 1이 나와야 한다. 정상 코드·사용자 기록은 바꾸지 않으며 `failure-injection.json`에 근거가 남는다.
