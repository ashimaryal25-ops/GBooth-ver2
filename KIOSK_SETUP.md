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
6. Configure the kiosk printer.

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

Photo collage prints use roll-style sizing: the print job requests a fixed 4-inch paper width and calculates the paper length from the rendered strip image. This lets the printer cut a shorter or longer strip for 2, 3, or 4-photo layouts when the printer driver supports custom roll/cut lengths.

7. Build and run:

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
