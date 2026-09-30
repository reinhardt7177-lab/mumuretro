# 무게의 신전 중간 진행 저장

무게의 신전 세 방에서 퍼즐을 멈추고 게임을 닫아도 진행 중이던 방과 배치가 복원된다. 행성으로 나갔다가 다시 정문으로 들어와도 같은 방에서 이어진다. 재시작 시 캐릭터는 방 입구에 서며, 들고 있던 상자는 다시 들기 전 자리에 둔다.

- 첫 방: 3·4·5개 선택, 각 상자의 받침대·저울·바닥 위치.
- 두 번째 방: 네 상자의 두 판·바닥 위치.
- 마지막 방: 두 추의 지렛대·바닥 위치와 지지대 위치.
- 신과의 만남으로 완료 기록을 저장하면 중간 진행은 종료되고, 기존 영구 밀봉 기록이 우선한다.

저장 파일은 기존 `temple-completion-v1.json`과 분리한 `temple-journey-v1.json`이다. 읽을 수 없거나 새 버전인 파일은 덮어쓰지 않는다. 검사 실행은 별도 파일을 사용하므로 실제 플레이 기록을 변경하지 않는다. 플레이어의 방 안 세부 좌표와 들고 이동하던 도중의 정확한 위치는 저장하지 않는다.

## 실행 확인

- 최종 Windows 실행판 빌드 성공: `tmp/unity-journey-final-build.log`의 `MUMU_WINDOWS_BUILD_OK`.
- 별도 프로세스에서 세 방을 각각 두 번 실행해 저장 상태 복원과 다시 저장을 검사: 무게 18+17, 두 판 17+15, 지렛대 15+13개 통과. 결과는 `reports/2026-09-23/unity-temple-journey-final/`.
- 기존 신전 전체 동선 768개 통과. 완료 후 별도 프로세스에서 정문 밀봉 유지 확인. 결과와 장면 캡처는 `reports/2026-09-23/unity-temple-journey-final-regression/`.

실행 파일: `unity/MumuPlanet/Builds/Windows/MumuPlanet.exe`. 검사 명령: `unity/check-temple-journey.ps1`, `unity/check-temple.ps1`.
