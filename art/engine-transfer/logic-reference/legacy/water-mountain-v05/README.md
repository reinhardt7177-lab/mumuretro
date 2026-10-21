# 보관: 물의 신전 돌산 챕터 (v05, 2026-09-27 빌드)

2026-09-30에 게임에서 뺀 사암 절벽 등반·태양 거울·얼음 해빙 구간의 Unity 코드다. 지금 게임은 물의 신전 입구가 처음부터 열려 있고, 계단 위에서 `E`로 들어간다(`Assets/Mumu/Runtime/WaterSanctuaryEntrance.cs`).

| 파일 | 역할 |
|---|---|
| `Assets/Mumu/Editor/BuildWaterMountain.cs` | 돌산·거울·얼음 봉인과 신전을 함께 만들던 생성기 |
| `Assets/Mumu/Runtime/WaterMountainTrial.cs` | 등반 진행, 거울 조준, 해빙, 신전 입장 |
| `Assets/Mumu/Runtime/IceThawPresentation.cs` | 얼음 봉인이 녹는 연출 |
| `Assets/Mumu/Runtime/WaterMountainSmoke.cs` | 등반~해빙~입장 검사(-mumu-water-smoke) |
| `check-water-mountain.ps1` | 위 검사 실행 스크립트 |

남겨 둔 것:
- 매달리기·도약 컨트롤러 `MountainClimbController.cs`는 `OrbitCamera`·`NavigatorPose`가 참조하므로 프로젝트에 남아 있다. 장면에서는 쓰지 않는다.
- Blender 원본과 렌더(`art/water-temple-mountain/`, v02~v05)와 내보낸 JSON(`Assets/Mumu/Models/WaterMountain/water-mountain-v0*.json`, `solar-*.json`)은 그대로다.
- `Generated/WaterMountain/`의 자산은 두 종류다. 한 폴더에 섞여 있으니 폴더째 지우면 안 된다(2026-09-30 장면 GUID 대조).
  - 절벽·거울·제단 자산 85개: 장면이 참조하지 않아 빌드에 들어가지 않는다.
  - 20개: 지금 신전이 쓴다. 빙하 신전 메시 7개, 신전·빙하 재질, 지형 맞춤 기초, 물줄기 재질, 봉인 돌, 한글 글꼴 `WaterMountainKoreanV03.asset`이다.

되살리려면 위 `.cs`와 `.meta`를 같은 경로의 `Assets/`로 되돌린다. 그런 다음 `QuestGuide`와 `TempleEntrance`의 물 참조 타입을 다시 연결해야 한다. 지금은 두 곳 모두 `WaterSanctuaryEntrance`를 받는다. `WaterEntrySmoke`와 `WaterEndingSmoke`도 새 입구를 기준으로 고쳤다. 되돌리기 전의 전체 장면·빌드 백업은 `tmp/backup-2026-09-30-water-direct-entry/`에 있다(임시 폴더라 보존이 보장되지 않는다).
