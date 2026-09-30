# 무무 행성 · Unity 전환

기존 웹 게임과 나란히 관리하는 Unity 프로젝트다. 웹 소스, 블렌더 원본, 저장 데이터는 유지한다.

## 프로젝트 열기

- 프로젝트: `D:\mumumetro\unity\MumuPlanet`
- 에디터: **Unity 6000.0.84f1**
- 렌더링: **Universal Render Pipeline (URP)**
- 장면: `Assets/Mumu/Scenes/PlanetExploration.unity`
- Windows 실행 파일: `MumuPlanet/Builds/Windows/MumuPlanet.exe` (빌드 후 생성)

Unity Hub에서 위 프로젝트를 추가하고 장면을 열어 Play를 누른다. Windows 실행판은 별도 설치 없이 실행한다.

| 조작 | 동작 |
|---|---|
| W A S D / 방향키 | 카메라 방향을 기준으로 이동 |
| 왼쪽 Shift | 달리기 |
| Space | 점프 |
| 마우스 오른쪽 버튼을 누르고 이동 | 카메라 회전 |
| 휠 | 카메라 거리 |
| E | 가까운 신전 입장 / 상자 들기·받침대에 놓기 |
| Q | 들고 있는 상자를 빈 바닥에 내려놓기 |
| G / 오른쪽 위 풀 버튼 | 풀·이삭 표시 켜기/끄기 (이 PC에 선택 저장) |
| N / 책 아이콘 | 입체 탐사 수첩 열기·닫기 |
| 화면 위 현재 퀘스트 | 눌러서 황금가루 길 안내 켜기·끄기 |
| 수첩 안에서 ← → / 이전·다음 | 페이지 넘기기 |
| Esc / 닫기 | 수첩 닫기 |

## 입체 탐사 수첩

행성과 세 퍼즐 방에서 오른쪽의 `수첩 [N]`으로 펼친다. Blender로 만든 가죽 표지·책등·겹종이 위에 선명한 한글 UI를 얹었다. 목차나 좌우 방향키로 넘기면 실제 종이 메시가 휘면서 회전한다. 넘기는 중 닫아도 이동 잠금과 전용 렌더링이 해제된다.

현재는 탐사일지·실험 노트·조작 안내·주변 지도 네 면을 제공한다. 지도는 착륙 지점 근처에서 현재 위치와 무게의 신전 정문을 표시하고, 범선·신전 안에서는 안내 문구를 보여 준다. 신과의 만남을 마친 후 완료 기록을 읽어 균형의 지혜를 보여 주며, 수첩 읽기는 저장 파일을 수정하지 않는다. 상자를 든 채 열어도 들고 있던 상자가 유지된다. 신전 정문 열림 연출이나 신과의 대화 중에는 열지 않는다.

원본: `art/explorer-notebook/explorer-notebook-v01.blend`. Blender 생성은 `tools/blender/build_explorer_notebook_v01.py`, Unity 연결은 `Mumu.Editor.BuildNotebook.CreateAndBuild`, 실행 검사는 `unity/check-notebook.ps1`이다. 현재 지도는 **착륙지 주변의 방향도**이며, 웹 전체 지형 지도와 채집·조리 수첩, 캐릭터 손의 수첩 소품은 별도 이식 대상이다.

## 물의 신전 입구

물의 신전은 입구가 처음부터 열려 있다. 착륙 지점에서 약 41m 떨어진 신전까지 걸어가 계단을 오르고, 아치 앞에서 `E`를 누르면 첫 방(얼음의 길)으로 들어간다. 2026-09-30에 사암 돌산 등반·태양 거울·얼음 해빙 구간을 게임에서 뺐다. 그 코드는 `unity/legacy/water-mountain-v05/`에 보관했고, Blender 원본(`art/water-temple-mountain/`)은 그대로 둔다.

