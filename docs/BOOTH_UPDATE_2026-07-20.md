# Booth update: July 20, 2026

Handoff record for the laptop changes made after commit `82264cc`. Written to be
specific enough that the booth computer does not need to infer anything.

Three unrelated fixes: collage print geometry, collage photo proportions, and the
card loading screen. Phone-download / QR work is deliberately **excluded** from
this update — see "Explicitly not included" at the bottom.

---

## Task for the agent on the booth computer

Apply the update commit titled **"fix: collage print bleed, 4-shot proportions,
card loader"** — the newest commit on `origin/main` — to this booth checkout,
then verify it. (Referenced by title rather than hash because this note is part
of that same commit.)

Do this:

1. Check whether this checkout has uncommitted local changes. If it does, create
   a backup branch first and **do not discard them** — some booth-only settings
   may live here.
2. Confirm `.env.local` and `.booth-storage/` are intact before and after. Never
   overwrite or delete either; `.booth-storage` holds guests' local card PNGs and
   the SQLite database.
3. Fetch and apply that commit. It touches exactly four files:
   `scripts/print-card.ps1`, `src/components/PhotoCollage.tsx`,
   `src/components/BoothApp.tsx`, `docs/BOOTH_UPDATE_2026-07-20.md`.
   Resolve only genuine conflicts. If a diff shows changes to
   `public/collage/script.js` or `public/collage/style.css`, that is dead legacy
   code — discard those, do not merge them.
4. Run `npm run build`. Do **not** run `npm install` — this update adds no
   dependencies and no environment variables.
5. Restart the kiosk app.
6. Work through "Booth smoke test" below and report the result of each item.

Two of the fixes cannot be verified from code alone — they need real paper and a
real capture session. Smoke-test items 1 to 3 are the actual proof. Item 2 in
particular requires physically cutting a printed sheet.

Expect one deliberate visual change on the print: filling the page crops about
5% off each strip's outer edge and prints the strip roughly 12% larger. Photos
are not cut. This is intended, not a regression — see "Printing" below.

If the print comes out misaligned rather than merely tighter, do not edit the
script. Adjust the `CARDIFYBOOTH_COLLAGE_OFFSET_X` / `..._OFFSET_Y` environment
variables, which `print-card.ps1` already reads.

---

## Behavior changes

- Collage strips print with the frame colour bleeding to all four paper edges.
  The white paper margin around the printed strips is gone.
- After the 4x6 sheet is cut down the centre, both strips have equal side
  borders. Previously each strip looked shifted toward the cut.
- Four-shot collages no longer squash the photos. Photos keep their true 4:3
  proportions in every layout (2, 3 and 4 shot).
- The trading-card "Creating your card" screen now shows a Pac-Man chasing the
  three loading dots, with the whole group drifting off-screen left and
  re-entering from the right on a loop.

## Changed files

### Printing

- `scripts/print-card.ps1`

`DoubleStrip4x6` previously scaled each strip with `Math::Min` ("fit"), which
left the strip smaller than its half of the sheet and exposed white paper. Both
the portrait (side-by-side) and landscape (stacked) branches now use
`Math::Max` ("fill") and wrap each draw in `SetClip` / `ResetClip` so a filled
strip cannot paint into its neighbour.

Consequence to expect on the print: filling the half crops roughly 5% off the
strip's outer edges. The crop stays inside the strip's 24px padding, so photos
are not cut, but the colour border around the photos is slightly narrower than
before. The whole strip also prints about 12% larger. This is the trade for
edge-to-edge bleed and was accepted deliberately.

### Kiosk interface

- `src/components/PhotoCollage.tsx`
- `src/components/BoothApp.tsx`

`PhotoCollage.renderStrip` drew each photo with the 5-argument `drawImage`,
stretching the 640x480 source into the slot. The 4-shot slot is far wider than
4:3, so faces compressed vertically. It now computes a source crop rectangle and
uses the 9-argument `drawImage`, so the aspect ratio is preserved using native
pixels (no resolution loss). Horizontal crop is centred; vertical crop keeps the
top of the frame so heads are not sliced off.

`BoothApp` gained the Pac-Man loader on the `generating` step. Pure CSS, no new
assets and no new packages: Pac-Man is two notched circles rotating in opposite
directions inside a `scaleX(-1)` wrapper.

### Documentation

- `docs/BOOTH_UPDATE_2026-07-20.md` (this file)

No dependency changes. No new packages. No new environment variables.

## Offline phone downloads (new, needs setup on the booth)

The booth can now serve downloads off **its own Wi-Fi hotspot** instead of
uploading to a public URL. Guests' photos never leave the booth machine. This
exists because the booth is used by minors and the previous mode put their
photos on publicly readable URLs.

