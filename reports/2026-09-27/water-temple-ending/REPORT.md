# 물의 신전 엔딩 연결 보고서

## 완성한 흐름

행성 돌산의 태양 거울로 신전 입구를 녹이면, 열린 문 앞에서 `E`를 눌러 물의 신전 첫 방에 입장한다. 얼음의 길 → 물 모으기 → 물의 순환을 마치면 물의 신을 만난다. 마지막 대화를 끝내면 **순환의 지혜**가 로컬 기록에 저장되고 화면이 전환되어 행성으로 자동 복귀한다. 복귀 위치는 봉인된 문 바깥 계단이다.

복귀 후에는 빙하 입구에 어두운 석재 봉인과 금빛 문양이 나타나며 재입장이 차단된다. 수첩에는 물의 상태 변화와 순환에서 배운 내용이 기록된다. 무게의 신전이 남았다면 길 안내가 그쪽을 가리키고, 두 신전이 끝났다면 완료 문구와 수첩 단축키를 보여 준다.

## 저장과 기존 기록

- 기존 `water-approach-v1.json`의 해빙 상태를 그대로 읽고 `completed` 값을 추가해 완료 상태를 기록한다.
- 기존 파일을 갱신할 때 이전 내용은 `.bak`으로 남긴다. 읽을 수 없거나 미래 버전인 기록은 덮어쓰지 않는다.
- 물 내부 진행 기록과 무게 신전 기록은 별도 파일이다. 회귀검사는 매번 새 경로를 써서 실제 플레이 기록을 건드리지 않는다.

## 확인한 결과

| 범위 | 결과 |
| --- | --- |
| Unity Windows 빌드 | 메인 게임과 물의 신전 전용 빌드 생성 성공 |
| 돌산·거울·해빙·첫 방 입장 | 148개 검사 통과 |
| 물의 신전 구간별 저장·재개 | 5단계, 32개 검사 통과 |
| 신의 대화·저장·복귀·봉인·수첩 | 28개 검사 통과 |
| 현재 퀘스트와 금가루 길 안내 | 2개 화면 크기, 각 18개 검사 통과 |
| 수첩 레이아웃·기록 | 3개 화면 크기, 각 1,180개 검사 통과 |

길 안내 설정을 기기에 저장하지 못해도 현재 플레이에서는 켜기·끄기가 유지된다. 완료된 물의 신전은 다시 입장할 수 없고, 기존에 쓰던 로컬 저장 파일은 회귀검사에 사용하지 않았다.

## 결과물

- 메인 게임: `unity/MumuPlanet/Builds/Windows/MumuPlanet.exe`
- 신전 전용 검증 빌드: `unity/MumuPlanet/Builds/WaterTempleJourney/WaterTempleJourney.exe`
- 자동 검사: `unity/check-water-mountain.ps1`, `unity/check-water-journey.ps1`, `unity/check-water-sanctuary.ps1`
- 실제 빌드 화면: `ending-verified/deity-audience.png`, `ending-verified/water-seal-after-return.png`, `quest-guide-final2/1440x900/03-planet-gold-path.png`
- 검사 결과: `ending-verified/sanctuary-result.json`, `entry-verified/result.json`, `quest-guide-final2/`, `notebook-final/`

이 작업의 대상은 Unity Windows 게임이다.