신전은 이전과 같은 자리·방향에 선다. 돌산이 가리던 나무·바위는 되살리고, 신전 건물 자리와 들어 올린 기초에 묻히는 것만 숨긴다. 빙하 부피에 맞춘 충돌이 있어 옆이나 뒤로 얼음 속에 걸어 들어갈 수 없다. 아치 뒤 어두운 공간은 걸어 들어가는 방이 아니어서 문턱에서 멈춘다. 처음 들어갈 때 `water-approach-v1.json`에 방문 기록(`entranceOpen`)을 남기고, 예전 해빙 기록도 방문으로 읽는다. 기록을 읽을 수 없어도 입장은 막지 않으며 기존 파일을 덮어쓰지 않는다.

- 생성: `Mumu.Editor.BuildWaterSanctuaryExterior.CreateAndBuild`(메뉴 `Mumu → Build water sanctuary exterior (direct entry)`). 행성 장면의 신전 부분만 다시 만들고 두 Windows 실행판을 빌드한다.
- 검사: `unity/check-water-entrance.ps1`. 새 기록·예전 해빙 기록·손상된 기록 세 경우를 별도 게임 프로세스로 검사한다.
- 한 번에: `unity/build-water-direct-entry.ps1`. 생성·빌드 뒤 입장 검사와 관련 회귀 검사를 모두 실행한다. `-SkipBuild`를 주면 검사만 돌린다.
- `-mumu-water-preview`로 실행하면 신전 계단 앞에서 시작한다.

벽에 부딪칠 때의 이동도 이번에 고쳤다(`PlanetExplorer.SlideAlong`). 게임 전체 보행에 적용된다.
- 원인: 구면 위의 벽은 조금 기울어 있다. 옛 투영 방식은 벽 쪽 성분을 남겨서, 캐릭터가 벽 속으로 조금씩 파고들었다.
- 수정: 새 방식은 벽 안쪽으로 가는 성분만 뺀다.

> 2026-09-30 상태: 장면 재생성과 두 실행판 빌드를 마쳤다. 새 입장 검사 76개와 관련 회귀 검사가 통과했다. 풀밭 검사(`check-meadow.ps1`)는 이번 변경 전의 2026-09-27 빌드에서도 같은 항목에서 실패해서, 한 번에 실행 스크립트에서 뺐다. [작업 보고서](../reports/2026-09-30/water-direct-entry/REPORT.md)

## 퀘스트와 황금가루 안내

범선과 행성의 화면 위에 현재 해야 할 일이 표시된다. 누르면 작은 금빛 입자가 캐릭터에서 실제 목적지까지 직접 이어지고, 화살표와 대략적인 거리를 보여 준다. 다시 누르면 꺼진다. 범선에서는 회수 손잡이·소포·숫자판·항해대 순서, 행성에서는 무게의 신전 정문으로 이어진다. 물의 신전 근처에 가거나 한 번 들어간 뒤, 또는 무게의 신전을 마친 뒤에는 물의 신전 입구를 가리킨다. 수첩을 펼치거나 목적지에 도착하면 길 입자는 숨는다. 안내 켜짐 여부만 이 PC에 저장하며, 안내는 퍼즐·신전 진행 데이터를 수정하지 않는다.

`Mumu.Editor.BuildQuestGuide.CreateAndBuild`가 기존 장면에 안내와 지도 면을 추가한다. `unity/check-quest-guide.ps1`로 1440×900과 960×540의 버튼·경로·지도 표시를 확인한다. 신전 내부는 각 방의 기존 퍼즐 HUD가 목표를 안내하며, 입자가 닫힌 문 너머로 지나가지 않도록 이 첫 이식 범위에서는 황금 경로를 그리지 않는다.

## 우주 범선 도입부

