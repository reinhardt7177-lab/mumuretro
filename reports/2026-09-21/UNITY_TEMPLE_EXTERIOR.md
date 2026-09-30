# 무게의 신전 외관 완성

2026-09-21 · Unity 6000.0.84f1 · Windows 로컬 빌드

## 변경

임시 원형 받침대를 Blender로 만든 석조 신전 입구로 교체했다. 저울 문양과 삼각 지붕, 돌 이음새, 기둥의 홈, 금빛 테두리, 청록빛 정문·등불, 작은 폐허 기둥을 포함한다.

큰 건물이 기존 탐사 길을 막지 않도록 시작 위치에서 앞으로 9m, 왼쪽으로 6.5m 떨어진 지점에 배치했다. 중앙 진입로의 포석은 지면을 촘촘히 샘플링해 맞추고, 양쪽 기단과 벽은 충돌로 막았다. 정문 앞에서 E를 눌러 입장하며, 문에 바짝 붙어 있어도 입장할 수 있다. 뒤나 옆에서는 입장되지 않는다.

Blender 본체는 삼각형 12,236개와 재질 6개로 묶었다. 포석과 한글 명판은 Unity에서 추가한다. 별도 실시간 조명이나 입자 효과를 추가하지 않았다. FPS 개선을 측정한 작업은 아니다.

## 실제 화면

![최종 외관](unity-temple-exterior-final/exterior-overview.png)

![정문 입장](unity-temple-exterior-final/exterior-entrance.png)

## 검증

| 검사 | 결과 |
|---|---|
| 최종 Windows 빌드 | 성공 |
| 최종 포석을 포함한 외관·입장 검사 | 32개 통과 |
| 배치 조정 후 기존 이동·애니메이션·탐사 경로 | 54개 통과 |
| 외관·정문 실제 실행 화면 | 직접 확인 |

외관 검사는 재질·면 방향·삼각형 예산, 기둥과 문 충돌, 포석 접근, 정문 앞 입장, 뒤·옆 입장 거절, 첫 방 연결, 행성 복귀를 확인한다. 기존 이동 검사의 코드는 바꾸지 않았으며 건물 위치를 조정해 탐사 길을 유지했다. 마지막 포석 보정은 시각 메시만 변경했고, 이동 및 충돌 코드는 동일하다.

- [외관 검사 결과](unity-temple-exterior-final/result.json)
- [외관 실행 로그](unity-temple-exterior-final/player.log)
- [이동 검사 결과](unity-exterior-movement-final/result.json)
- [이동 실행 로그](unity-exterior-movement-final/player.log)
- 최종 빌드 로그: `tmp/unity-exterior-paving-recovered-build.log`

## 원본과 재생성

- 원본: `art/temple-exterior/weight-sanctuary-v01.blend`
- Blender 생성·내보내기: `tools/blender/build_temple_exterior_v01.py`
- 게임용 데이터와 FBX: `unity/MumuPlanet/Assets/Mumu/Models/TempleExterior`
- 장면 갱신·빌드: `Mumu.Editor.BuildTempleExterior.CreateAndBuild`
- 검사: `unity/check-exterior.ps1`

기존 내부 신전의 Blender 원본은 보존했다. 전체 신전 재생성에서도 새 외관을 유지한다. Blender의 `(x,z,-y)` 변환은 회전이므로 삼각형 순서를 유지해야 한다. 반대로 뒤집으면 표면이 안쪽을 향한다. 이 사항은 실행 검사에도 포함했다.

## 범위

이번 작업은 외관과 입장 동선이다. 첫째·둘째 방의 퍼즐은 그대로 연결되며, 마지막 지렛대 방·신과의 만남·자동 탈출·밀봉은 다음 작업이다. GitHub 업로드, Vercel 배포 및 Unity WebGL 검증은 이번 작업에서 수행하지 않았다.
