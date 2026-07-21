You're on the Gettysburg College CardifyBooth kiosk PC (Windows/PowerShell, DNP DS-RX1 printer, two displays). Deploy the working app into a NEW folder and make the photo-collage print CUT a 4×6 into two clean 2×6 strips. The old install is broken (prints uncut) — leave it alone, stand this up beside it.

BE EFFICIENT: do NOT explore or read the source code. Just run these steps. Only open docs/BOOTH_TRANSFER_2026-07-21.md if a step actually fails. Ask the person running this booth for any value you don't have (printer/queue names) instead of hunting for it.

1. git lfs install
   git clone https://github.com/ashimaryal25-ops/gbooth_ver3.git C:\CardifyBooth-v2
   cd C:\CardifyBooth-v2
   git lfs pull
   npm install
2. Create .env.local (gitignored, not in the clone). Reuse the old install's values if the operator has them. It MUST include the two printer keys in step 3. Do NOT set NEXT_PUBLIC_DEV_CAMERA (laptop-only; the booth uses the camera mirror).
3. THE CUT (main task): the 2-inch cut lives on a DNP printer QUEUE, not the app. For collage jobs the app sends to CARDIFYBOOTH_STRIP_PRINTER_NAME, else "<CARDIFYBOOTH_PRINTER_NAME>-Strips". Run `Get-Printer | Select-Object Name`, ask the operator which queue has the 2-inch cut enabled, then set in .env.local:
     CARDIFYBOOTH_PRINTER_NAME=<base DNP name>
     CARDIFYBOOTH_STRIP_PRINTER_NAME=<the queue whose 2-inch cut is ON>
   (Same name is fine if the base queue is the one that cuts.)
4. Launch: double-click Start-CardifyBooth.bat (opens kiosk on the primary display + camera mirror on the second; add -SwapMonitors if reversed). This IS the start button — don't build one.
5. Verify: print one collage, read the server console window it opened. It logs "using strip queue '<name>' (this is the queue that cuts)" = good, or "strip queue '<name>' NOT FOUND ... WILL NOT BE CUT" = fix the name to a listed queue. Then confirm physically: two 2×6 strips, cut at center, equal borders, no white margin. Repeat for 2/3/4-shot.

Don't edit print-card.ps1, src/proxy.ts, or public/collage/*. Never touch .env.local or .booth-storage. Report each check as pass/fail.
