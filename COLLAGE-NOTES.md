# Photo Collage — what changed (for Chloe)

This branch carries the **current `src/components/PhotoCollage.tsx`** only, so you can
review the collage on its own. Below is what changed vs. the original standalone
GBOOTH strip, focused on **aspect ratio** and **how the 2 / 3 / 4-shot strips lay out now**.

## Strip aspect ratio

- The strip canvas is a fixed **600 × 1800** → a **1 : 3** portrait strip.
- Printing composes a **1200 × 1800** sheet = **2 : 3 (a 4×6)** with **two identical
  strips side by side** (left at x0–600, right at x600–1200). The strip background
  color fills the whole sheet so the colored border bleeds to every edge; the
  DS-RX1's `DoubleStrip4x6` cut down the exact center yields two finished strips.

## How 2 / 3 / 4 shots lay out now (the main change)

All three layouts share **one fixed content band** — no per-layout hand-tuning:

- Top margin: **24 px**
- Reserved footer band: **250 px** (college text + ICL website QR + ICL logo)
- Usable content height: `1800 − 24 − 250 = ` **1526 px**
- Photos are **equal height with equal 20 px gaps**:
  `photoH = (1526 − (n−1)·20) / n`

| Shots | Photo size (W×H) | Photo aspect | Look        |
|:-----:|:----------------:|:------------:|:------------|
|   2   | 552 × **753**    | ~0.73 (tall) | portrait    |
|   3   | 552 × **495**    | ~1.11        | near-square |
|   4   | 552 × **366**    | ~1.51 (wide) | landscape   |

- Photo **width is constant (552 px** = 600 − 24×2 padding); only the **height**
  changes with the shot count, so more shots = shorter/wider frames.
- **The camera viewfinder uses the exact same `slotPhotoHeight()`**, so the shape a
  guest frames on the capture screen is the shape that lands on the strip — pick 2,
  3, or 4 and the live preview already matches the final slot. No surprise crop.
- Each photo is **cover-cropped, never stretched**: largest source region matching
  the slot aspect, then a slight zoom-in (`CROP_ZOOM = 1.2`) to push the ceiling out,
  centered horizontally, with the vertical crop **biased downward**
  (`VERTICAL_CROP_BIAS = 0.72`) to keep face/torso and trim the empty ceiling the
  low-mounted booth camera captures. Tune those two constants if framing needs it.

All the knobs live at the top of the file (`STRIP_W`, `STRIP_H`, `STRIP_TOP_MARGIN`,
`STRIP_GAP`, `STRIP_FOOTER_H`, `CROP_ZOOM`, `VERTICAL_CROP_BIAS`).

## Final screen

- The finished strip renders **centered** in the viewport at `height: 65vh`
  (max 750 px), `w-auto` so the 1:3 ratio is preserved.
- **Print** button on the right; **Home** button top-left.
- The temporary phone-download QR / upload path was removed from the final screen —
  the only QR now is the **ICL website QR baked into the strip footer**.
