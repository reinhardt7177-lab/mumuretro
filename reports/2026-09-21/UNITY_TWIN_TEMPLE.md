# Unity 무게의 신전 · 두 번째 방

2026-09-21 · Windows 로컬 빌드

## 적용한 내용

- 첫 방의 3·4·5개 순서 퍼즐을 풀고 열린 문 뒤 통로 끝까지 걸으면 `TwinBalanceTemple`로 자동 이동한다.
- 기존 웹 퍼즐의 무게 1·2·3·4인 상자 네 개를 이식했다. 숫자 정답판 없이 두 판에 각각 두 개씩 놓고 총무게를 같게 맞춘다.
- 각 판의 빛이 총무게만큼 차며 무거운 판이 내려간다. 성공하면 표시가 금색이 되고 문이 열린다.
- E로 들기·놓기, Q로 바닥에 내려놓기, 운반 자세, 다시 놓기, 행성 복귀를 연결했다.
- 초기화는 들고 있는 상자도 해제하고 플레이어를 입구로 돌려보낸다. 문 뒤에서 초기화해도 갇히지 않는다.
- 기존 Blender 원본은 보존하고 `hall_twin`과 `twin_scale`을 추가로 FBX로 내보냈다. 첫 방의 조명·UI·캐릭터를 재사용해 별도 장면을 생성했다.

## 검증

- Unity 6000.0.84f1 Windows 빌드 성공: `tmp/unity-twin-build.log`.
- `unity/check-temple.ps1` 실제 실행 검사 **345개 통과**.
- 첫 방 3·4·5개 풀이, 실제 문 충돌 및 통과, 두 번째 방 자동 진입 확인.
- 네 상자의 전체 배치 24가지를 검사해 균형을 만족하는 배치 8개만 성공함을 확인.
- 빈 판·부분 배치·틀린 2:2 배치는 잠김 유지. 중복 운반과 이미 찬 칸에 놓기 거절.
- 실제 이동·운반으로 틀린 배치를 만든 후 상자를 바닥에 내려놓고 서로 바꾸어 해결.
- 빛의 칸 갱신, 무거운 판의 하강, 성공 후 수평, 문 통과 확인.
- 마우스 입력 경로로 초기화 버튼 검사. 운반 중 및 문 통과 후 초기화, 행성 복귀 확인.
- 아래 세 실행 화면을 직접 확인했다. 검사 로그에서 예외·누락 글자·셰이더 오류가 발견되지 않았다.

증거: [검사 결과](unity-twin-temple/result.json), [실행 로그](unity-twin-temple/player.log).

### 시작

![두 번째 방 입장](unity-twin-temple/twin-entry.png)

### 틀린 배치

![빛의 높이가 다른 두 판](unity-twin-temple/twin-unbalanced.png)

### 균형 완성

![금색 표시와 열린 문](unity-twin-temple/twin-balanced.png)

## 실행과 범위

`unity/MumuPlanet/Builds/Windows/MumuPlanet.exe` 실행 → 시작 지점 앞 황금 문양에서 E → 첫 방 풀이 → 문 뒤 통로 끝으로 이동.

이번 작업은 두 번째 방까지다. 마지막 여섯 칸 지렛대, 신과의 만남, 자동 탈출·밀봉은 아직 이식하지 않았다. 두 번째 방의 끝에서도 이 상태를 안내한다. 진행 저장과 협동은 아직 연결하지 않았다. GitHub 업로드와 Vercel 배포는 이번 작업에서 수행하지 않았다.

## 재생성

1. Blender로 `tools/blender/export_unity_balance.py` 실행.
2. Unity `Mumu.Editor.BuildWeightTemple.RunBatch` 실행. 첫째·둘째 방과 Windows 빌드를 생성한다.
3. `./unity/check-temple.ps1 -OutputDirectory reports/2026-09-21/unity-twin-temple` 실행.

기존 수작업 장면을 보호하려면 생성 장면을 먼저 별도 복제한다.
