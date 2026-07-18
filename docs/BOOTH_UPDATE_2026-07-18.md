# Booth update: July 18, 2026

This note is the handoff record for the laptop changes made after commit
`a8f0bfa`. It is intentionally specific so the real booth computer does not
need to infer which files or settings changed.

## Behavior changes

- Trading cards print in 4x6 fill mode, removing the left/right white bars.
- Card and collage capture use a three-second countdown.
- Ghost Runner has a top-right fullscreen control in the home grid and one
  large Home control while fullscreen.
- Ghost Runner returns to the home grid after 30 seconds without fullscreen
  activity, and its Top 5 name field stays inside the game at both sizes.
- Collage stickers drag directly from the sticker palette to the drop location.
- The trading-card form again includes an on-screen keyboard and fits in one
  1366x768 frame.
- Speech transcription displays interim words while the guest is speaking.
- Finished cards and collages can be downloaded by scanning an on-screen QR.
- Printed outputs retain the ICL logo; the download QR is not printed.
- Raw portraits stay local. Only the finished composited PNG is uploaded.
- Public phone-download storage keeps the newest 100 outputs.

## Changed files

### Kiosk interface

- `src/components/BoothApp.tsx`
- `src/components/CardForm.tsx`
- `src/components/CardPreview.tsx`
- `src/components/CardReveal.tsx`
- `src/components/PhotoCollage.tsx`
- `public/ghost-runner/game.js`
- `public/ghost-runner/index.html`
- `public/ghost-runner/style.css`
- `src/lib/use-speech-to-text.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`

### Phone downloads

- `src/app/api/public-downloads/route.ts` (new)
- `src/lib/public-download.ts` (new)
- `.env.example`

### Printing

- `src/app/api/local-cards/[id]/print/route.ts`
- `src/lib/local-card-printer.ts`
- `scripts/print-card.ps1`

### Dependencies and documentation

- `package.json`
- `package-lock.json`
- `README.md`
- `KIOSK_SETUP.md`
- `docs/BOOTH_UPDATE_2026-07-18.md` (this file)

New packages:

- `@vercel/blob`
- `react-simple-keyboard`

## Required booth setting

Add the public Vercel Blob store token to the booth's existing `.env.local`:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

Do not replace the booth's existing `.env.local`; add this one setting to it.
The `.env.local` file and `.booth-storage` folder must remain uncommitted.

## Recommended transfer

The reliable transfer is a Git commit, not manual file copying:

1. Commit and push this tested update from the laptop.
2. On the booth computer, preserve any local `.env.local` and
   `.booth-storage` data.
3. Pull the update from GitHub.
4. Run `npm install` so the two new packages are installed.
5. Add `BLOB_READ_WRITE_TOKEN` to `.env.local`.
6. Run `npm run build`.
7. Restart the kiosk app.

If the booth checkout has its own uncommitted code changes, do not overwrite
them. Create a backup branch first, then ask Codex on that computer to apply the
single update commit and resolve only genuine conflicts. Give it this note and
the commit hash; it will have an exact file list and smoke-test checklist.

## Booth smoke test

1. Print one trading card and confirm no white side bars remain.
2. Confirm both card and collage countdowns show `3, 2, 1`.
3. Open Ghost Runner fullscreen, play, then use Home to return.
4. Open it fullscreen again and confirm 30 seconds without activity exits to
   the home grid.
5. Reach the Top 5 entry screen in the quadrant and fullscreen; confirm the
   name field remains centered below its prompt in both layouts.
6. Drag a collage sticker from the palette directly onto the strip.
7. Type a card description using the on-screen keyboard.
8. Speak a description and confirm words appear before speech stops.
9. Scan a card QR on a phone using cellular data and download the PNG.
10. Scan a collage QR and download the PNG.
11. Confirm both physical prints contain the ICL logo.
12. Confirm `.booth-storage` still contains local card PNGs and SQLite data.
