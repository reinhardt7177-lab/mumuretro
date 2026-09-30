# 균형의 신 조형 리디자인

## 변경 이유와 결과

기존 신의 둥근 얼굴과 단순한 원통형 옷·각진 팔이 임시 인형처럼 보였다. 먼저 이미지 시안을 만든 뒤 Blender에서 새 조형물을 제작했다.

- 길고 뾰족한 가면과 은은한 눈빛, 다섯 왕관 첨탑.
- 실제 두께가 있는 겹어깨 장식, 휘어진 망토와 세로 주름, 금빛 가장자리.
- 자연스럽게 굽힌 팔과 분리된 손가락, 손으로 받치는 수평 저울.
- 체인에 매달린 두 접시와 같은 크기의 청록 수정, 세 겹의 황금 후광.
- 대화 카메라는 방 안에 유지하고 시야각을 56도로 넓혀 왕관과 양쪽 저울을 함께 보여 준다. 대화 종료 시 원래 시야각을 복원한다.

## 산출물

- [생성 시안](../../art/balance-deity/concept-v01.png): 내장 image_gen으로 생성. 실제 모델 렌더와 구분한다.
- [실제 Blender 렌더](../../art/balance-deity/blender-sculpture-v01.png).
- [Blender 원본](../../art/balance-deity/equilibrium-deity-v01.blend).
- [프롬프트](../../art/balance-deity/concept-prompt.txt), [재현 설명](../../art/balance-deity/README.md).

시안의 실루엣·재질 구분·균형 상징을 실제 메시로 옮겼다. 생성 이미지의 모든 표면 무늬를 그대로 재현한 것은 아니다. 현재 모델은 정적 조형물이며 말하는 얼굴 리깅은 포함하지 않는다.

## 성능과 보존

모델은 90,300개 삼각형, 재질별 6개 메시로 내보냈다. Blender의 252개 편집 객체를 Unity에서 각각 렌더링하지 않는다. 추가 실시간 조명·파티클 시스템은 없다. 실제 프레임 속도 벤치마크와 WebGL 검증은 별도다.

기존 웹 게임과 v04 Blender/guardian FBX는 보존하고 새 경로를 사용한다. Unity Editor API가 자산을 생성하며 기존 생성 자산의 GUID는 유지한다. 퍼즐 판정·대화 내용·완료 저장 형식은 유지한다.

## 검증

Blender 제작·렌더, Unity 적용, 최종 Windows 빌드를 완료했다. **766개 신전 검사**와 별도 프로세스의 봉인 복원 검사가 통과했다.

가면까지의 시야가 벽에 막히지 않는지, 두 접시가 대화창 위 화면 안에 들어오는지, 왕관이 잘리지 않는지를 실행 검사에 추가했다. 최종 게임 캡처를 직접 확인해 가면·망토·저울·후광과 한글 대화창이 표시되는 것을 검증했다.

- 최종 실행 증거: [unity-balance-deity-framing](unity-balance-deity-framing/).
- 최종 빌드 로그: `tmp/unity-deity-framing-build.log` (정상 종료 0).
- 이전 카메라 시도의 중간 결과는 별도 폴더에 남겨 두었으며 위 최종 증거를 기준으로 한다.

![실제 Windows 게임 화면](unity-balance-deity-framing/audience-dialogue.png)
