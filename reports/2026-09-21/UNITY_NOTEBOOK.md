# 입체 탐사 수첩과 페이지 넘김

## 플레이

행성과 무게의 신전 세 방에서 오른쪽의 책 아이콘·‘수첩 [N]’을 누르거나 N 키로 펼친다. 밝은 종이와 큰 한글 글씨로 탐사일지, 실험 노트, 조작 안내를 읽는다.

아래 목차·이전/다음 버튼·좌우 방향키로 면을 바꾼다. Blender에서 제작한 종이가 책등을 중심으로 휘어 넘어가고 새 글이 나타난다. N·Esc·닫기 버튼으로 덮는다. 넘기는 중에 닫아도 조작 잠금이 남지 않도록 처리한다.

수첩을 읽는 동안 이동·카메라·상자 조작·초기화·방 이동을 막는다. 손에 든 상자는 유지한다. 신과의 대화나 정문이 열리는 연출 중에는 수첩을 열지 않는다.

## 기록

신전을 마치기 전에는 탐사 안내와 실험 힌트를 보여 준다. 균형의 신과의 만남을 마치고 귀환하면 실제 완료 기록을 읽어 배운 내용을 보여 준다. 게임을 다시 실행해도 기존 완료 기록으로 복원한다. 수첩을 읽는 동작이 완료 저장 파일을 덮어쓰지는 않는다.

## 제작

- [Blender 원본](../../art/explorer-notebook/explorer-notebook-v01.blend), [렌더](../../art/explorer-notebook/blender-notebook-v01.png), [재현 안내](../../art/explorer-notebook/README.md).
- `BuildNotebook.CreateAndBuild`: 저장된 네 장면에 UI·입체 책을 연결하고 Windows 빌드.
- `NotebookUI`: 페이지 내용과 입력 잠금. `NotebookPresentation`: 전용 카메라와 종이 변형.
- 전용 렌더는 수첩이 열려 있을 때만 동작한다. 페이지 넘김 중에만 850개 정점을 갱신한다.

## 검증

- Unity 6000.0.84f1 Windows 빌드 성공.
- 1440×900 미완료, 960×540 완료, 1920×868 완료 상태에서 각각 1,106개 검사 통과. 실제 클릭·키 입력·페이지 애니메이션·한글 글리프·화면 경계·상자 유지·입력 복원·저장 파일 보존을 확인했다.
- 무게 신전 전체 768개 검사와 별도 프로세스의 완료 저장·밀봉 복원 통과. 실제 신과의 만남 직후 수첩에도 배운 내용이 나타나는 것을 확인했다.
- 최종 플레이어 로그에서 예외·누락 글리프 경고가 없었다. 미완료·완료·넘김 화면을 직접 확인했다.
- [기본 화면](unity-notebook-final/uncompleted/PlanetExploration-journal.png), [넘기는 순간](unity-notebook-final/uncompleted/PlanetExploration-turn.png), [작은 화면](unity-notebook-final/completed/PlanetExploration-journal.png), [넓은 화면](unity-notebook-final/wide/PlanetExploration-journal.png).
- 재현: `unity/check-notebook.ps1` 및 `unity/check-temple.ps1`. 완료·미완료 검사는 별도 프로필에서 실행하여 사용자의 저장 기록을 건드리지 않았다.

## 현재 범위

Unity Windows용 수첩의 첫 연결이다. 웹의 지도·채집·조리 기록, 캐릭터 손에 쥐는 수첩 소품, 중간 퍼즐 저장, 협동·WebGL의 이식 완료를 뜻하지 않는다.
