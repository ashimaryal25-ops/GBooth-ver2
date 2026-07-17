import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getLocalCardRecord,
  updateLocalCardPrintStatus,
} from "@/lib/local-card-db";
import { printLocalCardPng } from "@/lib/local-card-printer";

export const runtime = "nodejs";

interface LocalCardPrintRouteProps {
  params: Promise<{
    id: string;
  }>;
}

const storageRoot = path.join(process.cwd(), ".booth-storage");
const cardIdSchema = z.string().uuid();

export async function POST(_request: Request, { params }: LocalCardPrintRouteProps) {
  const { id } = await params;
  const parsedId = cardIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid saved card id." }, { status: 400 });
  }

  const record = getLocalCardRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Saved card not found." }, { status: 404 });
  }

  const absolutePngPath = path.resolve(storageRoot, record.cardPngPath);
  const expectedRoot = path.resolve(storageRoot);

  if (!absolutePngPath.startsWith(expectedRoot + path.sep)) {
    return NextResponse.json({ error: "Invalid saved card path." }, { status: 400 });
  }

  updateLocalCardPrintStatus(id, "requested");

  try {
    updateLocalCardPrintStatus(id, "printing");
    const result = await printLocalCardPng(absolutePngPath);
    updateLocalCardPrintStatus(id, "printed");

    return NextResponse.json({
      ok: true,
      printStatus: "printed",
      printerName: result.printerName,
    });
  } catch (error) {
    updateLocalCardPrintStatus(id, "failed");
    console.error("Could not print saved card.", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send card to the kiosk printer.",
      },
      { status: 500 },
    );
  }
}
