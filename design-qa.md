# Card Design QA

- Source visual truth: `design/card-reference.png`
- Implementation screenshot: `design/card-implementation.png`
- Viewport: 300 x 480 card crop
- State: generated Epic card with sample portrait, three traits, Campus Power, Known For, Special Ability, and QR code

**Full-View Comparison Evidence**

Both source and implementation were captured successfully at the same 300 x 480 card size. The required single combined comparison capture was blocked by the browser's local-file URL security policy, so the formal side-by-side visual gate could not be completed.

**Focused Region Evidence**

- Header: G/1832 mark and rarity recess are present.
- Portrait: 4:3 portrait crop fits the large inset frame.
- Lower content: three scored traits, Campus Power, Known For, Special Ability, and QR are present without DOM overflow.
- Export: the generated card autosaved as a PNG and rendered on the saved-card flow.

**Findings**

- [P2] Formal combined visual comparison is unavailable.
  - Location: QA evidence capture.
  - Evidence: source and implementation screenshots exist separately, but the browser rejected the local comparison page.
  - Impact: exact side-by-side fidelity cannot be formally marked passed in this run.
  - Fix: visually inspect `design/card-reference.png` and `design/card-implementation.png` together, or provide approval from the live card at `http://localhost:3000`.

**Patches Made**

- Replaced the old black-and-white card renderer with the gold Figma-derived template.
- Put rarity in the top-right inset.
- Matched the 300 x 480 card geometry and 4:3 portrait area.
- Added dynamic traits, Campus Power, Known For, Special Ability, and QR placement.
- Fixed clipped Special Ability text.

**Implementation Checklist**

- [x] Dynamic card data preserved.
- [x] PNG export and local autosave preserved.
- [x] Rarity uses the top-right Figma recess.
- [x] Text content fits the card DOM bounds.
- [ ] User confirms final source-to-render visual fidelity.

final result: blocked
