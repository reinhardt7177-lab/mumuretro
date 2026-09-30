# Unity 우주 범선 도입부

## 플레이 흐름

게임을 시작하면 Blender 우주 범선 갑판에서 출발한다. 우현 회수 손잡이에서 `E`로 떠 있는 소포를 건져 올리고, 갑판에 내려온 소포를 `E`로 연다. 소포에서 낡은 수첩을 발견하면 입체 수첩이 자동으로 펼쳐진다. 수첩의 `3 · 5 · ?`와 덧셈 단서를 읽고 선미 숫자판 세 개를 각각 `E`로 돌려 `3 · 5 · 8`을 맞추면 항해대에서 출발할 수 있다.

수첩은 발견 전에는 열리지 않는다. 획득한 뒤에는 기존 행성과 무게의 신전에서도 사용할 수 있다. 숫자판은 정답 전까지 계속 수정할 수 있고, 정답을 맞추면 잠긴다.

## 제작

- 보존된 Blender 원본: [starsail-v02.blend](../../art/starsail/starsail-v02.blend)
- Unity용 내보내기: [export_unity_starsail.py](../../tools/blender/export_unity_starsail.py)
- 장면 생성: `Mumu.Editor.BuildStarsailIntro.CreateAndBuild`
- 진행 제어: `StarsailIntro`; Unity 시작 장면은 `StarsailIntro`다.
- 별과 행성은 생성 자산이다. 소포 회수·뚜껑 개방·출항 화면 전환을 장면에서 재생한다.
- 범선 진행은 별도 로컬 파일 `starsail-intro-v1.json`에 저장된다. 소포·수첩·세 숫자·출항 상태를 복원하며, 출항 후 재실행하면 행성에서 시작한다. 기존 무게 신전 저장과 웹 저장은 건드리지 않는다.

## 검증

Unity 6000.0.84f1 Windows 빌드 성공. `unity/check-starsail.ps1`의 14개 플레이 흐름 검사가 모두 통과했다. 수첩은 1440×900, 960×540, 1920×868에서 각각 1,106개 검사를 통과했다. 무게 신전 전체 768개 검사와 별도 실행에서의 완료 기록·밀봉 복원이 통과했고, 행성 이동 검사도 통과했다. 검사에는 사용자 완료 기록과 분리된 파일을 사용했다.

최종 실행판 화면을 직접 확인했다: [범선 첫 화면](unity-starsail-verified/01-starsail-deck.png), [건져 올린 소포](unity-starsail-verified/02-recovered-parcel.png), [수첩 발견](unity-starsail-verified/03-found-notebook.png), [행성 도착](unity-starsail-verified/04-planet-arrival.png). 범선은 Blender 원본의 갑판·돛대·선실·난간·회수 손잡이를 사용한다. 전용 우주 배경에 별과 목표 행성을 배치했다. 로그에서 새 컴파일 오류와 실행 예외를 찾지 못했다.

2026-09-23 추가 검증: 최종 Windows 빌드에서 범선 퍼즐 36개 검사와 별도 프로세스 재실행 복원 4개 검사가 모두 통과했다. 숫자판 오답·정답, 수첩의 단서, 중간 다이얼 저장, 출항 후 행성 복원을 확인했다. [숫자판](unity-starsail-course-ordered/05-solved-course.png), [수첩 단서](unity-starsail-course-ordered/03-found-notebook.png) 화면을 확인해 `3 · 5 · 8`이 왼쪽부터 정방향으로 보이고 수첩 하단 문구가 도입부에 맞게 바뀐 것을 확인했다. 황금가루 퀘스트 안내와 신전 중간 저장은 다음 연결 작업이다.
