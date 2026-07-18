# CardifyBooth kiosk setup

This folder is the clean transfer copy of the booth app.

## What is included

- Main Next.js booth app
- On-screen keyboard flow
- Photo card flow
- Photo collage files
- LCD/camera mirror page at `public/camera-mirror.html`
- Public card/template assets

Generated folders are intentionally not included: `node_modules`, `.next`, `.git`, local storage folders, and logs.

## Setup on the kiosk computer

1. Install Node.js LTS if it is not already installed.
2. Open PowerShell in this folder.
3. Install dependencies:

```powershell
npm install
```

4. Create `.env.local` from `.env.example`:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

5. Fill in `OPENAI_API_KEY` in `.env.local`.
6. Configure public phone downloads.

Create a public Vercel Blob store for the booth project, then copy its
`BLOB_READ_WRITE_TOKEN` into `.env.local`:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

The token stays in the local Next.js server environment. It is not included in
the QR or browser JavaScript. The app uploads only the finished card/collage
PNG, never the separate raw camera portrait. It keeps the newest 100 public
outputs and removes older ones.

Without this token, local save and printing still work, but the final screen
shows that phone download is unavailable.

7. Configure the kiosk printer.

To use the Windows default printer, leave this blank in `.env.local`:

```env
CARDIFYBOOTH_PRINTER_NAME=
```

To force a specific printer, list installed printer names:

```powershell
Get-Printer | Select-Object Name
```

Copy the exact printer name into `.env.local`:

```env
CARDIFYBOOTH_PRINTER_NAME=Your Exact Printer Name
```

The app prints saved final PNG files through `scripts/print-card.ps1`. It does not use browser printing and does not open a print preview. Trading cards print the saved card PNG, and photo collage strips print the exact rendered collage canvas PNG.

Trading cards use a 4x6 fill mode. It fills the full sheet and allows a small
top/bottom bleed so white bars do not appear on the left and right. Photo
collages use the configured 4x6 double-strip layout.

8. Build and run:

```powershell
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

## URLs

Main kiosk screen:

```text
http://localhost:3000/
```

LCD/camera mirror screen on the same kiosk computer:

```text
http://localhost:3000/camera-mirror.html
```

If the mirror is opened from another computer or display device on the same network, use the kiosk computer IP:

```text
http://KIOSK-IP-ADDRESS:3000/camera-mirror.html
```

## Browser permissions

Allow camera and microphone permission when the browser asks. The main booth page controls the camera capture. The mirror page listens for the camera countdown/status from the main page.

## Printing check

Card print:

1. Generate a card at `http://localhost:3000/`.
2. Wait until the reveal screen says the final card PNG is saved locally.
3. Click `Print card`.
4. The kiosk sends `.booth-storage/cards/{cardId}.png` directly to the configured Windows printer.

Collage print:

1. Open `Photo Collage`.
2. Capture the strip, decorate it, then go to export.
3. Click `Print Now`.
4. The kiosk sends the exact collage canvas PNG directly to the configured Windows printer.

If printing fails, confirm the printer name in `.env.local`, make sure Windows can print to that device, then restart the kiosk app so the environment setting is reloaded.

## Phone download check

1. Confirm the booth computer has Internet access.
2. Generate a card or finish a collage.
3. Wait for the download QR to appear.
4. Scan it with a phone that is not connected to the booth computer.
5. Confirm the PNG downloads from an HTTPS Vercel Blob URL.

The printed card and strip keep the ICL logo. The phone-download QR is displayed
beside the output on screen and is not baked into the physical print.
