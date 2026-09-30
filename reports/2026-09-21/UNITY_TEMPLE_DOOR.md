# 무게의 신전 — Blender 양개문

## 변경 내용

기존의 평평한 청록색 포털을 입체 문짝 두 개로 교체했다. 24cm 두께의 몸체, 청동 테두리, 음각 패널, 손잡이, 경첩과 저울 문양을 Blender에서 제작했다. 원형 장식과 저울은 문 중앙에서 둘로 나뉘어 각 문짝과 함께 움직인다.

정문 가까이에서 E를 누르면 이동을 잠시 멈추고 양쪽 문이 안쪽으로 열린다. 1.45초 동안 부드럽게 94°까지 회전하고 .25초 뒤 첫 퍼즐 방으로 들어간다. 열리는 동안 재입력을 막으며, 신전에서 나오면 원래 위치로 돌아오고 문은 닫힌 상태로 복원된다. 별도 내부 장면으로 연결하는 입장 연출이다.

입구 석조 건물과 지면을 따라 배치한 포석은 유지했다. 문 앞 충돌을 실제 문짝 앞으로 맞췄다. 추가 실시간 조명이나 입자 효과는 사용하지 않았다. 건물과 문을 합쳐 19,692 삼각형, 13개 재질 배치이며 포석과 글자는 별도다. FPS 개선을 측정한 결과는 아니다.

## 원본과 재생성

- 원본: `art/temple-exterior/weight-sanctuary-v02.blend`
- 실제 Blender 렌더: `art/temple-exterior/weight-door-v02.png`
- 제작: `tools/blender/build_temple_door_v02.py`
- Unity 입력: `unity/MumuPlanet/Assets/Mumu/Models/TempleExterior/exterior-v02.json`
- 교환용 FBX: 같은 폴더의 `weight-sanctuary-v02.fbx`
- Unity 생성: `BuildTempleExterior.CreateAndBuild`
- 입장 제어: `TempleEntrance.cs`, 경첩 회전: `SanctuaryDoor.cs`

v01 원본과 기존 웹 버전은 보존했다. JSON은 문짝별 경첩 좌표로 정점을 내보내며 Unity Editor API로 메시·재질·장면을 생성한다. 재생성해도 같은 에셋 GUID를 유지한다.

## 검증

- Windows 빌드 성공: `tmp/unity-temple-door-final-build.log`, `MUMU_WINDOWS_BUILD_OK`.
- 새 문/외관 실행 검사 **56개 통과**: `unity-temple-door/result.json`. 재질·면 방향·삼각형 예산, 문 앞 충돌, 양쪽 경첩 회전, 중복 입력 차단, 이동 잠금, 입장/복귀/두 번째 입장을 검증했다.
- 기존 첫째·둘째 퍼즐 실행 검사 **345개 통과**: `unity-temple-door-puzzles/result.json`.
- 기존 이동·점프·애니메이션 검사 **54개 통과**: `unity-temple-door-movement/result.json`. 총 455개 실행 검사 통과.
- 게임에서 닫힌 문, 반쯤 열린 문, 완전히 열린 문 화면을 직접 확인했다. 아래 화면은 Blender 렌더가 아닌 Windows 플레이어 캡처다.

![게임의 입체 양개문](unity-temple-door/exterior-entrance.png)

![열리는 문과 함께 나뉘는 저울 장식](unity-temple-door/door-half-open.png)

이번 변경은 로컬 Unity Windows 빌드에 적용했다. 웹 배포 변경은 하지 않았다.
