# 탐사 수첩 · Blender 원본

게임에서 직접 펼쳐 읽는 입체 수첩이다. 비취색 가죽 표지, 금장 모서리, 책등, 겹친 종이 단면, 붉은 책갈피를 포함한다.

- `explorer-notebook-v01.blend`: 수정 가능한 제작 원본.
- `blender-notebook-v01.png`: 실제 Blender Cycles 렌더.
- `mesh-budget.json`: 6,852개 삼각형, 재질·부품별 6개 메시 묶음. 넘김 페이지는 850개 정점.
- 생성: `tools/blender/build_explorer_notebook_v01.py`를 Blender 백그라운드로 실행.
- Unity 내보내기: `Assets/Mumu/Models/Notebook/notebook-v01.json`.

고정된 책과 넘기는 종이를 분리했다. 종이의 중심축은 책등에 있고, Unity가 메시를 부드럽게 구부리면서 회전시킨다. 한 페이지를 넘기는 시간은 0.58초다.

글씨는 모델에 작은 이미지로 구워 넣지 않는다. 선명한 한글 TextMeshPro UI를 종이 위에 배치하고, 책장이 움직일 동안 잠깐 숨겼다가 새 내용을 표시한다. 수첩을 닫으면 전용 카메라를 끄고 RenderTexture를 해제한다.

원본 웹 수첩은 유지한다. 현재 Unity 수첩은 탐사일지·실험 노트·조작 안내와 무게 신전 완료 기록을 다루며, 웹의 채집·조리·지도 전체가 이식된 것은 아니다.
