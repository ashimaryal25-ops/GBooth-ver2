import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { printLocalCardPng } from "@/lib/local-card-printer";
import { decodePngDataUrl } from "@/lib/png-data-url";

export const runtime = "nodejs";

const printCollageSchema = z.object({
  imageDataUrl: z.string().startsWith("data:image/png;base64,"),
});

const storageRoot = path.join(process.cwd(), ".booth-storage");
const collagePrintDir = path.join(storageRoot, "collage-print");

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = printCollageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid collage print request." }, { status: 400 });
  }

  try {
    await mkdir(collagePrintDir, { recursive: true });

    const pngBuffer = decodePngDataUrl(parsed.data.imageDataUrl);
    const imagePath = path.join(collagePrintDir, `collage-${crypto.randomUUID()}.png`);

    await writeFile(imagePath, pngBuffer);

    const result = await printLocalCardPng(imagePath, {
      jobName: "CardifyBooth collage",
      mode: "DoubleStrip4x6",
    });

    return NextResponse.json({
      ok: true,
      printerName: result.printerName,
    });
  } catch (error) {
    console.error("Could not print collage.", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send collage to the kiosk printer.",
      },
      { status: 500 },
    );
  }
}
