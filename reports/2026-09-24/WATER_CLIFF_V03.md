# 1번 사암 절벽 · 구현 및 검증

## 결과

선택한 1번 시안의 층진 사암·이끼 덮인 선반을 기준으로 Blender v03 모델을 만들고 Unity의 기존 행성에 통합했다. 상세 계획, 정면/측면 동선 배치도, 편집 가능한 Blender 원본, Windows 실행판을 함께 남겼다.

- 상세 설계: `../../art/water-temple-mountain/DESIGN-v03.md`
- 동선 설계도: `../../art/water-temple-mountain/traversal-blueprint-v03.svg`
- Blender 원본: `../../art/water-temple-mountain/water-mountain-v03.blend`
- 모델 렌더: `../../art/water-temple-mountain/water-mountain-blender-v03.png`
- 실행판: `../../unity/MumuPlanet/Builds/Windows/MumuPlanet.exe`

## 실제 연결한 동작

E로 첫 손잡이를 잡고 위/옆으로 이동한다. 갈라진 구간은 W+D 방향과 0.35초 이상의 Space 준비 후 키를 놓아야 건넌다. 잘못된 방향 또는 짧은 준비는 낙하 후 재시도로 이어지고 실패 이유가 표시된다. 첫 선반에서 일반 이동을 되찾고, 좁은 경사 선반과 중간 쉼터를 거쳐 정상 벽을 오른다. 체크포인트는 실제로 밟은 곳만 기록한다. 정상에서는 태양 거울을 조절해 얼음을 녹이고 입구 해제를 로컬 저장한다.

Blender JSON이 손잡이·선반·거울 좌표의 공통 원본이다. 이전 v02 파일은 보존했다. 모델과 충돌의 높이가 달라지는 것을 막기 위해 돌산의 실제 메시에도 충돌을 적용했다. 경사면과 낮은 턱을 벽으로 처리하던 이동 문제, 정상 직전 바위 간섭, 빛 경로를 가리는 수목 및 거울 위치를 실행판 검사로 조정했다.

## 검증 근거

| 검사 | 결과 | 근거 |
|---|---|---|
| Unity Windows 빌드 | 성공 | `unity/MumuPlanet/Logs/water-mountain-v03-light.log` |
| 돌산 통합 검사 | 79개 통과 | `water-mountain-v03-light/result.json` |
| 기존 탐사/이동 검사 | 통과 | `water-v03-exploration/result.json` |
| 길 안내·수첩 1440×900 | 18개 통과 | `water-v03-guide-verified/1440x900/guide-result.json` |
| 길 안내·수첩 960×540 | 18개 통과 | `water-v03-guide-verified/960x540/guide-result.json` |

돌산 검사에는 잘못된 도약·짧은 준비·재시도·중복 입력·실제 이동 함수로 네 구간 걷기·방문 체크포인트·매달림 해제·정상 거울·빛 충돌·얼음 해제·별도 기록 파일 저장이 포함된다. 일반 탐사 검사는 `passed: true` 형식으로 결과를 제공한다. 길 안내의 첫 제한 환경 실행에서는 Windows 설정 저장이 차단되어 실패했고, 일반 권한 환경에서 두 해상도 모두 재검증했다.

실제 화면:

![게임의 돌산과 얼음 신전](water-mountain-v03-light/water-mountain-overview.png)

![정상에서 신전으로 보내는 빛](water-mountain-v03-light/water-mirror-beam.png)

## 범위와 남은 품질 확인

이번 결과는 외부 등반 구간의 플레이 가능한 1차 구현이다. 시안의 지층과 색상 방향을 반영한 스타일화 모델이며, 시안과 동일한 세밀한 텍스처나 언챠티드 수준의 전신 접촉 애니메이션을 구현한 것은 아니다. 기존 절차적 매달림 포즈를 사용한다. 실제 학생이 느끼는 난이도·첫 플레이 시간은 별도 플레이테스트가 필요하다.

물의 신전 내부 퍼즐, 패드/모바일 입력, 협동 플레이와 WebGL은 이번 검증 범위에 포함하지 않는다. GitHub 업로드나 배포는 수행하지 않았다.
