# 물의 신전 v04 외형 보강

## 실제 변경

- 첫 방: 출구 벽의 층진 몰딩과 물 문양 부조, 저수조의 석조 받침, 수로 가장자리 마감.
- 두 번째 방: 회색 평면 배관을 둥근 청동 관·곡관·플랜지로 교체. 물받이에 외피·법랑·수위 눈금 추가. 집수판 외형을 20도 기울임.
- 계단 아래 수직 석재와 회랑 바닥 두께·받침을 보강. 아래층 바닥 타일과 뒤쪽 석조 벽 추가.
- 얼음 벽의 무작위 삼각형 색 배치를 제거하고 면 사이 명암을 연결. 청동 관에도 보간 노멀 적용.
- Blender v03 원본 보존, v04 별도 저장. 정적 메시 삼각형 수는 첫 방 115,168, 두 번째 방 152,720. 장식 콜라이더를 새로 추가하지 않음.

## 검증

초안 화면 검토 후 중복된 벽돌 96개를 제거하고 얼음 벽을 수정하여 최종 빌드를 다시 생성했다. 최종 Unity 빌드 종료 코드 0. 첫 구간 31개, 두 번째 구간 39개, 총 70개 자동 검사 통과. 각 구간의 `result.json`, `player.log`와 최종 게임 화면 두 장을 확인했다. 빌드 로그는 `unity/MumuPlanet/Logs/water-interior-v04-verified.log`다.

이 검사는 상태 구성·일부 실제 이동·화면 캡처를 포함하는 자동 회귀 검사다. 전체 구간의 사람 플레이 테스트나 다양한 PC에서의 성능 측정을 대신하지 않는다.

## 남은 차이

레퍼런스의 깊은 틈새 음영, 젖은 바닥의 반사, 투명한 얼음, 자연스러운 마모는 아직 충분하지 않다. 이번 버전은 임시 구조와 설비를 교체한 단계이며, 레퍼런스 수준의 최종 그래픽이라고 평가하지 않는다.

## 자료

- 원본: `art/glacier-water-temple/interior/v04/*.blend`
- 생성: `tools/blender/refine_water_interior_v04.py`
- 적용: `unity/MumuPlanet/Assets/Mumu/Editor/WaterInteriorArt.cs`
- 실제 게임 화면: `ice/ice-ready.png`, `collection/collector-aligned.png`
- 실행 파일: `unity/MumuPlanet/Builds/WaterTempleJourney/WaterTempleJourney.exe`

본편 행성 진입 장면이나 웹 배포는 이번 작업에서 변경하지 않았다.
