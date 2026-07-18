# CardifyBooth

CardifyBooth is a privacy-minded photo booth kiosk for creating Gettysburg College-themed collectible trading cards and photo strips. It captures portraits locally, generates a card identity from a short self-description, renders a print-ready PNG, and stores the final output on the booth computer for printing.

## Demo

<p align="center">
  <img src="docs/screenshots/03-card.png" alt="Generated CardifyBooth trading card" width="320">
</p>

The booth flow, from capture to print-ready card:

| 1. Capture & describe | 2. Generated card |
| --- | --- |
| ![Capture screen with camera preview and card details form](docs/screenshots/01-capture.png) | ![Card reveal screen with the final card and download options](docs/screenshots/02-reveal.png) |

## Current Features

- Four-panel kiosk home with trading cards, photo collage, and Ghost Runner
- Fullscreen Ghost Runner control with a visible Home action while fullscreen
- Camera-first card capture with sample-photo fallback for testing
- Automatic external-webcam preference, remembered camera selection, mirrored preview, and three-second countdown
- OpenAI generation for traits, scores, rarity, card title, Known For line, special ability, and card background choice
- Structured JSON generation with Zod validation
- Deterministic local fallback card generation when no OpenAI key is configured
- Gettysburg College-themed card renderer with rarity, trait bars, Campus Power, Known For, and Special Ability
- Local PNG storage in `.booth-storage/cards`
- Local SQLite metadata storage in `.booth-storage/cardifybooth.db`
- Bounded local cache that keeps the newest 100 cards and removes the oldest PNG and metadata together
- Public HTTPS phone-download QR for finished cards and collages using Vercel Blob
- Public output cleanup that keeps the newest 100 downloadable PNGs
- Raw camera portraits are not uploaded for phone downloads; only finished composite PNGs are uploaded
- Silent Windows kiosk printing for the final saved PNG
- Borderless 4x6 card fill mode that removes left/right white bars
- Photo collage strips print the exact rendered canvas PNG through the same local Windows printer bridge
- Three-second collage countdown and direct drag-from-palette sticker placement
- Streaming speech transcription and an on-screen keyboard in the card form

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- OpenAI Responses API
- SQLite with `better-sqlite3`
- Zod
- `html-to-image`
- `qrcode`

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create `.env.local` from `.env.example`:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
CARDIFYBOOTH_PRINTER_NAME=
BLOB_READ_WRITE_TOKEN=
```

The app still works without `OPENAI_API_KEY`; it uses the local fallback generator.
Leave `CARDIFYBOOTH_PRINTER_NAME` blank to print to the Windows default printer.
Set `BLOB_READ_WRITE_TOKEN` to enable Internet-accessible QR downloads. The booth still prints and saves locally when that token is absent.

## Local Storage

Generated cards are stored locally on the booth computer:

```txt
.booth-storage/
  cardifybooth.db
  cards/
    {cardId}.png
```

The PNG file is the actual final card image. SQLite stores the metadata that points to that PNG, including display name, rarity, trait scores, Campus Power, print status, creation time, and expiration time.

The booth retains at most 100 card records. After a new card is saved successfully, the oldest PNG and its matching SQLite row are removed when the cache is over that limit.

## Card Flow

```txt
Card Booth
-> capture photo
-> enter name and self-description
-> generate card identity
-> render final card PNG
-> save PNG locally
-> insert SQLite metadata row
-> print saved PNG through the local Windows printer bridge
-> upload only the finished PNG to public temporary storage
-> QR points directly to the public PNG download
```

## Important Files

- `src/components/BoothApp.tsx`: main kiosk flow
- `src/components/ImageUpload.tsx`: camera capture and sample input
- `src/components/CardForm.tsx`: name and self-description form
- `src/components/CardPreview.tsx`: card renderer
- `src/components/CardReveal.tsx`: final reveal, PNG export, local autosave
- `src/app/api/generate-card/route.ts`: card generation API
- `src/app/api/local-cards/route.ts`: local PNG and metadata save API
- `src/app/api/local-cards/[id]/image/route.ts`: local saved PNG image endpoint
- `src/app/api/local-cards/[id]/print/route.ts`: silent kiosk print endpoint for saved PNG files
- `src/app/api/collage/print/route.ts`: silent kiosk print endpoint for rendered collage PNG files
- `src/app/api/public-downloads/route.ts`: public finished-PNG upload and 100-file cleanup
- `src/app/local-cards/[id]/page.tsx`: optional local saved-card viewer
- `src/lib/card-generation.ts`: OpenAI prompt, structured output, validation, fallback
- `src/lib/card-templates.ts`: available visual card backgrounds and fallback keyword matching
- `src/lib/local-card-storage.ts`: saves PNG file and creates metadata record
- `src/lib/local-card-db.ts`: SQLite table, insert, and fetch helpers
- `src/lib/local-card-printer.ts`: calls the Windows print helper
- `src/lib/png-data-url.ts`: validates browser-rendered PNG data URLs before local save/print
- `scripts/print-card.ps1`: renders a PNG onto the configured printer without a browser dialog

## Privacy Note

The final card PNG and card metadata are saved locally. When `OPENAI_API_KEY`
is configured, the self-description is sent to OpenAI to generate the card
identity. Leave the key unset to use the deterministic local fallback.

When phone downloads are enabled, only the finished composited card or collage
PNG is uploaded to the configured public Blob store. Raw camera captures and
SQLite metadata remain on the booth computer. Public storage is capped at the
newest 100 outputs; because those URLs are public, the event privacy notice
should clearly tell guests that scanning creates a bounded cloud copy.
