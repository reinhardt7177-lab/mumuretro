# 행성 자연물 · Blender v01

- [편집 원본](planet-nature-v01.blend)
- [게임용 GLB](../../assets/models/planet-nature-v01.glb): 234,864바이트
- [생성 스크립트](../../tools/blender/build_planet_nature_v01.py)
- [회전 미리보기](http://127.0.0.1:5512/art/asset-upgrade/preview.html?view=nature)
- [맵 적용·검증 보고서](../../reports/2026-09-20/PLANET_DETAIL_UPGRADE.md)

`trunk`, `canopyA`, `canopyB`, `rockA`, `rockB`, `bush`, `trail_stone`, `survey_base`를 재사용한다. 좌표는 게임 Y-up 기준이며, Blender에서는 `(x,-z,y)`로 변환한다. 자연물의 재질 색은 게임에서 바이옴 색과 곱해진다. 공방에서도 동일한 색 곱을 적용하되 조명은 게임과 다르다.

원본은 병합 전에 저장한다. 재생성은 저장소 루트에서 다음과 같이 실행한다. 수동 편집한 원본이 있다면 먼저 v02 등으로 보관한다.

```powershell
& '.integration/blender/runtime/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --python tools/blender/build_planet_nature_v01.py
```

높음·중간 화질에서는 새 모델을, 낮음·가장 낮음에서는 기존 절차 모델을 사용한다. 배치와 충돌체는 같은 것을 유지하고 메시의 형상만 바꾼다. 새 파일을 불러오지 못하면 기존 모델로 진행한다.
