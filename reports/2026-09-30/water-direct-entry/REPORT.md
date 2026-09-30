# 물의 신전 · 돌산 제거와 바로 입장 (2026-09-30)

## 결과

Unity 판에서 사암 돌산 구간(절벽 등반·태양 거울·얼음 해빙)을 없앴다. 물의 신전은 입구가 처음부터 열려 있다. 계단을 올라 아치 밑 문턱에서 `E`를 누르면 첫 방(얼음의 길)으로 바로 들어간다.

- 장면 재생성과 두 실행판(`MumuPlanet.exe`, `WaterTempleJourney.exe`) 빌드를 16:22~16:25에 마쳤다. 로그는 `unity-build.log`다(`MUMU_WINDOWS_BUILD_OK`, `MUMU_WATER_ENDING_BUILDS_OK`).
- 새 입장 검사 76개가 통과했다. 엔딩, 물 여정, 물 내부 방, 기존 회귀 검사도 통과했다.
- 실패는 풀밭 검사 1개다. 수정 전(2026-09-27) 빌드에서도 같은 항목에서 실패한다. 이 실패는 이번 변경에서 생긴 것이 아니다.

사용자가 따로 정하지 않은 항목은 권장안대로 했다.
- 신전의 자리와 방향은 그대로다.
- 입구 양옆 물줄기 장식은 유지했다.
- Blender 작업(아치 안쪽 통로, 기초 가장자리)은 미뤘다.

## 바뀐 흐름

| | 2026-09-27 판 | 이번 판 |
|---|---|---|
| 신전 입구 | 얼음 봉인. 돌산 등반 → 거울 조준 → 해빙 뒤 열림 | 처음부터 열림 |
| 입장 | 녹은 입구 앞에서 `E` | 계단 위 아치 밑에서 `E` |
| 돌산 자리 | 절벽 메시·충돌·손잡이·거울. 자연물 292개 숨김(그림 172, 충돌 120) | 맨땅. 숨겼던 자연물을 되살림 |
| 퀘스트 | 돌산에 매달리거나 해빙한 뒤 물의 신전 안내 | 신전 가까이(9m) 오면 "물의 신전 들어가기". 한 번 들어갔거나 무게의 신전을 마친 뒤에는 "물의 신전 찾아가기" |
| 저장 `water-approach-v1.json` | `entranceOpen`은 해빙 여부 | `entranceOpen`은 방문 여부. 예전 해빙 기록도 방문으로 읽음. 형식은 그대로 |
| 완료 뒤 | 봉인, 재입장 차단 | 그대로 |

## 실제 화면: 전후 비교

비교 기준은 `reports/2026-09-27/water-temple-ending/entry-verified/`다. 이번 캡처는 `entrance/fresh/`와 `ending/`에 있다.

| 장면 | 2026-09-27 | 이번 판 | 본 것 |
|---|---|---|---|
| 돌산 자리 전경 | `water-mountain-overview.png` | `retired-mountain-site.png` | 사암 돌산과 정상의 거울이 없어지고 풀밭·바위·나무가 이어진다. 신전 자리와 기초 모양은 같다. 얼음으로 막혀 있던 아치가 열려 있다. |
| 정면 | `water-temple-ground-front.png` | 같은 이름 | 건물과 물줄기 장식이 같다. 왼쪽 아래에 되살린 바위가 보인다. |
| 측면 | `water-temple-ground-side.png` | 같은 이름 | 구도가 같다. 왼쪽 비탈에 되살린 바위와 덤불이 있다. |
| 접근(고정 시점) | `water-temple-approach.png` | 같은 이름 | **되살린 덤불이 화면 왼쪽 약 1/3을 가린다.** 이 캡처는 검사용 고정 카메라(신전 로컬 (7, 5, -12))라 게임 카메라와 다르다. 같은 쪽에서 걸어가는 정면 캡처에서는 입구가 가려지지 않는다. |
| 문턱 | (해빙 뒤 입구) | `doorway-prompt.png`, `doorway-closeup.png` | 캐릭터가 아치 밑에 서면 아래에 "E  물의 신전 입장"이 뜬다. 아치 안은 얕은 어두운 벽이다. |
| 착륙지 | — | `landing-view.png` | 나무 사이로 빙하가 조금만 보인다. 퀘스트는 의도대로 무게의 신전을 가리킨다. |
| 완료 뒤 귀환 | — | `ending/water-seal-after-return.png` | 입구에 금빛 고리 봉인이 있다. 아래에 "물의 신전 밀봉 · 순환의 지혜 기록 완료"가 뜬다. |

