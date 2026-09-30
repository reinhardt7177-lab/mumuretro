# Blender 에셋 디테일 점검 및 적용

2026-09-20 · 로컬 게임 적용. GitHub 업로드·Vercel 배포는 이번 작업에서 실행하지 않았다.

## 점검 결과와 실제 수정

기존 우주 범선의 목재·황동·청록 계열을 기준으로, 가까이에서 볼 때 구조가 드러나지 않는 소품을 먼저 손봤다. **Blender 4.5.3에서 모델을 직접 수정하고 GLB로 내보냈다.**

| 대상 | 발견한 부분 | 이번 변경 |
|---|---|---|
| 범선의 나무통 | 곧은 원통과 두꺼운 띠로만 구성 | 굽은 널빤지 16개, 쇠 테두리, 못, 뚜껑 이음매와 마개 |
| 선실·화물·선체 | 문과 창 주변, 화물 위가 단순함 | 파란 패널, 황동 문틀, 경첩·힌지 축, 나침반 문양, 감긴 로프, 현창 체결 장식 |
| 수첩 | 작은 표지 장식, 표지를 열 때 따로 남는 장식 | 가죽 바느질, 책등 띠, 종이 단면, 책갈피. 금속 장식을 움직이는 표지의 자식으로 연결 |
| 망원경 | 단순한 원통 실루엣 | 초점 조절부 홈, 황동 띠, 가죽 봉제선, 렌즈 테두리·안쪽 좌대 |
| 균형 신전 | 기둥 몸통·머리와 퍼즐 상자의 구조가 단순함 | 다섯 회랑의 기둥 홈·단층 받침, 등불 틀, 바닥 나침반 눈금, 상자 손잡이·못, 지렛대 축 장식 |
| 나머지 다섯 신전 | 입구에서 주제가 잘 드러나지 않음 | 물방울·달그림자·체·불꽃·지층 문양을 새긴 기둥을 각 입구에 두 개씩 배치 |

입구 표식은 각 신전의 석재 색을 사용한다. 추가 광원을 만들지 않으며, 그림자 퍼즐의 규칙을 혼동시키지 않도록 그림자를 투사하지 않는다. 표식에는 작은 충돌 반경을 추가했다. 범선의 기존 통·화물 충돌 범위, 퍼즐 장치의 움직이는 그룹, 캐릭터 소품 부착점은 유지했다.

## 실제 결과 확인

- [회전·확대 가능한 에셋 공방](http://127.0.0.1:5512/art/asset-upgrade/preview.html)
- [로컬 게임](http://127.0.0.1:5512/)

![범선의 통과 선실](asset-details/barrel-game.png)
![균형 신전](asset-details/balance-game.png)
![수첩과 망원경](asset-details/props-workshop.png)
![신전별 문양](asset-details/markers-workshop.png)

공방은 실제 게임용 GLB를 읽는 검수 화면이다. 게임과 조명·카메라가 다르므로 게임 내 밝기와 크기는 위 게임 화면에서 확인한다.

## 원본과 재생성

기존 버전 파일은 보존했다. 새 편집 원본은 내보내기용 메시 병합 전에 저장된다.

| 편집 원본 | 생성 스크립트 | 게임 적용 파일 |
|---|---|---|
| `art/starsail/starsail-v02.blend` | `tools/blender/refine_starsail_v02.py` | `assets/models/starsail-v02.glb` |
| `art/sky-navigator/navigator-props-v02.blend` | `tools/blender/refine_navigator_props_v02.py` | `assets/characters/sky-navigator/props-v02.glb` |
| `art/balance-temple/balance-temple-v04.blend` | `tools/blender/refine_balance_v04.py` | `assets/models/balance-temple-v04.glb` |

저장소 루트에서 아래 명령을 실행한다. 각 스크립트는 기존 v01 또는 v03을 읽어 새 버전을 만든다. 새 버전을 Blender에서 수동 편집했다면 재실행 전에 별도 버전으로 보관한다.

```powershell
& '.integration/blender/runtime/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --python tools/blender/refine_starsail_v02.py
& '.integration/blender/runtime/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --python tools/blender/refine_navigator_props_v02.py
& '.integration/blender/runtime/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --python tools/blender/refine_balance_v04.py
```

## 비용과 검증 범위

| GLB | 이전 → 현재 용량 | 이전 → 현재 삼각형 | 이전 → 현재 메시 |
|---|---:|---:|---:|
| 범선 v01 → v02 | 1.42 → 2.07 MB | 30,480 → 47,228 | 14 → 14 |
| 균형·문양 라이브러리 v03 → v04 | 6.99 → 10.36 MB | 112,892 → 189,852 | 51 → 68 |
| 소품 v01 → v02 | 0.20 → 0.41 MB | 2,904 → 7,172 | 18 → 12 |

라이브러리 전체 수치이며 실제 프레임의 드로우 콜이나 FPS가 아니다. 새 신전 표식 다섯 종류가 균형 라이브러리에 함께 들어 있고 각 신전은 필요한 것만 복제한다. 세 파일의 합계 용량은 약 4.23 MB 증가했다. 저사양 학생 기기에서의 FPS·발열은 별도 실기기 확인이 필요하다.

- 에셋 검사: 움직이는 그룹 이름, 수첩 표지 자식 연결, 여섯 신전 입구 실제 이동, 공방 네 화면, 로컬 리소스·JavaScript·셰이더 오류 확인. [결과](asset-details/report.json)
- 균형 회귀 검사: 3·4·5개 선택, 실제 5개 정렬, 양쪽 2개 균형, 받침점 이동과 6칸 지렛대, 상태 저장·잘못된 상태 거부, 신과 만난 뒤 자동 탈출·밀봉. [결과](asset-details/balance-regression.json)
- 캐릭터 검사: 이동 애니메이션, 상자 0번 들기, 활공, 수첩 들기·허리 복귀, 관절 유효값. [결과](asset-details/navigator-regression.json)
- 소스 검사: 132개 모듈, 328개 로컬 import, 19개 vendor 해시 통과.

검수 환경에서는 Google Fonts 요청이 차단되어 기본 글꼴로 표시됐다. 브라우저가 취소한 요청은 결과 파일의 `cancelledRequests`에 별도 기록했다. 필수 GLB는 이름·그룹 구조와 실제 렌더링으로 로드를 확인했고 로컬 HTTP 오류, JavaScript 예외, 셰이더 오류는 없었다.

이번 범위는 주요 소품과 건축 디테일 개선이다. 캐릭터 본체의 재모델링, 행성의 모든 나무·바위 교체, 나머지 다섯 신전의 퍼즐 장치 전체 재제작은 포함하지 않았다.
