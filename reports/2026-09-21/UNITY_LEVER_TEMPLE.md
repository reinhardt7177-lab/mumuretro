# 무게의 신전 마지막 방 — 여섯 칸의 지레

## 플레이 흐름

두 번째 방의 균형을 맞추고 열린 문 안쪽으로 걸어가면 `LeverBalanceTemple`로 이동한다. 마지막 방에는 무게 2·6인 추, 받침 칸 6개와 이동 가능한 지지대가 있다.

1. E로 추를 들고 번호가 있는 빈 칸 앞으로 가서 E로 놓는다.
2. 앞쪽의 왼쪽·오른쪽 장치에서 E를 눌러 지지대를 한 칸 옮긴다.
3. 추까지의 거리와 기울기를 관찰해 양쪽의 힘을 같게 만든다.
4. 두 추가 지지대 양쪽에 놓이고 수평이 되면 마지막 문이 열린다.

무게 2인 추는 무게 6인 추보다 지지대에서 세 배 멀리 있어야 한다. 예를 들어 지지대를 3·4번 사이에 놓고, 무게 2를 2번 칸, 무게 6을 4번 칸에 놓으면 `2 × 1.5 = 6 × 0.5`로 양쪽 힘이 3이다. 거리의 단위는 칸 간격이며, 실제 모델의 미터 수와 구분한다.

지지대는 다섯 칸 사이에서 이동한다. 여섯 칸 전체를 채우는 퍼즐이 아니라 두 추를 적절한 칸에 놓는 기존 웹 게임의 규칙을 유지했다. 지지대 위치마다 해답이 있으며 전체 150개 합법 배치 중 해답은 8개다. 빈 지렛대나 추 하나, 같은 쪽에 놓은 두 추는 정답이 아니다.

## 표현과 조작

- 기존 Blender v04의 `hall_lever`, `lever`, `fulcrum`을 별도로 내보내 Unity에 적용.
- 지지대가 레일 위에서 움직이고 그 위치를 중심으로 판이 회전한다. 추·번호판도 판을 따라 움직인다.
- 각 칸 앞에 번호와 지지대까지의 거리, 하단에 양쪽의 무게×거리를 표시.
- 더 큰 힘을 받는 쪽이 내려가고 성공하면 수평으로 돌아온다.
- 기존 상자 들기 자세, 이동 속도 제한, Q 내려놓기, 초기화와 행성 복귀를 사용.
- 들고 있는 중 초기화하거나 문을 통과한 뒤 초기화해도 입구에서 다시 시작한다.

## 파일과 재생성

- 규칙: `Assets/Mumu/Runtime/LeverBalanceState.cs`
- 조작·표현: `Assets/Mumu/Runtime/LeverBalanceRoom.cs`
- 장면 생성: `Assets/Mumu/Editor/BuildLeverTemple.cs`
- 실행 검사: `Assets/Mumu/Runtime/LeverTempleValidation.cs`
- Blender 내보내기: `tools/blender/export_unity_balance.py -- --lever-only`
- Unity 빌드: `Mumu.Editor.BuildLeverTemple.CreateAndBuild`
- 검사: `unity/check-temple.ps1`
- 빠른 체험: Windows 실행 파일에 `-mumu-lever-preview` 인수 사용. 일반 실행은 기존 행성에서 시작한다.

장면과 에셋은 Unity Editor API로 생성한다. 기존 웹 버전, Blender 원본, 캐릭터 컨트롤러를 유지한다. 새 패키지나 온라인 서비스는 추가하지 않았다.

## 검증 상태

- Unity 6000.0.84f1 Windows 빌드 성공: `tmp/unity-lever-final-build.log`의 `MUMU_WINDOWS_BUILD_OK`.
- **733개 실행 검사 통과**: `unity-lever-temple-final/result.json` 및 `player.log`.
- 첫 방 → 두 번째 방 → 마지막 방을 실제 이동으로 연결하고 마지막 방에서 행성 복귀까지 확인.
- 지지대 5곳과 추 배치 150가지를 무게중심 계산으로 독립 검증. 모든 위치에서 해답 존재, 전체 정답 8개.
- 추 들기/놓기, 들고 지지대 이동, 잘못된 배치의 기울기, 내려놓기/다시 들기, 지지대를 옮겨 성공, 마지막 문 통과, 초기화 버튼을 검사.
- 일반 플레이 시점과 전체 장치 시점, 불균형/균형 상태의 실제 Windows 화면을 확인. 안내판에 어두운 배경을 추가해 글자가 바닥에 묻히지 않게 보완.
- 검사 범위는 로컬 Windows다. WebGL·협동·진행 저장 검증 결과는 아니다.

![일반 플레이 시점](unity-lever-temple-final/lever-player-view.png)

![균형을 맞추면 열리는 마지막 문](unity-lever-temple-final/lever-balanced.png)

## 남은 단계

이번 단계는 마지막 지렛대 방까지다. 신과의 만남, 자동 탈출·밀봉, 진행 저장·협동은 아직 Unity에 연결하지 않았다. 현재 마지막 문 뒤에서 ‘행성으로’ 버튼을 사용해 돌아갈 수 있다.