## 검사 결과

모두 마지막 빌드로 돌렸다. 검사마다 따로 돌린 결과가 이 폴더에 있다. 17:01~17:04에는 `unity/build-water-direct-entry.ps1 -SkipBuild`로 처음부터 끝까지 한 번 더 돌렸고 수가 같았다(`oneshot-skipbuild-console.txt`).

| 검사 | 통과 |
|---|---|
| 새 입장 `check-water-entrance.ps1` | 새 기록 48, 예전 해빙 기록 14, 손상 기록 14 |
| 엔딩 `check-water-sanctuary.ps1` | 29 |
| 물 여정 저장 `check-water-journey.ps1` | 처음 11, 얼음 방 재개 6, 모으기 방 재개 7, 순환 방 재개 5, 완료 3 |
| 물 내부 방 `check-water-interior-v02.ps1` | 얼음 45, 모으기 46, 순환 41 |
| 이동 `check.ps1` | 통과. 걷기 3.2m/s, 달리기 5.8m/s, 멈춤 0 (`exploration/locomotion.json`) |
| 퀘스트 안내 `check-quest-guide.ps1` | 1440×900 18, 960×540 18 |
| 무게 신전 외관 `check-exterior.ps1` | 56. "Pier blocks walking" 좌우, "Solid door blocks walking" 포함 |
| 무게 신전 방 `check-temple.ps1` | 768. 완료 저장과 봉인은 별도 프로세스로 다시 실행해 확인 |
| 무게 신전 여정 `check-temple-journey.ps1` | 첫 실행/재실행: 무게 18/17, 쌍둥이 17/15, 지레 15/13 |
| 범선 `check-starsail.ps1` | 39, 재실행 4 |
| 수첩 `check-notebook.ps1` | 해상도 3종에서 각 1180 |
| 풀밭 `check-meadow.ps1` | **실패. 이번 변경 전부터 실패한다(아래)** |

새 기록 검사에서 잰 값(`entrance/fresh/measurements.json`):

- 옛 돌산 자리
  - 지면 표본 80점. 솟은 면은 최대 0.0000m다.
  - 그 부피 안의 충돌: 되살린 나무·바위 27, 신전 가장자리 1, 그 밖 0.
- 자연물: 보임 1,555, 숨김 109. 오프라인 추정은 108이었다. 숨김 상태는 규칙(건물 발자리 안이거나, 들어 올린 기초 밑에 0.3m 넘게 묻힘)과 정확히 일치한다.
- 착륙지 → 계단
  - 경로 계획 47.5m. 실제로 44.9m를 13.8초에 걸었다(지면 거리 37.9m의 1.18배).
  - 지형에서 뜬 거리는 최대 0.000m다.
- 옛 돌산 가운데 → 계단: 16.5m, 5.0초(1.05배).
- 계단을 올라 멈춘 곳: 신전 로컬 (0, 1.1, 0.336). 아치 밑 문턱이다.
- 빙하 옆·뒤 일곱 방향: 모두 신전 충돌에서 멈춘다.
- 기초 둘레와 지형의 차이: 최대 0.019m(기준 5cm).
- 옛 얼음 수신점: (54.103, 49.618, 17.571). 2026-09-27 판은 (54.10, 49.62, 17.57)이다.
- 검출기를 일부러 속여 봤다. 옛 돌산 물체, 입구의 나무, 신전 밖 보행면을 심으면 각각 실패로 잡고, 치우면 통과한다(48개에 포함).

