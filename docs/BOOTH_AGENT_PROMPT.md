# Executable prompt — booth-PC agent

Paste everything in the fenced block below into a fresh Claude Code session
**running on the Gettysburg College booth PC (Windows)**. It is self-contained.

---

```
You are Claude Code running on the Gettysburg College "CardifyBooth" kiosk PC (Windows, PowerShell, likely two displays + a DNP DS-RX1 dye-sub printer).

GOAL
Stand up the current working CardifyBooth in a NEW folder and get the PHOTO-COLLAGE print to cut a 4×6 sheet into TWO CLEAN 2×6 strips. The booth's existing install is broken (it prints the 4×6 but does not cut it in two). Do NOT repair the old install — deploy this fresh version alongside it and switch over.

FIRST, READ THIS
Clone the repo, then open and follow docs/BOOTH_TRANSFER_2026-07-21.md. It has the full detail; the summary below is the plan. Also skim docs/BOOTH_UPDATE_STRIP_FIX.md and docs/BOOTH_UPDATE_2026-07-20.md for print-geometry history.

PLAN
1. Clone into a new folder (do not disturb the old install or its .env.local / .booth-storage):
     git clone --branch booth-deploy-2026-07-21 https://github.com/ashimaryal25-ops/GBooth-ver2.git C:\CardifyBooth-v2
     cd C:\CardifyBooth-v2
     npm install
2. Create .env.local (it is gitignored, NOT in the clone). Reuse the old install's values if sound. It MUST have the printer keys (step 4).
3. Do NOT set NEXT_PUBLIC_DEV_CAMERA — that is a laptop-only flag that bypasses the camera mirror with a local webcam. The booth must use the mirror.
4. FIX THE CUT (the main task). The cut is done by a DNP QUEUE with the "2 inch cut" enabled, not by the app. For collage jobs the app sends to, in order: $env:CARDIFYBOOTH_STRIP_PRINTER_NAME, else "<CARDIFYBOOTH_PRINTER_NAME>-Strips". The cut only fires on whichever queue the job actually reaches.
     - Run:  Get-Printer | Select-Object Name
     - Identify the DNP printer and which queue has the 2-inch cut enabled.
     - In .env.local set:
         CARDIFYBOOTH_PRINTER_NAME=<exact base DNP name>
         CARDIFYBOOTH_STRIP_PRINTER_NAME=<exact name of the queue whose 2-inch cut is ON>
       (They can be the same name if the base queue is the one that cuts.) Alternatively create a "<PrinterName>-Strips" queue on the DNP port with the 2-inch cut enabled.
5. Launch:  double-click Start-CardifyBooth.bat  (or:  powershell -ExecutionPolicy Bypass -File Start-CardifyBooth.ps1 ). It builds, starts the server, opens the KIOSK fullscreen on the PRIMARY display and the CAMERA MIRROR (/camera-mirror.html) fullscreen on the SECOND display. Use -SwapMonitors if the two screens are reversed; -Dev to iterate without a prod build. This launcher IS the "start button" that wires both screens — you do not need to build that.
6. VERIFY THE CUT: run one collage print, then read the server console window that Start-CardifyBooth opened. print-card.ps1's output is echoed there. It prints either:
     "Collage mode: using strip queue '<name>' (this is the queue that cuts)."   → good
     "...strip queue '<name>' NOT FOUND ... THE SHEET WILL NOT BE CUT"           → fix the name to match one of the listed queues
   Then physically confirm: colour bleeds to all four edges (no white margin), the cut is at the exact centre, and BOTH 2×6 strips have EQUAL borders left and right. Repeat for 2-, 3-, and 4-shot strips.

HARD CONSTRAINTS
- Never overwrite or delete .env.local or .booth-storage/ (guests' PNGs + SQLite live there; both gitignored).
- Do not edit the cut/draw math in scripts/print-card.ps1. If a print is MISALIGNED (not just tighter), tune CARDIFYBOOTH_COLLAGE_OFFSET_X / _OFFSET_Y in .env.local — the script already reads them.
- Do not touch src/proxy.ts (LAN guard) or public/collage/* (dead legacy page).
- Do not enable NEXT_PUBLIC_DEV_CAMERA on the booth.

REPORT BACK
For each smoke-test item in docs/BOOTH_TRANSFER_2026-07-21.md, report pass/fail with what you saw — especially the collage cut producing two clean equal strips, and the camera mirror showing live on the second display.
```

---

### Context for the human running this

- The **cut is queue-based** — this is the single most likely cause of "won't cut"
  and the first thing the agent checks. Have the DNP queue names and cut setting
  ready.
- The **launcher already opens kiosk-on-primary + mirror-on-secondary**; no
  start-button code needs to be written.
- **dev-camera stays on the laptop only.** The booth uses the camera-mirror
  window on the second screen.
- Bring the old install's `.env.local` values (printer name, OpenAI key, hotspot
  SSID/password, low-roll alert) so the new folder matches.
