# 곡선 풀잎 · Blender 원본

`meadow-leaves-v01.blend`는 Blender 4.5.3에서 생성한 풀잎 4종이다. 넓고 각진 평면 대신, 여섯 개 단면과 끝점을 연결해 잎의 곡선·처진 끝·얕게 접힌 중앙선을 표현한다. 잎별로 기울기와 꼬임이 다르다.

- 생성기: `tools/blender/build_meadow_leaves_v01.py`
- 잎 하나: 정점 19개, 삼각형 22개, 부드러운 법선
- `root_to_tip`: 뿌리 0부터 끝 1까지의 바람 가중치
- FBX: `unity/MumuPlanet/Assets/Mumu/Models/Meadow/meadow-leaves-v01.fbx`
- 실제 Unity 배치 입력: 같은 폴더의 `leaf-profiles.json`

JSON은 Blender 메시의 정점·삼각형·법선을 내보낸 것이다. Unity `BuildMeadow`가 이를 읽어 구면에 배치하며, 바람과 거리별 표시 제어는 기존 시스템을 사용한다. FBX와 .blend는 편집·교환용 원본이다. FBX 오브젝트의 나란한 배치는 비교를 위한 전시 위치이며 실제 게임에는 적용하지 않는다.

Blender 로컬 좌표 (x,y,z)를 Unity 로컬 좌표 (x,z,-y)로 내보낼 때 삼각형 감김도 한 번 바꾼다. 기존 행성 좌표 데이터의 변환과는 별개다.