## 틀렸던 것

실행판을 돌려서 드러난 것이다. 모두 고친 뒤 위 검사를 다시 돌렸다.

1. **벽에 닿으면 조금씩 벽 속으로 들어갔다. 게임 전체 보행에 해당한다.**
   - 원인: 옛 코드는 이동을 부딪친 면의 법선으로 투영했다(`Vector3.ProjectOnPlane(displacement, hit.normal)`). 구면 위의 벽은 국소 수직에서 최대 약 6° 기운다. 그래서 투영한 이동에 벽 쪽 성분이 남았고, 지면 붙이기와 합쳐져 프레임마다 약 0.4mm씩 벽으로 기어갔다. 캡슐이 벽에 닿으면 cast가 그 벽을 무시해 통과했다.
   - 증상: 빙하 0°·90°·270° 방향 보행 검사에서 "cast hit nothing" 상태로 얼음 속에 들어갔다.
   - 수정: `PlanetExplorer.SlideAlong`. 벽 법선을 지면 평면에 눕힌 뒤, 벽 안쪽으로 가는 성분만 뺀다. `Step`과 `StepElevated`에 적용했고, 평면 방용 `StepFlatCollisions`는 그대로다.
   - 이동 코드가 바뀌었으므로 걷는 회귀 검사(이동, 무게 신전 외관·방·여정, 물 내부 방)를 모두 다시 돌렸다.
2. **빙하 충돌 상자가 비탈에서 얕았다.** 상자 바닥이 신전 기준 y=0이어서, 동쪽 비탈에서는 모서리가 가파른 접촉 법선을 만들었다. 상자 높이를 -5~7.6m로 늘렸다(중심 1.3, 높이 12.6).
3. **기단과 계단 옆으로 걸어 들어갈 수 있었다.** 발 광선이 높은 보행 상자 안에서 시작하면 그 상자를 무시한다. 기단 앞벽 2개와 계단 1·2단 옆벽 4개를 추가했다.
4. **직선 보행 검사로는 착륙지에서 계단까지 가지 못했다.** 되살린 나무와 바위 사이를 93.9m 걸으며 122번 우회해도 도착하지 못했다.
   - 이것은 검사 보행기의 한계다. 격자 A* 경로 계획과 가장 가까운 점 추종으로 바꿨고, 3초 동안 못 움직이면 실패로 처리한다.
   - 걷기 자체는 여전히 매 프레임 `Step()`을 부르는 보행이다. 순간이동이 아니다.
5. **Windows PowerShell 5.1이 결과 JSON의 한글을 깨뜨렸다.** BOM 없는 UTF-8을 CP949로 읽어서 `ConvertFrom-Json`이 실패했다. `-Encoding UTF8`을 붙였다.
6. **`-batchmode`가 없는 검사가 시간 초과로 멈췄다.**
   - 원인 추정: `ProjectSettings`에 `runInBackground: 0`이 있어서, 숨긴 창이 포커스를 잃으면 게임이 멈추는 것으로 본다.
   - 수정: `check-water-journey.ps1`, `check-water-sanctuary.ps1`, `check-water-interior-v02.ps1`에 `-batchmode`를 붙였다.
7. **빌드 전 초안의 오류**
   - 문턱 충돌 폭이 3.4m여서 양옆에 0.6m 틈이 있었다. 캡슐은 0.57m 틈을 지나간다. 문설주 충돌을 넣고 문턱을 4.7m로 넓혔다.
   - 자연물을 사각형으로 숨겼더니, 불필요하게 숨긴 것이 14개, 묻혔는데 남긴 것이 7개였다(`offline/scene-plot-rectangle-audit.txt`). 그래서 지금의 규칙으로 바꿨다.
