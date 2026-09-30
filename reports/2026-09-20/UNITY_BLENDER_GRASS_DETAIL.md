# 블렌더 곡선 풀잎 교체

사용자가 표시한 잔디의 넓고 각진 실루엣을 개선하기 위해 Blender에서 풀잎 4종을 새로 제작했다.

## 적용

- 여섯 개 단면과 끝점을 연결한 잎: 19개 정점, 22개 삼각형.
- 폭이 서서히 변하는 가는 잎, 처지는 끝부분, 얕은 중앙 접힘, 형태별 꼬임과 곡선 차이.
- Blender의 실제 메시와 부드러운 법선을 JSON으로 내보내 Unity 구역 메시 생성에 사용한다. FBX와 편집 가능한 .blend도 보관한다.
- 기존 이삭 줄기와 바람·거리 표시 제어를 유지한다. 잎의 바람 가중치는 길이를 따라 0~1로 지정했다.
- 과도한 잎별 색 차이와 뿌리-끝의 명암 대비를 낮춘다. 잎의 단면 법선을 조명에 약하게 반영한다.
- 세밀한 메시의 부담을 줄이기 위해 배치 후보 밀도를 68개/m²에서 58개/m²로 조정했다. 실제 배치는 길·자연물·군락 마스크에 따라 줄어든다.

## 원본

- `art/meadow-leaves/meadow-leaves-v01.blend`
- `unity/MumuPlanet/Assets/Mumu/Models/Meadow/meadow-leaves-v01.fbx`
- `unity/MumuPlanet/Assets/Mumu/Models/Meadow/leaf-profiles.json`
- 재생성: `tools/blender/build_meadow_leaves_v01.py`
- Blender 비교 렌더: `tools/blender/preview_meadow_leaves.py`

적용 범위는 기존 시작 초원 약 40m이며 Windows 실행판 대상이다. WebGL과 기기별 FPS 측정은 별도 검증 대상이다.

## 검증 결과

- Blender 4.5.3에서 .blend와 FBX 생성 완료. Blender 비교 렌더를 직접 확인했다.
- Unity Windows 빌드 성공. 첫 빌드의 후처리 대기는 해당 프로세스만 재시작하여 복구했다.
- 블렌더 잎 164,620개, 이삭 9,886개를 181개 구역에 배치했다.
- 실제 실행판 검사 통과: 블렌더 메시 연결, 고정된 뿌리의 가중치, 이삭 연결, 셰이더 지원, 바람에 따른 렌더링 변화 및 같은 시점의 반복 재현.
- 이동·방향 전환·점프 등 탐사 회귀 검사 통과.
- 최종 게임 화면을 직접 확인했다. 가까운 잎의 폭이 줄었고 곡선과 처진 끝이 보인다.

[풀 검사](unity-blender-grass/result.json) · [탐사 검사](unity-blender-grass/exploration-regression/result.json)

![최종 게임 화면](unity-blender-grass/wind-a.png)
