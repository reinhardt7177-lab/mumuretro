# 무게의 신전 외관

- 편집 원본: `weight-sanctuary-v01.blend`
- 실제 Blender 렌더: `weight-sanctuary-v01.png`
- 생성 스크립트: `tools/blender/build_temple_exterior_v01.py`
- Unity 데이터: `unity/MumuPlanet/Assets/Mumu/Models/TempleExterior/exterior.json`
- 교환용 모델: 같은 폴더의 `weight-sanctuary-v01.fbx`

내부 신전의 석재·황금·청록색을 이어받은 입구다. 저울 문양, 삼각 지붕, 돌 이음새, 홈이 있는 기둥, 황금 띠, 청록빛 정문과 등불, 양옆 폐허 기둥을 포함한다. 본체는 삼각형 12,236개, 재질 6개로 묶어 Unity에서 구성한다. 진입로 포석과 한글 명판은 Unity 배치 단계에서 추가한다.

높이 약 6.4m인 입구 건축물이며, 퍼즐 내부는 별도 장면이다. 기존 내부 신전의 Blender 원본은 수정하지 않는다. 진입로는 구형 행성 지면에 맞춰 생성하며 플레이어는 지면을 따라 이동한다. 계단 형태의 옆 기단은 충돌로 막고 중앙 접근로는 비운다.

생성 스크립트는 이 버전의 생성물을 재생성한다. 수작업으로 수정할 경우 별도 버전으로 복제해 보존한다.

## 입체 양개문 v02

- 원본: `weight-sanctuary-v02.blend` (v01 보존)
- 제작 스크립트: `tools/blender/build_temple_door_v02.py`
- Blender 렌더: `weight-door-v02.png`
- Unity 입력: `Assets/Mumu/Models/TempleExterior/exterior-v02.json`
- 교환용 모델: 같은 폴더의 `weight-sanctuary-v02.fbx`

기존 평면 포털을 두께 24cm의 양개문으로 교체했다. 청동 테두리, 음각 패널, 다이아몬드 장식, 경첩, 원형 손잡이와 중앙 저울 문양을 실제 메시로 만들었다. 문양과 후광도 좌우 문짝에 나뉘어 붙어 함께 움직인다. 전체 건물+문은 19,692 삼각형, 13개 재질 배치이며 Unity의 바닥 포장과 간판은 별도다.

Blender의 `Left door hinge` / `Right door hinge`를 편집 기준으로 사용한다. JSON은 각 문짝 경첩 기준의 로컬 정점과 Static/Left/Right 구분을 내보낸다. Unity에서 문짝의 FBX 변환값을 덮어쓰는 대신 동일한 경첩 위치에 독립 Transform을 생성한다.

재생성: Blender background에서 제작 스크립트 실행 후 `Mumu.Editor.BuildTempleExterior.CreateAndBuild`. `-- --skip-render`로 렌더만 생략할 수 있다. v01 원본 생성이 선행되어야 한다.
