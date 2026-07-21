# Booth transfer — July 21, 2026

Move the **current working CardifyBooth** (this laptop's version) onto the booth
PC in a **fresh folder**, and get the **photo-collage print to cut a 4×6 into two
clean 2×6 strips**. The booth's existing install is broken (it does not cut); do
not try to repair it — stand this version up beside it and switch over.

This repo's `main` is an exact snapshot of the laptop's working tree. Clone it,
don't hand-copy files.

Repo: `https://github.com/ashimaryal25-ops/gbooth_ver3.git` (clone `main`)

**Install Git LFS first.** The Ghost Runner background videos (~69 MB of `.mp4`)
are stored via Git LFS. Without LFS installed, a clone brings them down as tiny
pointer files and the game visuals break. Run once, before cloning:
```powershell
git lfs install
```
(The `.wav`/`.mp3` sounds and `.gif`s are normal git and always clone fine. The
card/collage printing does not use the videos, so cutting works either way.)

---

## The main concern: collage cutting → two clean strips

### How the cut works (read this before touching anything)

1. `src/components/PhotoCollage.tsx` → `composeForPrint()` builds one
   **1200 × 1800 px PNG = a 4×6 portrait sheet** containing **two identical
   strips side by side**: left strip at x0–600, right strip at x600–1200. Each
   strip is 600 px wide = **2 inches**. The whole sheet is pre-filled with the
   frame colour so it bleeds to every edge (no white margin).
2. `src/app/api/collage/print/route.ts` writes that PNG and calls the printer
   with **`mode: "DoubleStrip4x6"`**.
3. `scripts/print-card.ps1` (DoubleStrip4x6 branch) cover-fills the whole 4×6
   page with that pre-composed image — one draw, no duplication, no gutter math.
4. **The physical cut is NOT done by the app.** It is done by a **DNP printer
   queue that has the "2 inch cut" enabled.** A 4×6 sent to that queue comes out
   as two 2×6 strips, cut down the exact centre — which lines up with the seam
   between the two strips in the composed image.

### Why "the 2-inch cut is on" can still print uncut

The cut setting only fires **on the specific queue the app sends the job to**, and
for `DoubleStrip4x6` the app does **not** send to the base printer — it looks for
a strip queue, in this order:

1. `$env:CARDIFYBOOTH_STRIP_PRINTER_NAME` if set, else
2. `"<CARDIFYBOOTH_PRINTER_NAME>-Strips"` (e.g. `DNP DS-RX1-Strips`).

If that queue exists → the job goes there and its cut setting fires.
If it does **not** exist → the script warns loudly and falls back to the base
printer, which prints **uncut** unless the base queue itself has the cut on.

So the usual real cause of "won't cut" is a **name mismatch**: the 2-inch cut is
enabled on one queue (often the base `DNP DS-RX1`), but the app is sending collage
jobs to a differently-named queue (`...-Strips`) that has no cut — or the strip
queue doesn't exist at all and `CARDIFYBOOTH_PRINTER_NAME` isn't even set.

### Fix (pick one)

- **Easiest:** point the app straight at the queue that already has the cut. In
  `.env.local`:
  ```env
  CARDIFYBOOTH_PRINTER_NAME=<exact base DNP name, e.g. DNP DS-RX1>
  CARDIFYBOOTH_STRIP_PRINTER_NAME=<exact name of the queue whose 2-inch cut is ON>
  ```
  (These may be the same name if the base queue is the one that cuts.)
- **Or** create a queue named `<CARDIFYBOOTH_PRINTER_NAME>-Strips` on the same
  port as the DNP printer and enable the 2-inch cut in its driver settings.

Get exact queue names with:
```powershell
Get-Printer | Select-Object Name
```

### Verify the cut

Run one collage print, then read the **server console** (the minimized window
`Start-CardifyBooth` opens). `print-card.ps1`'s output is echoed there via
`src/lib/local-card-printer.ts`. It tells you exactly:
- `Collage mode: using strip queue '<name>' (this is the queue that cuts).` ✅
- or `strip queue '<name>' NOT FOUND ... THE SHEET WILL NOT BE CUT` ❌ plus the
  list of queues that DO exist — match one of those.

Then physically confirm: the colour reaches all four paper edges, the cut is at
the centre, and **both 2×6 strips have equal borders** on their left and right.
Repeat for 2-, 3-, and 4-shot strips.

---

## Setup on the booth PC

Do all of this in a **new folder** (e.g. `C:\CardifyBooth-v2`). Leave the old
install untouched.

1. **Clone into the new folder** (Git LFS installed first — see top of this doc):
   ```powershell
   git lfs install
   git clone https://github.com/ashimaryal25-ops/gbooth_ver3.git C:\CardifyBooth-v2
   cd C:\CardifyBooth-v2
   git lfs pull   # ensures the .mp4 videos are real files, not pointers
   ```
2. **Install deps** (fresh folder, so this is required once):
   ```powershell
   npm install
   ```
3. **Create `.env.local`** (it is gitignored, so it is NOT in the clone). Copy the
   old install's `.env.local` if it has good values, then make sure the printer
   keys above are correct. Minimum for cutting:
   ```env
   CARDIFYBOOTH_PRINTER_NAME=<DNP printer name>
   CARDIFYBOOTH_STRIP_PRINTER_NAME=<the queue whose 2-inch cut is ON>
   ```
   Other keys (OpenAI, hotspot download QR, low-roll email alert) are documented
   in `.env.example` — carry over whatever the old booth used.
4. **Do NOT set `NEXT_PUBLIC_DEV_CAMERA`.** That flag is laptop-only: it makes the
   kiosk grab the local webcam instead of the camera mirror. On the booth the
   real camera is owned by the mirror window (see below). Leaving the flag unset
   is what keeps the mirror path live.
5. **Launch:** double-click **`Start-CardifyBooth.bat`** (wrapper around
   `Start-CardifyBooth.ps1`). It builds if needed, starts the server, then:
   - opens the **kiosk UI fullscreen on the PRIMARY display**, and
   - opens **`/camera-mirror.html` fullscreen on the SECOND display** (the live
     camera the guest sees).

   If the two screens are swapped, run `Start-CardifyBooth.bat` via a shortcut
   with `-SwapMonitors`, or `powershell -File Start-CardifyBooth.ps1 -SwapMonitors`.
   For iterating without a production build: `-Dev`.

### How the two displays / camera work

- The **mirror** (`public/camera-mirror.html`, second display) owns the physical
  camera. The **kiosk** (main display) asks it for stills over `/api/mirror`
  (a small polling relay, roles `kiosk` ↔ `mirror`). The launcher pre-grants
  camera permission in each Chrome profile so there is no prompt or warning strip.
- The "start" experience is the launcher itself: one double-click brings up both
  screens correctly. Nothing else needs wiring for that.

---

## Do NOT touch / do NOT "fix"

- **`.env.local`** and **`.booth-storage/`** — booth-specific settings and guests'
  saved PNGs + SQLite DB. Never overwrite or delete. (Both are gitignored.)
- **The queue-based cut design** in `scripts/print-card.ps1` — the cut belongs on
  the DNP queue, not the script. If a print is *misaligned* (not merely tighter),
  adjust `CARDIFYBOOTH_COLLAGE_OFFSET_X` / `_OFFSET_Y` in `.env.local`, which the
  script already reads — do not edit the draw math.
- **`src/proxy.ts`** — the LAN guard. It intentionally uses the `proxy.ts`
  convention (not the deprecated `middleware.ts`) and reads the Host header. Do
  not "simplify" it.
- **`public/collage/*`** — dead legacy standalone page; nothing loads it. The live
  collage is `src/components/PhotoCollage.tsx`.

---

## Smoke test (needs real paper + a real capture — none of it is provable off-booth)

1. Print a **4-shot** collage → colour reaches all four edges, no white margin.
2. Cut down the centre → **two 2×6 strips, equal borders both sides**, no photo
   clipped. *(This is the whole point of this transfer.)*
3. Repeat for **2-shot** and **3-shot**.
4. Confirm the **camera mirror** shows the live cam on the second display and the
   countdown capture lands the framed shot on the strip.
5. Print a **trading card** → `Fill4x6` unchanged (single card, no cut).
6. If hotspot download is configured, confirm the two QR codes on the final
   screens and that a phone can download over the booth Wi-Fi (Windows Firewall
   inbound rule for port 3000 on the private network is the usual blocker).

See also `docs/BOOTH_UPDATE_STRIP_FIX.md` and `docs/BOOTH_UPDATE_2026-07-20.md`
for the history behind the print geometry and the offline-download mode.
