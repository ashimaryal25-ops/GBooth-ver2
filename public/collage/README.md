# Photo Collage booth (FLASHBACK)

This is the standalone photo-strip / collage experience (originally Chloe's
`photobooth-ver-2` branch), integrated into CardifyBooth as a static app.

## How it's wired into the Next.js app

- The files live in `public/collage/` so Next serves them verbatim at
  `/collage/index.html` (no build step touches them — it stays plain
  HTML/CSS/JS).
- The booth's **Photo Collage** button (`src/components/BoothApp.tsx`, the
  `step === "collage"` block) embeds this app in an `<iframe>` with
  `allow="camera; microphone"` so the webcam works. The booth's **Back** button
  returns to the chooser.

## What changed from the original branch

Only file names + the two references inside `index.html` (everything else is
byte-for-byte the same), so it follows project conventions:

| Original (repo root)  | Here (`public/collage/`) |
| --------------------- | ------------------------ |
| `trial2index.html`    | `index.html`             |
| `trail2style.css`     | `style.css`              |
| `trail2java.js`       | `script.js`              |

`index.html` now references `style.css` and `script.js` instead of the old
`trail2*` names.

## To make a compatible PR

1. Put the three files in `public/collage/` with the names above.
2. Keep `index.html`'s links as `style.css` / `script.js` (relative).
3. Leave the `BoothApp.tsx` iframe wiring as-is.

## Known follow-up (offline kiosk)

This app loads three things from CDNs:

- Tailwind: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`
- QR codes: `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`
- Fonts (Orbitron, VT323) from Google Fonts (in `style.css`)

The booth is meant to run fully offline, so these should eventually be vendored
into `public/collage/` and referenced locally. Until then it needs internet.
The webcam requires a secure context, which `localhost` / the deployed https
origin both satisfy.
