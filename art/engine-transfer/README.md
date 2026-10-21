# 엔진 이전 자산 보관함

2026-10-02 사용자 결정으로 Unity 제작 자산을 Three.js 웹 게임으로 이전했다. Unity 프로젝트 삭제 전 재사용 원본과 참고 자료 **272개**의 복사본을 SHA-256으로 확인했다. 이곳은 실행 가능한 Unity 프로젝트가 아니다.

## 자료 구조

| 위치 | 용도 |
|---|---|
| `model-data/` | Blender에서 내보낸 원본 메시 JSON, FBX, 고해상도 텍스처와 이전 버전 |
| `logic-reference/` | C# 동작·퍼즐·검사·장면 생성 소스, 셰이더와 설계 기록 |
| `layout-reference/` | 제작한 장면의 배치 참고 자료 14개 |
| `render-reference/` | 기존 URP·조명·프로젝트 설정 참고 자료 |
| `animation-audio-reference/` | 항해사 동작 설정·Idle와 물 신전 문 열림 음원 |
| `fonts/` | 나눔고딕 원본과 OFL 라이선스 |
| `preservation.json` | 원래 위치, 보존 위치, 크기, SHA-256 기록 |

기존 `art/`의 `.blend`, 레퍼런스 이미지, 설계도, 제작 보고서는 그대로 남아 있다. `preservation.json`의 `source`는 삭제 전 원래 위치를 기록한 것으로, 해당 경로를 다시 만들라는 지시가 아니다. 참고 소스 안의 이전 엔진 경로와 작업 지침은 역사적 자료다. 현재 작업 지침은 저장소 루트 `AGENTS.md`를 따른다.

## 웹에서 사용하기

- 배포용 GLB 50개: `assets/models/heritage/`, 모델 목록: `manifest.json`.
- 상세 풀: 같은 폴더의 `leaf-profiles.json`.
- 나눔고딕·라이선스: `assets/fonts/`.
- 문 열림 음원: `assets/audio/heritage/water-gate-open.wav`.
- 로컬 검수실: `http://127.0.0.1:5512/tools/asset-library.html`.

원본 JSON은 이미 오른손 Y-up 좌표다. 추가로 축이나 삼각형 순서를 뒤집지 않는다. 모델은 표준 glTF 2.0으로 변환했고 문 좌우 경첩과 수첩 페이지를 독립 그룹으로 유지했다. 돌산·태양 거울의 앵커도 GLB `extras.anchors`에 보존했다. 문과 신전의 정면은 로컬 -Z다. 웹 사당의 입구가 +Z이므로 외관을 적용할 때 Y축으로 180도 회전한다.

## 다시 내보내기

```powershell
python tools/prepare-heritage-textures.py
node tools/migrate-unity-assets.cjs
node tools/check-heritage-assets.cjs
```

텍스처 준비 도구에는 Pillow가 필요하다. 브라우저 검사에는 로컬 5512 서버, Edge, Playwright와 `AUDIT_NODE_MODULES` 경로를 사용한다. Unity 폴더가 없어도 보존한 메시 원본에서 GLB를 다시 만들 수 있다. 이 도구는 Unity 프로젝트를 생성하거나 파일을 삭제하지 않는다.

물의 신은 최종 재베이크 노멀맵을 사용한다. 이전 노멀맵으로 되돌리지 않는다. 알베도·ORM은 웹용 2048 해상도로 변환했으며 고해상도 원본도 보존했다. 무거운 신·방 모델은 시작 시 모두 다운로드하지 않는다.

## 적용 범위

웹에 연결한 것은 신전 외관·균형의 신·물의 신·수첩 넘김·상세 풀이다. 전체 방·돌산·태양 거울·그림자 신전 키트는 웹에서 열 수 있는 자산으로 이전했다. Unity C# 퍼즐·등반·팔찌 기능을 Three.js에 전부 구현한 것은 아니다. 후속 구현에서는 참고 소스를 읽고 웹의 저장·입력·충돌 구조에 맞춰 옮긴다.

원본의 보존 해시는 이전 당시 기준이다. 이후 수정은 새 버전 파일로 만들고 변환 목록과 검사 근거를 갱신한다.

## GitHub 웹 배포 사본 · 2026-10-22

이 보관함의 대용량 `model-data/`와 일부 원본은 제작 PC에 그대로 보존한다. 이번 GitHub 웹 배포 커밋에는 실행에 필요한 `assets/models/heritage/` 전체와 가벼운 참고·보존 목록을 포함한다. 재내보내기·원본 해시 검사는 제작 PC 보관함이 필요하다. [배포 범위](../../DEPLOYMENT.md).