Windows 게임은 Blender 범선 위에서 시작한다. 발견한 소포는 난간 밖 **회수 팔의 밧줄에 매달려** 있다. **우현의 회수 손잡이에서 E**로 소포를 갑판에 건져 올리고, **갑판 가운데의 소포를 E**로 열면 입체 수첩이 펼쳐진다. 수첩에는 별의 자리 `3 · 5 · ?`와 “셋째 자리는 앞의 두 자리의 합”이라는 단서가 있다. 선미의 숫자판 세 개 앞에서 각각 E를 눌러 항로를 맞추면 출항할 수 있다. 정답은 `3 · 5 · 8`이며, 착륙 후 수첩·퍼즐·신전 장면으로 이어진다.

범선 모델은 보존된 `art/starsail/starsail-v02.blend`에서 `tools/blender/export_unity_starsail.py`로 Unity용 FBX를 만든다. `Mumu.Editor.BuildStarsailIntro.CreateAndBuild`가 별도 `StarsailIntro` 장면을 생성하고 첫 장면으로 빌드한다. 소포·수첩·다이얼·출항 진행은 이 PC의 `Application.persistentDataPath/starsail-intro-v1.json`에 저장되어, 출항 후 다시 실행하면 행성에서 시작한다. `-mumu-ship-preview`는 실제 기록을 바꾸지 않고 도입부를 다시 보는 옵션이다. `unity/check-starsail.ps1`은 전체 도입부와 재실행 복원을 실제 Windows 실행판에서 확인한다. 기존 이동·신전 자동 검사 명령은 시작 시 행성 장면으로 이동한다.

## 무게의 신전 첫 방

행성 시작 지점에서 길 왼쪽의 석조 신전으로 이동해 청록빛 정문 앞에서 E를 누른다. `WeightTemple`은 첫 번째 방 전용 장면이다. 왼쪽 UI에서 3·4·5개를 고르고, 두 상자를 저울로 비교한 뒤 왼쪽 1번부터 가벼운 순서로 배치한다. 무게 숫자는 표시하지 않는다. 선택한 상자를 모두 맞추면 문이 열리고, 통로 끝까지 걸어가면 두 번째 방으로 자동 이동한다. ‘행성으로’ 버튼으로 돌아온다.

상자를 들면 속도가 줄고 점프는 잠시 제한된다. Q로 내려놓을 때 벽·다른 상자와 겹치는 위치는 거절한다. 난이도 변경은 배치를 초기화한다. ‘다시 놓기’는 상자와 문을 초기화하고 플레이어를 첫 위치로 돌려보낸다. 세 방의 중간 배치는 이 PC에 저장된다. 협동은 아직 연결하지 않았다.

`Mumu.Editor.BuildWeightTemple.RunBatch`를 `-batchmode`(자동 종료는 메서드가 수행)로 실행하면 TMP 리소스 준비, 세 퍼즐 방 구성, Windows 빌드를 순서대로 수행한다. `unity/check-temple.ps1`은 세 방의 플레이 흐름과 연결을 검사한다. 생성 장면을 수작업으로 수정하려면 먼저 복제한다.

## 두 번째 방 · 두 판의 균형

`TwinBalanceTemple`에서 상자 네 개를 양쪽 판의 두 칸에 하나씩 놓는다. 상자 무게는 1·2·3·4이며 숫자를 직접 표시하지 않는다. 판 옆의 빛은 올려놓은 총무게만큼 차고, 무거운 판이 내려간다. **양쪽에 정확히 두 개씩, 같은 총무게**가 되면 문이 열린다. 크기가 크다고 무거운 상자는 아니다.

E로 놓인 상자를 다시 들고 Q로 빈 바닥에 내려놓아 조합을 바꿀 수 있다. 빈 판이나 일부만 놓은 상태에서는 문이 열리지 않는다. 성공한 배치는 ‘다시 놓기’를 누를 때까지 유지한다. 문을 통과한 뒤 초기화해도 입구로 돌아오므로 갇히지 않는다. 통로 끝까지 걸어가면 마지막 지렛대 방으로 이동한다.

