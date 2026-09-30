# 물의 신 V03

V02 시안을 바탕으로 얼굴·의상·머리카락의 형태와 재질을 보강하는 버전이다. V01/V02 원본은 유지한다.

## 제작 경로

1. 내장 image_gen으로 `front-input.png`를 생성한다. V02 인물의 정체성을 유지하고 후광·물방울을 분리했다. 실제 프롬프트는 `INPUT-PROMPT.md`에 있다.
2. 사용자 승인으로 이 입력을 Meshy 이미지→3D에 전송한다. `meshy-7.1`, 4K geometry, 8K texture, PBR, 게임용 약 100,000 삼각형 목표. 생성 소비량 40크레딧을 공급업체 상태 응답에서 확인했다.
3. `tools/meshy-water-deity.ps1`은 접수·조회·다운로드를 분리한다. 접수 전에 의도를 기록하여 응답 불명확 시 재접수를 막는다. 서명 URL은 Git에서 제외한 `.integration/meshy/water-deity-v03/`에만 저장한다.
4. `tools/blender/prepare_water_deity_v03.py`가 원본을 보존하고 밑면·높이를 정렬한 편집본, UV/법선 보존 JSON, Unity용 금속/매끄러움·차폐 텍스처를 준비한다.
5. `build_water_deity_halo_v03.py`가 별도의 장식 후광과 물방울을 제작한다.
6. `bake_water_deity_v03_normals.py`가 보존된 고밀도 조각으로 최종 메시 기준의 2K 노멀맵을 다시 굽는다. 이전 노멀맵은 얼굴 보완 후의 표면 기준과 맞지 않아 검은 삼각 자국을 만들었다. `water-deity-v03-final.blend`가 이 맵을 연결한 최종 편집본이며 이전 편집본은 보존한다.
7. Unity의 `WaterDeityV03Art`가 URP 재질과 텍스처를 연결한다. 새 노멀맵은 강도 1로 사용한다. `WaterDeityOfferingArt`는 후광과 분리한 물방울에 맑은 외피와 작은 내부 코어를 적용한다. `WaterSanctuarySmoke`의 정면·옆·뒤·얼굴 캡처와 기존 대화 검사를 사용한다.

최종 적용·검증 여부는 실제 결과 보고서를 확인한다. 생성 완료나 코드 작성만으로 품질 검수가 끝났다고 간주하지 않는다. 검수 기준은 `QUALITY-GATES.md`다.

최신 검수 기록: `reports/2026-09-27/water-deity-v03/REPORT.md`.

## 참고

- [Meshy 이미지→3D API](https://docs.meshy.ai/en/api/image-to-3d)
- [Meshy 요금](https://docs.meshy.ai/en/api/pricing)

원본 생성 8K와 게임용 텍스처 최대 4K는 구분한다. 8K 원본은 GLB와 Blender에 보존하며, 패킹할 데이터 맵은 먼저 4K로 줄여 불필요한 메모리 사용을 피한다.
