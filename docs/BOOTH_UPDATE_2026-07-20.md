# Booth update: July 20, 2026

Handoff record for the laptop changes made after commit `82264cc`. Written to be
specific enough that the booth computer does not need to infer anything.

Two parts:

1. Three print/UI fixes — collage print geometry, collage photo proportions, and
   the card loading screen.
2. A new **offline phone-download mode**, where the booth serves guests' photos
   off its own Wi-Fi hotspot instead of a public URL, plus a guard that keeps
   guests off the rest of the app. This one needs setup on the booth.

---

## Task for the agent on the booth computer

Apply the three commits on `origin/main` after `82264cc` to this booth checkout,
then verify. Newest last:

- `fix: collage print bleed, 4-shot proportions, card loader`
- `feat: serve phone downloads from the booth hotspot`
- `feat: keep guests off the kiosk when serving on the LAN`

(Referenced by title rather than hash because this note is part of the first.)

Do this:

1. Check whether this checkout has uncommitted local changes. If it does, create
   a backup branch first and **do not discard them** — some booth-only settings
   may live here.
2. Confirm `.env.local` and `.booth-storage/` are intact before and after. Never
   overwrite or delete either; `.booth-storage` holds guests' local card PNGs and
   the SQLite database, and `.env.local` holds this booth's own settings.
3. Fetch and apply all three. Resolve only genuine conflicts. If a diff shows
   changes to `public/collage/script.js` or `public/collage/style.css`, that is
   dead legacy code — discard those, do not merge them.
4. Add the new settings to `.env.local` for hotspot download mode — see "Booth
   setup for this mode" below. **Skip this and the QR will not work**, though
   the rest of the booth still will.
5. Run `npm run build`. Do **not** run `npm install` — no dependencies changed.
6. Restart the kiosk app.
7. Work through "Booth smoke test" below and report the result of each item.

### Things that will look like bugs but are not

- **The print is tighter and slightly larger.** Filling the page crops about 5%
  off each strip's outer edge and prints it roughly 12% larger. Photos are not
  cut. Intended — see "Printing".
- **Two QR codes now appear** on the card and collage final screens: join the
  Wi-Fi, then download. A phone camera can only act on one code at a time, so
  they cannot be combined. The join QR disappears if no hotspot is configured.
- **The app refuses to load from another device.** That is `src/proxy.ts` doing
  its job. The booth's own two screens use `localhost` and are unaffected.

### Do not "fix" these

- `src/proxy.ts` uses the **`proxy.ts`** convention, not `middleware.ts`, which
  is deprecated in Next 16 and **silently ignored** — it looks like it works and
  does nothing.
- It reads the **Host header**, not `request.nextUrl.hostname`. Next normalises
  `nextUrl` to the server's own origin, so it reports `localhost` even for LAN
  requests and would let everything through.

### If something is wrong

- Print misaligned rather than merely tighter → do not edit the script. Adjust
  `CARDIFYBOOTH_COLLAGE_OFFSET_X` / `..._OFFSET_Y`, which `print-card.ps1`
  already reads.
- Phone scans the download QR and nothing happens, or it hangs → almost always
  the **Windows Firewall** inbound rule for the app's port on the private
  network. Check that before touching code.
- Need to fall back to public URLs → blank `CARDIFYBOOTH_LOCAL_DOWNLOAD_BASE_URL`
  and keep `BLOB_READ_WRITE_TOKEN` set.

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

### Guests must not reach the rest of the app

Listening on the LAN also exposes the kiosk to everyone on the hotspot. Without
a guard they could drive the booth UI, trigger prints and burn dye-sub media, or
read `/api/local-cards` and page through **other guests' photos**.

`src/proxy.ts` blocks this: requests arriving on a LAN address may only reach
`/api/local-downloads`. Everything else returns 403. The booth's own two screens
use `localhost` and are unaffected, so the camera mirror keeps working.

Verified on the laptop, 9/9: localhost reaches the kiosk, its APIs and the
mirror page; a LAN address is refused the app root, `/api/local-cards`,
`/api/collage/print`, `/camera-mirror.html` and `/api/mirror`, while the
download route stays reachable.

Two notes for whoever maintains this:

- It uses the **`proxy.ts`** convention. `middleware.ts` is deprecated in Next 16
  and is silently ignored — an earlier attempt using it did nothing at all.
- It reads the **Host header**, not `request.nextUrl.hostname`. Next normalises
  `nextUrl` to the server's own origin, so it reports `localhost` even for LAN
  requests and would let everything through. Do not "simplify" it back.

Because it keys off the Host header it stops guests browsing from a phone, not
someone crafting requests by hand. It is a booth-privacy measure, not a hardened
boundary — do not put anything on this machine that would be damaging to leak.

New files:

- `src/app/api/local-downloads/[id]/route.ts` — serves the PNG off local disk
- `src/lib/hotspot.ts` — builds the `WIFI:` join payload
- `src/components/PhoneDownloadSteps.tsx` — the shared two-step panel
- `src/proxy.ts` — keeps guests off the rest of the app

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

Nothing below was provable on the laptop. Items 1-2 need real paper, 3-4 need a
real capture, and 7-10 need a real phone on the real hotspot.

**Print and capture**

1. Print a 4-shot collage. Confirm the colour reaches all four paper edges with
   no white margin.
2. Cut the sheet down the centre. Confirm both strips have equal borders on
   their left and right, and that no photo is clipped.
3. Run a 4-shot session and confirm the photos look correctly proportioned, not
   vertically squashed.
4. Run 2-shot and 3-shot sessions and confirm they are unchanged.
5. Start a trading card and confirm Pac-Man chases the dots and loops.
6. Print a trading card and confirm 4x6 fill is unchanged by the script edit.

**Phone downloads over the hotspot**

7. On the final screen, confirm two QR codes appear and the network name printed
   under the first matches the hotspot Windows is broadcasting.
8. Scan QR 1 with a phone and confirm it joins the booth Wi-Fi.
9. Scan QR 2 and confirm the PNG downloads and opens. Do this for **both** a
   collage and a trading card.
10. Wait 30+ minutes, scan an old QR again, and confirm it now fails — downloads
    are meant to expire so guests' photos do not linger.

**Guests must not reach the booth**

11. From the same phone, open `http://<booth-ip>:3000/` and confirm it is
    refused. Try `/api/local-cards` too — it must not list anyone's photos.
12. Confirm the booth's own two screens still work normally on `localhost`,
    including the camera mirror.

**Data**

13. Confirm `.booth-storage` still contains local card PNGs and SQLite data.

## Verified on the laptop

- `npx tsc --noEmit` passes.
- `print-card.ps1` parses without errors.
- Kiosk loads with no console errors.
- Print geometry and the 4-shot crop were **not** physically verified — they
  need the real printer and a real capture session. Items 1-3 above are the
  actual test.