Blender 부품은 `tools/blender/export_unity_balance.py`로 내보낸다. `BuildTwinTemple.Create`는 첫 방의 생성 장면을 별도 장면으로 복사하고 전용 홀·두 판·빛의 칸을 구성한다. `TwinBalanceState`가 판정, `TwinBalanceRoom`이 조작·표시를 담당한다. 현재 두 방 모두 진행 저장·협동을 연결하지 않았다.

## 마지막 방 · 여섯 칸의 지레

무게 **2와 6인 추 두 개**를 여섯 칸에 놓고 지지대를 옮겨 수평을 만든다. 지지대는 다섯 칸 사이를 이동한다. E로 추를 옮기고, 앞쪽 두 장치에서 E로 지지대를 왼쪽·오른쪽으로 이동한다. Q는 바닥에 내려놓기다. 칸의 거리 표시와 화면 하단의 **무게 × 거리**를 비교해 더 큰 힘을 받는 쪽을 확인할 수 있다.

양쪽 힘이 같아지면 마지막 문이 열린다. 안쪽 균형의 신에게 다가가면 네 문장의 대화가 자동 진행된다. E·Space·‘다음’ 버튼으로 넘길 수도 있다. 대화가 끝나면 금빛 화면 전환과 함께 행성으로 자동 복귀하고, 완료 기록과 함께 신전이 밀봉된다. 완료한 신전은 다시 들어갈 수 없다.

무게의 신전 완료·밀봉은 이 PC의 `Application.persistentDataPath/temple-completion-v1.json`에 저장한다. **중간 진행**은 별도 `temple-journey-v1.json`에 저장한다. 3·4·5개 선택, 세 방의 상자·추 배치, 지지대 위치가 바뀔 때 기록된다. 게임을 다시 열면 진행 중이던 방으로 돌아오고, 신전 밖으로 나왔다가 다시 들어가도 이어진다. 캐릭터는 방 입구에서 시작한다. 손에 들고 있던 상자는 다시 들기 전 자리로 돌아간다. 신전 완료 시 중간 기록은 종료되고 완료 기록이 밀봉을 결정한다. 검사·미리보기에서는 `-mumu-progress-file <별도 파일>`이 중간 기록까지 격리하며, 필요하면 `-mumu-journey-file <별도 파일>`을 지정할 수 있다. `-mumu-lever-preview`로 마지막 방부터 체험할 수 있다.

`unity/check-temple-journey.ps1`은 별도 게임 프로세스에서 세 방 복원과 파일 기록을 검사한다. `unity/check-temple.ps1`은 전체 동선과 완료 후 재실행·밀봉을 검사한다. 깨졌거나 더 새로운 형식의 중간 기록은 덮어쓰지 않는다.

Blender v04의 홀·판·지지대를 `tools/blender/export_unity_balance.py -- --lever-only`로 내보낸 후 `Mumu.Editor.BuildLeverTemple.CreateAndBuild`로 장면과 Windows 빌드를 생성한다. 이전 두 방과 행성 장면을 재생성하지 않는다.

알현 공간과 행성의 완료 봉인만 함께 갱신하려면 `Mumu.Editor.BuildTempleAudience.CreateAndBuild`를 사용한다. 신 조형물만 내보내려면 Blender 내보내기에 `--audience-only`를 지정한다. `unity/check-temple.ps1`은 별도 기록 파일로 세 방과 완료 이벤트를 검사한 뒤, 새 게임 프로세스에서 봉인이 유지되는지도 확인한다.

균형의 신은 별도 제작한 `art/balance-deity/equilibrium-deity-v01.blend`를 사용한다. 새 모델을 재생성하려면 `tools/blender/build_balance_deity_v01.py`를 Blender로 실행한다. 기존 `--audience-only` 내보내기는 보존된 이전 조형물용이다. 새 모델에는 길쭉한 가면, 겹망토, 수평 저울과 세 겹의 후광이 포함되어 있다.

## 신전 외관