8. **생성기의 한글 글리프 추가가 배치 실행에서 전부 실패한다.**
   - `generator-summary.txt`의 `WATER_FONT_MISSING`에는 ASCII까지 모든 글자가 나열된다. 글꼴 원본을 열지 못한 것으로 보이지만, 원인은 확인하지 않았다.
   - 지금 쓰는 문구의 글리프는 이미 정적 아틀라스에 있다. 실행판 검사("Korean prompt and quest glyphs exist in the static atlas")가 이를 확인했고, 캡처의 글자도 정상이다.
   - 새 글자가 들어간 문구를 추가하면 이 검사가 실패할 것이다. 그때 고쳐야 한다.
9. **보관 README에 틀린 설명을 썼다.** 처음에는 "`Generated/WaterMountain/` 자산은 장면이 참조하지 않는다"고 적었다.
   - GUID로 대조해 보니 105개 중 20개를 지금 신전이 쓴다. 빙하 신전 메시, 재질, 지형 맞춤 기초, 물줄기, 봉인 돌, 한글 글꼴이다.
   - 그래서 폴더째 지우면 안 된다고 README를 고쳤다.

이번 작업에서 드러난 기존 결함도 있다. 둘 다 이번 판에서 고쳤다.
- 옛 판은 빙하 모델의 약 85%에 충돌이 없었다. 몸 높이 얼음 표면 9,837점 중 캡슐이 닿는 비율이 14.7%에서 100%로 늘었다(`offline/glacier-collider-*.txt`).
- 동쪽 비탈의 나무·바위 13+6개가 기초에 0.33~3.54m 묻힌 채 보이고 있었다. 이번 판은 이것들을 숨긴다.

## 이번 변경 전부터 있던 실패: 풀밭 검사

`check-meadow.ps1`의 마지막 단계는 같은 바람 시각으로 두 번 그린 화면이 같아야 통과한다. 기준은 차이 픽셀 100개 이하다.

- 이번 빌드: 126개로 실패했다("Scene changed independently of grass wind").
- 수정 전 백업 빌드(2026-09-27 21:51): 같은 명령, 같은 항목에서 151개로 실패했다(`meadow-before-change/`).
- 차이 픽셀은 무게 신전 문 장식과 캐릭터 윤곽의 가장자리에 흩어져 있다(`meadow/diff-mask.png`의 빨간 점). 풀의 바람 움직임 자체는 정상이다(바람 전후로 17만 5천 픽셀이 변함).
- 마지막 통과 기록은 2026-09-21(`reports/2026-09-21/unity-grass-toggle/`)이다. 어느 변경에서 생겼는지와 원인은 찾지 않았다. 이번 범위 밖이라 고치지 않았다.

그래서 `build-water-direct-entry.ps1`은 이 검사를 빼고 돌린다.

## Unity 라이선스: 막혔다가 풀린 경위

- 12:29 첫 빌드 시도는 exit 198("No valid Unity Editor license found")로 끝났다(`unity-build-license-failure.log`). 그때 라이선스 목록은 비어 있었다(`offline/licensing-showEntitlements.txt`, 12:29 기준).
- `winget`으로 Unity Hub 3.22.0(MSIX)을 설치했다. 사용자가 Hub에서 로그인하자 15:20:45에 Unity Personal 라이선스 파일이 생겼다. `com.unity.editor.headless` 권한이 들어 있다.
- 그 뒤 빌드 기록:
  - 15:24 전체 빌드: `unity-build-first.log`
  - 메인 실행판만 2회: `unity-build-smoke-route.log`
  - 16:02 전체 빌드: `unity-build-second.log`
  - 16:22 전체 빌드: `unity-build.log`. 마지막 빌드다.
