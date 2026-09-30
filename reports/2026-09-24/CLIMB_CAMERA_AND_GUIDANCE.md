# 돌산 등반 카메라·안내 개선

## 적용 내용
- 매달린 동안 절벽 바깥쪽에서 캐릭터와 다음 손잡이를 함께 보는 카메라 구도 적용. 기존 카메라 충돌 회피 유지.
- 마우스 오른쪽 버튼으로 직접 회전하면 자동 구도를 2초간 쉬고, 이후 부드럽게 복귀.
- 도약 구간에서 Space 준비 시간을 막대로 표시. 0.35초 준비가 끝나면 청록색으로 변경. 방향 조작과 실패 후 재시도 규칙 유지.
- 물의 절벽·입구 주변에서만 물의 신전 안내 표시. 무관한 무게의 신전 하단 안내는 숨기고, 지역을 떠나면 복원.
- 수첩을 열면 등반 안내를 숨기는 기존 입력 잠금과 연동.

## 검증
- Unity 6000.0.84f1 Windows 빌드 성공: `unity/MumuPlanet/Logs/climb-presentation-v01.log`.
- 등반·돌길·태양 거울·얼음 해제·저장 및 신규 카메라/안내 검사 119개 통과: `climb-presentation-v01/result.json`.
- 기존 이동 실행 검사 통과: `climb-presentation-exploration/result.json`.
- 퀘스트 안내 검사 1440×900, 960×540 각 18개 통과: `climb-presentation-guide/`.
- 실제 카메라 캡처 `climb-presentation-v01/climb-assisted-camera.png`, `climb-presentation-v01/climb-leap-ready.png`를 육안 확인.

## 범위
이번 작업은 기존 돌산 등반의 시야와 안내를 개선했다. 돌산 모델을 교체하거나 물의 신전 내부를 새로 구현한 작업은 아니다. 자동 검사는 실제 사람의 조작 난이도 평가를 대체하지 않는다.