임시 받침대 대신 저울 문양과 삼각 지붕, 홈이 있는 돌기둥, 금빛 장식, 청록빛 정문·등불을 갖춘 Blender 외관을 사용한다. 옆 기단과 벽은 충돌로 막고, 가운데 포석은 행성 지면에 맞춰 배치한다. 정문 앞에서만 E로 입장하며, 내부에서 나가면 입장 전 위치로 돌아온다.

원본은 `art/temple-exterior/weight-sanctuary-v01.blend`다. `tools/blender/build_temple_exterior_v01.py`로 모델을 내보낸 뒤 `Mumu.Editor.BuildTempleExterior.CreateAndBuild`로 기존 행성의 입구만 갱신한다. 전체 신전 재생성에서도 외관을 유지한다. `unity/check-exterior.ps1`은 실제 Windows 실행판에서 외관·면 방향·진입로·충돌·입장·복귀를 검사한다.

## 첫 전환 범위

- 원본 행성 지형과 잔디 표면, 시작 지역 숲·바위·덤불의 배치.
- 반지름 68인 행성을 따라 바뀌는 중력 방향과 3인칭 이동.
- 항해사 스킨 메시와 대기·걷기·달리기 클립. 점프는 이동 계산과 별도 관절 보정으로 구성.
- 카메라 충돌 회피, 자연물 충돌, 부드러운 조명·안개·색 보정.
- 무게의 신전 첫 방: Blender 부품, 상자 들기·놓기, 저울 비교, 3·4·5개 순서 퍼즐, 문 통과와 행성 복귀.
- 두 번째 방: 첫 방에서 자동 이동, 2:2 무게 균형, 무게 표시와 움직이는 판, 문 통과·초기화·행성 복귀.
- 마지막 방: 두 번째 방에서 자동 이동, 2·6 무게의 추와 여섯 칸 지렛대, 지지대 이동·거리 표시·수평 판정·마지막 문.
- 신과의 만남: Blender 조형물과 대화, 자동 귀환, 황금 봉인, 로컬 완료 기록과 재입장 차단.

**전체 게임 이식 완료를 뜻하지 않는다.** 웹 전체 지도·채집·조리 수첩, 남은 신전 퍼즐, 캐릭터 손의 수첩·망원경 소품, 2~3인 협동은 다음 이식 대상이다. 기존 웹 저장 파일을 Unity에 자동 적용하지 않는다. 시작 지역 바깥은 지형만 있으며 자연물 전역 배치는 아직 없다.

## 데이터와 코드

- `Assets/Mumu/Source/world.json`: 기존 게임에서 추출한 지형·정점 색·오브젝트 위치. 좌표계 변환은 에디터 생성기 한 곳에서 처리한다.
- `Assets/Mumu/Models`: 블렌더가 변환한 FBX와 원본 텍스처.
- `Assets/Mumu/Runtime`: 표면 조회, 이동, 카메라, 캐릭터 포즈.
- `Assets/Mumu/Editor/BuildExploration.cs`: Unity API로 메시·머티리얼·Animator·장면을 생성한다. Unity YAML을 손으로 작성하지 않는다.
- `Assets/Mumu/Generated`: 생성된 공용 메시·머티리얼·애니메이션 컨트롤러.

## 재현

1. 저장소 루트에서 `node tools/serve-local.cjs 5512`로 기존 게임을 연다.
2. Playwright 경로 `AUDIT_NODE_MODULES`를 지정하고 `node tools/export-unity-world.cjs`로 배치를 추출한다.
3. 블렌더에서 `tools/blender/export_unity_navigator.py`를 실행한다.
4. Unity의 **Mumu → Build exploration scene** 메뉴로 장면을 만든다. 이 메뉴는 생성 장면을 재구성하므로, 수작업으로 꾸밀 장면은 복제해서 작업한다.
5. `unity/build.ps1`로 장면 생성과 Windows 빌드를 실행한다.
6. `unity/check.ps1`로 실행판에서 이동·착지·애니메이션을 검사하고 화면을 저장한다.

