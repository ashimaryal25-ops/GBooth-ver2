import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLocalCardRecord } from "@/lib/local-card-db";

export const runtime = "nodejs";

interface LocalCardImageRouteProps {
  params: Promise<{
    id: string;
  }>;
}

const storageRoot = path.join(process.cwd(), ".booth-storage");
const cardIdSchema = z.string().uuid();

export async function GET(_request: Request, { params }: LocalCardImageRouteProps) {
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

  try {
    const image = await readFile(absolutePngPath);

    return new Response(image, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Saved card image missing." }, { status: 404 });
  }
}