- 마지막 생성기 기록(`generator-summary.txt`)
  - 신전 자세 차이는 위치 0, 각도 0이다.
  - 들어 올린 보행면 5개, 숨긴 자연물 109개.
  - 첫 재생성 때 옛 판에서 숨겨져 있던 292개를 모두 되살렸고, 새 규칙으로 109개를 다시 숨겼다.

## 바뀐 파일

- 새 파일
  - `Runtime/WaterSanctuaryEntrance.cs`: 입장, 귀환, 봉인, 안내 문구
  - `Runtime/WaterEntranceSmoke.cs`: 행성 쪽 검사
  - `Editor/BuildWaterSanctuaryExterior.cs`: 돌산 없는 신전 생성기
  - `unity/check-water-entrance.ps1`, `unity/build-water-direct-entry.ps1`
- 수정
  - `PlanetExplorer`(`SlideAlong`), `QuestGuide`, `TempleEntrance`, `StarsailIntro`(검사 플래그), `PlanetSurface`(읽기 전용 목록)
  - `WaterEntrySmoke`, `WaterEndingSmoke`(새 입구 기준), `BuildWaterEnding`(새 생성기 호출)
  - 검사 스크립트 3개에 `-batchmode`를 추가했다.
  - `build-water-direct-entry.ps1`에 무게 신전 여정과 물 내부 3방 검사를 추가했다.
- 장면: `PlanetExploration.unity`는 에디터 API로 다시 만들었다. `.meta`는 백업과 같다. `Assets` 안에 중복 GUID는 0개다.
- 보관: `BuildWaterMountain`, `WaterMountainTrial`, `WaterMountainSmoke`, `IceThawPresentation`, `check-water-mountain.ps1`을 `unity/legacy/water-mountain-v05/`로 옮겼다. `.meta` 4개는 백업과 바이트까지 같다. 다시 넣는 방법은 그 폴더의 README에 있다. `MountainClimbController`는 `OrbitCamera`와 `NavigatorPose`가 참조해서 남겼고, 장면에서는 쓰지 않는다.
- 그대로 둔 것: 웹판(`src/`), Blender 원본(`art/water-temple-mountain/`)
- 백업: `tmp/backup-2026-09-30-water-direct-entry/`. 바꾸기 전 코드, 장면, 두 빌드가 들어 있다(771개 파일, 1.18GB, 해시 대조 완료). `tmp/`는 git 밖이라 보존이 보장되지 않는다.
- 설치: Unity Hub 3.22.0

## 남은 한계와 다음 후보

- **아치 안쪽이 얕은 어두운 벽이다.** 얼음이 가리던 자리가 이제 늘 보인다. Blender로 짧은 입구 통로(내려가는 계단, 물빛, 깊이감)를 만드는 것이 첫 후보다. 이번에는 미뤘다.
- **기초 가장자리가 비탈에서 턱처럼 드러난다**(`retired-mountain-site.png`). 2026-09-27 판에도 있던 모양이다. 이번에는 미뤘다.
- **착륙지에서 신전이 잘 안 보인다.** 나무 사이로 빙하가 조금 보이는 정도다. 길 표지나 물길 같은 시선 유도를 검토할 만하다.
- 접근 캡처의 고정 시점을 덤불이 가린다. 게임에는 영향이 없지만 검사 시점은 옮기는 편이 낫다.
- 빙하 충돌은 상자 7개로 근사했다. 모서리 5칸에 최대 0.66m의 보이지 않는 벽이 있다(1,246칸 중).
- 사람이 키보드로 직접 해 보지는 않았다. 검사는 게임 안에서 매 프레임 `Step()`을 불러 걷는다.

## 다시 돌리는 법

Unity 에디터를 닫은 상태에서 실행한다.

```powershell
# 장면 재생성 + 두 실행판 빌드(약 3~5분) + 관련 검사 전부(약 4분)
D:\mumumetro\unity\build-water-direct-entry.ps1
# 빌드 없이 검사만
D:\mumumetro\unity\build-water-direct-entry.ps1 -SkipBuild
```