The final screens now show two numbered QR codes: **1. Join booth Wi-Fi** and
**2. Scan to download**. A phone camera can only act on one QR at a time, so
joining and downloading cannot be a single code. The network name is printed
under the first QR for phones that will not act on a Wi-Fi QR.

New files:

- `src/app/api/local-downloads/[id]/route.ts` — serves the PNG off local disk
- `src/lib/hotspot.ts` — builds the `WIFI:` join payload
- `src/components/PhoneDownloadSteps.tsx` — the shared two-step panel

Modified: `src/app/api/public-downloads/route.ts` (mode branch, plus retention
is now a 30-minute expiry rather than "newest 100"), `src/components/CardReveal.tsx`,
`src/components/PhotoCollage.tsx`, `.env.example`.

Files are written to `.booth-storage/public-downloads/` and deleted after 30
minutes. Nothing else in the app reads these URLs, so expiry breaks nothing.

### Booth setup for this mode

1. Turn on Windows Mobile Hotspot. Give it internet from **ethernet** if
   possible — a hotspot with no internet makes phones warn "no internet" and
   jump back to cellular mid-download.
2. Add a Windows Firewall inbound rule allowing the app's port (3000) on the
   **private** network. Without it phones hang with no error. This is the most
   likely cause of "the QR does nothing".
3. Set in `.env.local`:

```env
CARDIFYBOOTH_LOCAL_DOWNLOAD_BASE_URL=auto
NEXT_PUBLIC_CARDIFYBOOTH_HOTSPOT_SSID=<the hotspot name Windows shows>
NEXT_PUBLIC_CARDIFYBOOTH_HOTSPOT_PASSWORD=<the hotspot password>
```

   `auto` prefers `192.168.137.1` (the Windows hotspot address). If it picks
   the wrong interface, set the full URL explicitly instead.

4. Local mode wins when `BLOB_READ_WRITE_TOKEN` is also present. To go back to
   public URLs, blank `CARDIFYBOOTH_LOCAL_DOWNLOAD_BASE_URL`. With neither set
   the kiosk shows "QR unavailable" and everything else still works.

Verified on the laptop: upload returns a LAN URL, fetching it returns HTTP 200
with `image/png` and an attachment header, and the id is path-traversal guarded.
**Not** verified: an actual phone over an actual hotspot. That is the real test.

## Explicitly not included in this update

Do not carry these into the booth from this laptop:

- `public/ghost-runner/leaderboard.json` — local play data, not a code change.
- `.env.local` — booth-specific. Never copy the laptop's version over.

`public/collage/script.js` and `public/collage/style.css` had also been edited on
the laptop, but that is the **legacy standalone collage page and nothing loads
it** — the live collage is the React component `src/components/PhotoCollage.tsx`.
Those edits were reverted on the laptop and are not part of this update. If they
reappear in a diff, discard them rather than merging.

## Recommended transfer

Same as the previous update: a Git commit, not manual copying.

1. Commit only `scripts/print-card.ps1`, `src/components/PhotoCollage.tsx`,
   `src/components/BoothApp.tsx` and this note. Leave the excluded files out.
2. Push from the laptop.
3. On the booth computer, preserve `.env.local` and `.booth-storage`.
4. Pull the update.
5. Run `npm run build` (no `npm install` needed — no dependency changes).
6. Restart the kiosk app.

If the booth checkout has its own uncommitted changes, do not overwrite them.
Create a backup branch, then have Codex apply this single commit and resolve only
genuine conflicts.

## Booth smoke test

Items 1 and 2 are the ones that can only be judged on real paper.

1. Print a 4-shot collage. Confirm the colour reaches all four paper edges with
   no white margin.
2. Cut the sheet down the centre. Confirm both strips have equal borders on
   their left and right, and that no photo is clipped.
3. Run a 4-shot session and confirm the photos look correctly proportioned, not
   vertically squashed.
4. Run 2-shot and 3-shot sessions and confirm they are unchanged.
5. Start a trading card and confirm Pac-Man chases the dots across the loading
   screen and loops.
6. Print a trading card and confirm the 4x6 fill behaviour is unchanged by the
   print-script edit.
7. Confirm `.booth-storage` still contains local card PNGs and SQLite data.

## Verified on the laptop

- `npx tsc --noEmit` passes.
- `print-card.ps1` parses without errors.
- Kiosk loads with no console errors.
- Print geometry and the 4-shot crop were **not** physically verified — they
  need the real printer and a real capture session. Items 1-3 above are the
  actual test.
