# 카메라·후처리 최적화 · 2026-10-29

현재 웹 버전의 성능만 수정했다. 큰 지형·추가 그래픽 제작을 재개하지 않았으며 기존 장기 개선 목표는 일시중지 상태다. **런타임 3개 파일을 수정하고 나머지 473개 실행 파일의 SHA-256 일치를 확인했다.** 모델·텍스처·퍼즐·저장 형식·화질 단수는 유지했다.

## 적용한 변경

1. `PlanetCameraOcclusion.js`: 원본 메시별로 인스턴스를 묶어 부모의 표시 상태를 질의당 한 번 확인한다. 숨긴 배치는 인스턴스 전체를 건너뛴다. 원래 반환 순서·구체 경계·삼각형 광선 검사를 유지하고, 프레임 사이의 표시 상태를 캐시하지 않는다.
2. `Engine.js`: 목표 카메라와 보간된 카메라의 두 광선 검사에 필요한 장애물 행렬을 한 번 준비한다. 벽 관통 방지를 위한 두 광선 검사는 모두 유지한다.
3. `Post.js`: 채도·대비·비네트 연산을 고정 Three r160 `OutputPass`의 RawShaderMaterial에 합쳐 전체화면 패스를 하나 줄였다. 기존 톤매핑·색공간·노출·블룸·MSAA·화면 크기 대응과 `grade.uniforms` API를 유지한다. 과거 ShaderMaterial 통합 실패의 원본·주석도 보존했다.

## 실제 성능 비교

Edge 156.0.4314.50, 이 PC의 준비된 착륙지 정면, 1280×800·DPR1·중간 화질에서 **원본→수정→수정→원본(ABBA)** 4회 측정했다. 각 40rAF 예열 후 120rAF, 총 480개 실제 표본이다. 수정 전 소스는 별도 보존본으로 제공하고 각 실행에서 실제 응답 SHA를 확인했다. 카메라와 배우 위치 오차는 0이었다.

| 항목 | 원본 | 수정 |
|---|---:|---:|
| 평균 rAF 간격 | 27.99ms | 25.90ms |
| rAF p95 | 33.50ms | 33.50ms |
| JS 게임 갱신 평균 | 2.99ms | 2.69ms |
| 렌더 제출 반환까지 평균 | 7.94ms | 6.96ms |
| 제출 호출 | 453 | 452 |
| 제출 삼각형 | 3,277,274 | 3,277,273 |

반복별 평균 rAF는 원본 29.17/26.81ms, 수정 26.39/25.41ms다. 평균은 약 7.5% 줄었지만 p95는 같고 수정 측정에는 66.7ms 한 프레임이 있었다. 매 프레임이 빨라졌거나 끊김이 모두 해결됐다는 뜻은 아니다. 마지막 삼각형 1개 감소는 전체화면 패스 제거에 따른 것이며 월드 모델의 면을 삭제하지 않았다.

계측 CPU 프로파일에서 확인한 카메라 broad phase는 11,816개 항목을 다뤘다. 이 프로파일은 원인 파악용 동기 실행으로 위 rAF 벤치마크와 조건이 다르며 FPS 근거로 사용하지 않는다. 렌더 제출 시간은 GPU 완료 시간이 아니다. 실제 학교 기기·다른 지역·전체 게임 성능은 측정하지 않았다.

## 외형과 동작 검증

- 같은 페이지에서 원본/후처리 후보를 교대로 그린 실제 RGBA 비교 21조건이 통과했다. 네 화질×세 시점, 390×844 세로·844×390 짧은 가로, 7개 look profile을 포함한다. 최대 채널 차이는 1/255이고, 각 구현의 반복 차이는 0이다. 중간 렌더 타깃 하나를 거치지 않아 픽셀 완전 동일은 아니다.
- 모든 조건에서 호출 1회가 줄었고, 캔버스·composer·블룸 버퍼와 high MSAA 4가 유지됐다. 별도 contrast 고장은 최대 118/255 차이로 픽셀 검사에서 실패했다. 7개 실내 profile 검사는 같은 행성 씬에 색 설정을 적용한 것으로 실제 여섯 신전 진입 검증과 구분한다.
- 고정 Three의 원본 카메라 질의와 65개 질의·513개 실제 삼각형 광선을 대조했다. 숨김/복원·인스턴스 개수·이동한 부모·경계 변화·반환 순서를 확인했다. 반환을 일부러 제거한 고장도 검출했다.
- 실제 `Engine.updateCamera` 메서드는 원본과 별도로 77회 대조했다. 얇은 벽·보간·움직인 부모·고저차·활공 FOV에서 카메라와 충돌 결과가 같고 장애물 행렬 준비는186→93회였다. 두 번째 광선을 제거한 고장은 얇은 벽 보간의 실제 카메라 위치 차이로 검출했다. 이 검사는 생성자와 환경맵을 제외한 고정 Three 단위 시나리오다.
- 실제 키보드·터치 입력 각 7검사를 통과했다. 수첩 일시정지, 점프/착지, 내림판에서 걷기와 복귀, 범선 상호작용, 격리된 저장의 재접속 복원, 브라우저 예외를 확인했다. 준비된 진행으로 시작하며 연속 전게임 완주는 아니다.
- 소스 217모듈·629로컬 import·19 vendor 해시, 격리 메모리 저장·음향 검사를 통과했다. 첫 카메라 단위검사 호출의 누락된 Node VM 플래그 오류는 별도 로그로 남기고 올바른 명령으로 재실행했다.

## 근거와 현재 상태

- [성능 원자료](evidence/runtime-optimization/performance.json) · [원인 프로파일](evidence/runtime-optimization/baseline-profile.json)
- [후처리 원본·21조건·지정 고장](evidence/runtime-optimization/POST_OPTIMIZATION.md)
- [카메라 질의 비교](evidence/runtime-optimization/camera-grouped.log) · [카메라 지정 고장](evidence/runtime-optimization/camera-grouped-fault.log)
- [카메라 이동·행렬 비교](evidence/runtime-optimization/camera-matrix-reuse-normal-1793248244997-6416.json) · [두 번째 광선 제거 고장](evidence/runtime-optimization/camera-matrix-reuse-fault-1793248249833-24304.json)
- [PC 입력·저장](evidence/runtime-optimization/input/pc-input.json) · [터치 입력·저장](evidence/runtime-optimization/input/touch-input.json)
- [런타임 보존·수정 파일 해시](evidence/runtime-optimization/runtime-preservation.json) · [수정 전 소스](evidence/runtime-optimization/before/)
- [현재 실제 게임 캡처](evidence/runtime-optimization/after-measured.png)
- [최종 증거 인덱스](evidence/runtime-optimization/final-validation.json)

로컬 소스에 적용했다. 이전에 정리한 `dist/`를 다시 만들지 않았고 GitHub 업로드·Vercel 배포도 수행하지 않았다. 이미 열려 있던 플레이 창은 새로고침해야 새 소스를 사용한다. 개인 사용자 저장으로 검사하지 않았다.
