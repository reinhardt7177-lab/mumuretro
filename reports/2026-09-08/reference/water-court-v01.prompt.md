# 물 사당 레퍼런스 01 — 생성 기록

- 방식: 내장 `image_gen` 도구. CLI/API 별도 호출 없음.
- 용도: 구현 전 미술 목표와 화면 구성 검토. 실제 게임 캡처가 아님.
- 결과: [water-court-v01.png](water-court-v01.png)
- 입력 1: [기존 물 사당 화면](../evidence/shrine-4.png) — 캐릭터·사당 정체성 참고.
- 입력 2: [기존 바람고개 화면](../evidence/expedition/expedition-overlook.png) — 탐험가 복장·활공막 참고.
- 새 콘셉트 이미지 생성이며 기존 캡처는 보존했다.

## 최종 프롬프트

```text
Use case: stylized-concept
Asset type: production visual target board for an existing browser 3D exploration and science puzzle game, "무무 행성". This is proposed concept art, not an actual screenshot.

Input images:
Image 1 (current water shrine screenshot): reference for the existing playable explorer's identity, small stylized scale, accessible third-person framing, and water/stone shrine identity. Transform its repetitive flat corridor into a beautiful designed courtyard.
Image 2 (current outdoor overlook screenshot): reference for the same explorer's brown broad-brimmed hat, olive explorer clothing, orange scarf and cream folded sail. Retain this original explorer identity; improve material/color/art direction.

Primary request:
Create ONE polished landscape 3:2 art-direction board, beautifully readable at desktop size, with a large dominant third-person gameplay concept view on the top approximately 70%, and TWO supporting panels below: an elevated route view and a close-up of the temperature/valve puzzle. Small tasteful cream gutters, precise editorial composition. It should feel like a buildable, cohesive stylized 3D indie adventure. Capture the clear sunlight, inviting exploration, atmospheric depth, and painterly cel-shaded environment qualities associated with modern Zelda-like adventures, while using this game's own explorer, water-science mechanisms and architectural forms.

Scene/backdrop:
An open-air WATER SHRINE COURTYARD approximately 26 by 26 metres, contained and comprehensible, on a rocky highland with distant misty green mountains and a soft blue sky. Warm pale limestone and weathered blue-gray stone, restrained dark teal details, clear turquoise channels, subtle moss in joints and a few grouped grasses at sheltered edges. Simple broad surfaces and clean rounded/chamfered silhouettes with painterly variation, not dense micro-detail.
Ground plane has a straight dry stone causeway along the center toward a distinctive small circular water sanctuary in the background, with shallow water channels on both sides. Symmetric side ramps, each genuinely walkable and visibly connected to the ground, rise only about three metres to wide left and right galleries. Thin waterfalls descend from the galleries into the channels. A short raised cross-bridge connects the two galleries; its underside is high enough for walking below on the dry center causeway. Elevation and walkable edges must be legible.
Three deliberately designed water-state receptacles: one on each upper gallery, one at the far lower causeway. Simple bronze/teal mechanical temperature controls, round gauges with understandable ice / water drop / vapor pictograms, and channels linking state changes to the architecture. A clear first successful receptacle illuminates and opens the raised bridge. No combat, weapons, hearts, dungeon crowds, giant boss, or extra novel game mechanics.

Composition:
Large hero panel: player-height third-person view from just inside the courtyard entry, camera behind and modestly above the SMALL brown-hatted explorer at lower center, explorer about 12% of panel height. Show the whole playable courtyard composition, both sloping approaches, water reflections, raised connecting bridge and sanctuary destination. The bridge should be open/extended and physically plausible. Use warm sunlight against cool turquoise water and readable shadow shapes. Keep the playable space spacious and uncluttered. A tiny discrete round notebook button with a book glyph and an "N" key badge at the upper right of the hero panel; no other HUD.
Lower left panel: a closer third-person view from the left elevated gallery looking across the raised bridge, same courtyard layout, same materials and lighting, visible lower dry causeway and water beneath.
Lower right panel: close-up detail of a coherent water-state receptacle and its adjacent three-position temperature control, clear ice cube / water drop / steam pictograms, a contained glowing turquoise water response. This should look like simple reusable 3D meshes, with attractive craftsmanship.
Do not create an unbuildable endless megastructure, excessively tall towers, fantasy cathedral, photorealistic AAA rendering, ornate gold patterns, flat empty gray platforms or washed-out gray fog.

Text (verbatim), minimal well-spaced dark teal Korean type on the cream margins:
"무무 행성 · 물 사당"
"비주얼 레퍼런스 01"
"01  입구에서 바라본 회랑"
"02  위아래가 이어지는 탐험"
"03  온도로 여는 물길"
"콘셉트 이미지 · 실제 게임 화면 아님"
Use only these labels plus the N badge; no invented paragraphs, fake technical numbers, watermarks or brand logos.

Quality:
Elegant cohesive art direction, beautiful composition, readable playable geometry, soft bounce light, expressive but controlled color, stylized low-to-mid polygon 3D with selective painterly surfaces. This is a practical visual target the developers can compare real screenshots against.
```
