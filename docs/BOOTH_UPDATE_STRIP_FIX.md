# Booth update: July 20, 2026 — Collage strip fix

Handoff record for the collage strip layout fixes. Written to be specific
enough that the booth computer does not need to infer anything.

Three changes:
1. **Fix uneven strip borders after the center cut** — the print now sends a
   pre-composed 4×6 sheet with balanced gutter math instead of a single strip
   that the print script duplicated with fill (which cropped the outer edges).
2. **Remove white box behind ICL logo** — the logo PNG has native transparency;
   the explicit white rectangle behind it is removed.
3. **Printer cut** — requires `CARDIFYBOOTH_PRINTER_NAME` to be set in
   `.env.local` on the booth, or the cut will not happen.
4. **Added ICL Website QR Code on strip** — A static QR code pointing to `https://icl.sites.gettysburg.edu/` is now printed on the strip opposite the logo.
5. **Removed scrollbar from decor view** — `overflow-hidden` is now used to prevent scrolling in the customize strip step.

---

## Task for the agent on the booth computer

Apply the commits on `origin/main` after the previous pull to this booth
checkout, then verify.

Do this:

1. Check whether this checkout has uncommitted local changes. If it does, create
   a backup branch first and **do not discard them**.
2. Confirm `.env.local` and `.booth-storage/` are intact before and after.
3. Fetch and apply. Resolve only genuine conflicts.
4. **Set `CARDIFYBOOTH_PRINTER_NAME`** in `.env.local` — see "Printer setup"
   below. **Skip this and the sheet will not be cut.**
5. Run `npm run build`. Do **not** run `npm install` — no dependencies changed.
6. Restart the kiosk app.
7. Work through "Booth smoke test" below.

---

## How the strip border fix works

### Before (broken)

`PhotoCollage.tsx` rendered a single 360×960 strip canvas. The print script
(`print-card.ps1`, `DoubleStrip4x6` mode) drew this strip into each half of the
4×6 page using `Math::Max` (fill). Fill scaled the strip up to overshoot each
half horizontally, then clipped the overflow. The outer edges of the strip's
background padding were always clipped — so after the center cut, each strip had
no visible coloured border on its outer edge but some on its inner (cut) edge.

### After (fixed)

`PhotoCollage.tsx` now composes the full 4×6 sheet in a `composeForPrint()`
function before sending it to print:

```
Canvas: 640 × 960 (exactly 4:6 ratio)
Background: bgColor filling the entire canvas

G = 24 px (center gutter)
outer margin = G/2 = 12 px

|<- G/2 ->|<- strip ->|<-  G  ->|<- strip ->|<- G/2 ->|
                        ^ CUT HERE

After cut:
|<- G/2 ->|<- strip ->|<- G/2 ->|    <- EQUAL on both sides
```

Each strip is fitted (not filled) into its slot, preserving aspect ratio. The
entire canvas is pre-filled with the background colour, so there is no white
paper anywhere.

The print script detects the pre-composed image by its aspect ratio (~0.667 for
4:6 vs ~0.375 for a single 2:6 strip). When detected, it fills the whole page
with the single image instead of duplicating. The strip queue lookup (for the
cutter) is unchanged — it still fires on `DoubleStrip4x6` mode.

## Changed files

### Canvas composition

- `src/components/PhotoCollage.tsx`
  - Removed white `fillRect` behind ICL logo (was lines 381-382)
  - Added static QR code for `https://icl.sites.gettysburg.edu/` to the bottom left of the printed strip.
  - Replaced `overflow-y-auto` with `overflow-hidden` on the layout screen to prevent unwanted scrolling.
  - Added `composeForPrint()` function — creates a 640x960 canvas with two
    strips at proper gutter spacing
  - Modified `handlePrint()` to compose the double strip before sending to the
    print API

### Print script

- `scripts/print-card.ps1`
  - Portrait branch of `DoubleStrip4x6` now checks
    `$imageAspect > $halfAspect * 1.5` to detect pre-composed images
  - Pre-composed: fills the whole page (single draw, no duplication)
  - Single strip: duplicates as before (backwards compatible)

### No API changes

The print route (`src/app/api/collage/print/route.ts`) is unchanged. Mode is
still `DoubleStrip4x6`. The strip queue lookup still works.

---

## Printer setup (CRITICAL)

The cutter is controlled by a dedicated printer queue, **not by this script**.
The script finds the queue by name and sends the job there. If the queue is
missing, the job goes to the default printer and the sheet comes out uncut.

### Required `.env.local` setting

```env
CARDIFYBOOTH_PRINTER_NAME=<exact name of your DNP printer>
```

Find the name by running in PowerShell on the booth:

```powershell
Get-Printer | Select-Object Name
```

Look for the DNP printer (e.g. `DNP DS-RX1`). Set that as the value.

### Strip queue

The script appends `-Strips` to the printer name (e.g. `DNP DS-RX1-Strips`) and
looks for a queue with that name. If found, the job is sent there and the queue's
cut setting fires. If not found, it warns and sends to the base printer (no cut).

To override the strip queue name:

```env
CARDIFYBOOTH_STRIP_PRINTER_NAME=<exact name of the strip queue>
```

### If the queue does not exist

Create it in Windows:
1. Add Printer -> Local printer -> Use existing port
2. Pick the same port as the DNP printer
3. Name it `<PrinterName>-Strips`
4. In the driver settings, enable the 2-inch cut option

---

## Booth smoke test

1. **Print a 4-shot collage.** Confirm the coloured background reaches all four
   paper edges with no white margin.
2. **Cut the sheet down the centre.** Confirm both strips have equal coloured
   borders on their left and right sides.
3. **Check the ICL logo and QR code.** Confirm the ICL logo renders without a white rectangle behind
   it (transparent background, blending into the strip colour), and the QR code pointing to the ICL website appears on the opposite side.
4. Run 2-shot and 3-shot sessions and confirm they print correctly.
5. Print a trading card and confirm Fill4x6 is unchanged.

## Download QR

If the download QR is not showing on the final screen, the booth needs commit
`030bf94` (`fix: imply local download mode from the hotspot SSID`). After
pulling:

1. Set in `.env.local`:
   ```env
   NEXT_PUBLIC_CARDIFYBOOTH_HOTSPOT_SSID=<hotspot name>
   NEXT_PUBLIC_CARDIFYBOOTH_HOTSPOT_PASSWORD=<hotspot password>
   ```
2. Ensure Windows Firewall allows port 3000 on the private network.
3. The download QR will now render automatically.