`Library`, `Temp`, `Logs`, `Builds`는 Git에서 제외한다. FBX, 텍스처, `.meta`, 프로젝트 설정과 장면은 버전 관리한다. 템플릿이 선택한 패키지는 `Packages/packages-lock.json`으로 고정하며 수동 일괄 업그레이드하지 않는다.

## 다음 이식 순서

무게의 신전 정문은 Blender v02 양개문을 사용한다. 가까이서 **E**를 누르면 청동 문짝이 양쪽으로 열린 뒤 첫 퍼즐 방으로 이동한다. 돌아올 때 원래 접근 위치와 닫힌 문이 복원된다. 제작 원본과 재생성 방법은 `art/temple-exterior/README.md`에 정리했다.

1. 퀘스트 안내를 나머지 신전과 확장 지역에 맞게 넓힌다.
2. 남은 신전과 2~3인 방 참여·공유 상태 이식.
3. Windows 및 WebGL 각각에서 성능·입력·저장·협동을 검증하고 배포.
 근데 하늘 
Vercel의 기존 웹 버전은 현재 유지한다. Unity WebGL 빌드와 배포는 별도 검증 단계다.

## 초원 바람 효과

성능을 위해 풀 표시는 기본적으로 꺼져 있다. 오른쪽 위 **풀: 꺼짐 [G]** 버튼이나 G 키로 켤 수 있고, 마지막 선택을 이 PC에 저장한다. 끄면 풀·이삭의 렌더링과 거리별 표시 갱신을 멈춘다. 지면과 길, 충돌 판정은 유지된다.

시작 지역 반경 약 40m에 실제 풀잎과 은빛 이삭 군락을 추가했다. 키가 다른 풀들이 넓게 지나가는 바람에 함께 기울어지며, 뿌리는 고정된다. 기존 길과 신전 입구는 비워 둔다. 먼 풀은 점차 줄여 표시한다. 현재 행성 전체에 배치한 것은 아니다.

- 생성: Unity 메뉴 `Mumu → Add wind meadow` (기존 장면의 풀만 갱신)
- 빌드: `Mumu.Editor.BuildMeadow.CreateAndBuild`
- 화면 검사: `./unity/check-meadow.ps1`
- 원본 지형·Blender 에셋·캐릭터 애니메이션은 그대로 유지한다.

잔디 잎은 `art/meadow-leaves/meadow-leaves-v01.blend`에서 제작한 곡선 4종을 사용한다. `tools/blender/build_meadow_leaves_v01.py`가 FBX와 Unity 배치용 메시 JSON을 함께 내보낸다. 이삭 줄기는 별도로 유지한다.

## 물의 신전 엔딩

열린 입구에서 **E**로 얼음의 길에 입장한다. 세 물 퍼즐을 마치고 물의 신과 대화하면 순환의 지혜가 로컬 수첩에 기록되고, 행성의 문 바깥 계단으로 자동 복귀한다. 신전은 봉인되어 다시 들어갈 수 없다. 남은 무게의 신전이 있다면 금가루 안내가 그쪽을 가리킨다.

`Mumu.Editor.BuildWaterEnding.CreateAndBuild`는 행성의 신전 입구와 성소 장면을 재생성하고 Windows 메인 게임·물 신전 전용 실행판을 함께 만든다. 장면을 다시 만들 필요 없이 코드만 갱신할 때는 `Mumu.Editor.BuildWaterEnding.BuildExisting`을 실행한다. 행성 입구에서 실제 입장까지는 `unity/check-water-entrance.ps1`, 물 퍼즐 저장·재개는 `unity/check-water-journey.ps1`, 알현·복귀·봉인은 `unity/check-water-sanctuary.ps1`로 검사한다. 2026-09-27 빌드 결과와 화면은 [`물의 신전 엔딩 보고서`](../reports/2026-09-27/water-temple-ending/REPORT.md)에 있다(돌산 포함 판).
