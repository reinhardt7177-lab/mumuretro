# 균형의 신 · Blender 리디자인

기존 둥근 얼굴·각진 몸통의 임시 조형물을 교체한다. 먼저 제작한 `concept-v01.png`를 형태 기준으로 사용한다.

- 얼굴: 눈·코·입을 붙인 인형 대신, 길고 끝이 뾰족한 상아 가면과 가느다란 청록 눈빛.
- 실루엣: 길게 흐르는 주름, 겹어깨 망토, 다섯 왕관 첨탑, 세 겹의 황금 후광.
- 상징: 손가락이 실제로 걸쳐진 수평 저울과 양쪽 접시의 동일한 수정.
- 재질: 짙은 비취 석재, 상아색 돌, 오래된 금, 절제된 청록 발광.

## 파일과 재현

- `concept-v01.png`: 내장 image_gen으로 생성한 디자인 시안. 실제 게임 화면과 구분한다.
- `concept-prompt.txt`: 사용한 원문 프롬프트.
- `equilibrium-deity-v01.blend`: 수정 가능한 Blender 원본. 옷과 가면은 곡면 메시, 금선은 곡선 객체다.
- `blender-sculpture-v01.png`: 위 원본을 실제 Blender Cycles로 렌더한 이미지.
- `mesh-budget.json`: 실제 삼각형·재질 묶음 수.
- `../../tools/blender/build_balance_deity_v01.py`: 제작·렌더·내보내기 스크립트.

Blender 백그라운드에서 스크립트를 실행하면 원본·렌더·FBX·Unity용 JSON을 만든다. JSON은 평가된 면의 법선을 보존하며 재질별로 묶는다. Unity의 `BuildBalanceDeity`가 Editor API로 메시·재질을 생성한다. `BuildLeverTemple.CreateAndBuild`로 마지막 방과 Windows 실행판을 갱신한다.

기존 `balance-temple-v04`와 guardian FBX를 보존한다. 새 모델은 별도 경로를 사용하며, 퍼즐 판정·대화 내용·완료 저장 형식은 바꾸지 않는다. 정적 신전 조형물이며 인체 리깅이나 입 모양 애니메이션은 포함하지 않는다.

## Unity 적용 확인

최종 Windows 빌드와 766개 신전 검사를 통과했다. 실제 게임의 가면 시야·저울 접시와 대화창의 분리·왕관 잘림 여부도 검사했다. [최종 게임 화면](../../reports/2026-09-21/unity-balance-deity-framing/audience-dialogue.png)과 [검증 보고서](../../reports/2026-09-21/UNITY_BALANCE_DEITY.md)를 참고한다.
