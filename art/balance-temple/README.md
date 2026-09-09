# 균형의 사당 Blender 원본 v02

[balance-temple-v02.blend](balance-temple-v02.blend)는 개별 건축·장치 부품을 편집할 수 있는 원본이다. [게임용 GLB](../../assets/models/balance-temple-v02.glb)는 같은 부모의 메시를 재질별로 합쳤다. 천칭 가로대와 접시, 지레와 지지대, 문짝, 신의 석상은 별도 객체다.

Blender 4.5.3 LTS 포터블을 실제 실행해 만들었다. 생성 순서는 다음과 같다. 저장소 루트에서 실행한다.

```powershell
$blenderExe = '.integration/blender/runtime/blender-4.5.3-windows-x64/blender.exe'
& $blenderExe --background --factory-startup --python tools/blender/build_balance_temple.py
& $blenderExe --background --factory-startup --python tools/blender/refine_balance_temple.py
& $blenderExe --background --factory-startup --python tools/blender/polish_balance_guardian.py
```

세 스크립트는 순서대로 실행하는 제작 과정이며 기존 v02 파일을 다시 생성한다. 수동 편집본은 별도 버전으로 저장한다. 후속 스크립트만 반복 실행하면 장식이 중복될 수 있으므로 전체 재생성은 첫 스크립트부터 시작한다. `.blend1` 백업은 Git에서 제외한다.

게임 좌표 `(x,y,z)`를 Blender `(x,-z,y)`로 바꿔 만들고 Y-up glTF로 내보낸다. 모델 원점과 장치별 회전축을 유지한다. 모델에는 게임 정답·저장 데이터가 들어 있지 않다.

최종 GLB: 6,588,236바이트, 메시 46개, 재질 6개, 삼각형 106,668개. 이는 재사용 부품 라이브러리 전체이며 실제 프레임 호출·삼각형 수와 다르다. 최초 8만 삼각형 목표를 초과하므로 저사양 실기기에서는 추가 최적화 여지가 있다.
