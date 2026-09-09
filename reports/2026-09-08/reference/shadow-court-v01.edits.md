# 빛과 그림자 레퍼런스 01 — 부분 수정 프롬프트

## 부분 수정 1 — 거울 배치와 빛 경로

입력: [최초 시안](shadow-court-v01-draft.png). 결과: [연결점 수정 전](shadow-court-v01-ray-draft.png).

```text
Use case: precise-object-edit.
Edit this concept board with ONE targeted correction: fix the mirror arrangement and the optical ray path ONLY in the large top gameplay scene. Preserve the title and all Korean labels verbatim, ivory margins, entire three bottom panels unchanged, small explorer appearance and location, architecture and rich warm-gold/indigo night art direction, notebook icon and moon.

The current top ray reads nearly straight through the mirrors. Replace it with a clear WIDE ZIGZAG IN DEPTH across exactly THREE vertical flat mirror faces, at constant world-space waist/chest height. Rearrange ONLY the three mirror pedestals within the top room to form a broad triangle, leaving plenty of walking space.
Mirror A is closer to camera at left-center. Mirror B is farther back at center. Mirror C is closer to camera again at right-center. The existing wall emitter on left sends a ray to the center of mirror A, which REFLECTS back into the room to the center of B, then B REFLECTS diagonally toward the camera/right to the center of C, then C REFLECTS away toward the circular receiver on the far right wall. Adjust the left emitter's height if necessary to match the mirror centers. The four segments must connect source-A-B-C-receiver; no forks, no loose ends, no beam continuing straight through an opaque mirror. Each corner lies exactly on a mirror's reflective face. Rotate each mirror around its vertical swivel axis so the incident and reflected rays form approximately equal angles to the mirror normal. Keep the mirrors vertically upright; perspective is allowed but do not tilt their pitch to create an unintended upward ray. The silver surfaces and their brass sides should reveal the planes and rotation. Show a bright point at each reflection, restrained warm glow, four straight beam segments with obvious direction changes, not a single nearly straight line. Do not add arrows, symbols, text or further mirrors.

Preserve everything outside the main top panel exactly. This remains a practical stylized game concept reference, not a screenshot.
```

## 부분 수정 2 — 첫 거울의 연결점

입력: [연결점 수정 전](shadow-court-v01-ray-draft.png). 결과: [최종 선택본](shadow-court-v01.png).

```text
Use case: precise-object-edit. Make exactly one small optical-connection correction in this 1536x1024 art board. Preserve ALL typography, all three lower panels, all characters, every mirror and pedestal position, architecture, lighting and notebook icon unchanged.

In the main top panel, the outgoing light ray from the FIRST / LEFT mirror currently starts at its brass adjustment handle at approximately pixel (492, 367). This is wrong. Remove that incorrect diagonal light segment from (492,367) to the SECOND / CENTER mirror at (738,306), and remove any short ray extension that points down from the first mirror toward its hardware. Restore the natural background there. Instead draw ONE thin warm luminous straight ray segment that starts EXACTLY at the bright reflection spot on the actual silver FACE of the LEFT mirror at approximately pixel (430,310), and ends EXACTLY at the reflection spot on the CENTER mirror at approximately pixel (738,306). This new segment is nearly horizontal in the picture because the center mirror is farther back in the room. That is intentional. The incoming source-to-left-mirror ray already ends at (430,310) and must remain. Both incoming and outgoing segments must meet at precisely this single spot (430,310) ON THE MIRROR FACE, with no second bend at the base or handle.

Keep the existing CENTER mirror to RIGHT mirror segment and RIGHT mirror to receiver segment unchanged. Final path is wall source -> left mirror FACE -> center mirror FACE -> right mirror FACE -> circular wall receiver. Exactly four straight segments connected at three mirror-face reflection points. No other changes. No new labels, arrows, or objects.
```

