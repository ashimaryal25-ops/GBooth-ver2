import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Serves a guest's finished PNG straight off the booth's own disk, for the
 * offline delivery mode where the booth runs its own Wi-Fi hotspot and the
 * phone downloads directly from this machine. Nothing is uploaded anywhere, so
 * guests' photos never reach a third party — the reason this mode exists.
 *
 * Written by POST /api/public-downloads when a local base URL is configured.
 */

interface LocalDownloadRouteProps {
  params: Promise<{
    id: string;
  }>;
}

const storageRoot = path.join(process.cwd(), ".booth-storage");
const downloadsDir = path.join(storageRoot, "public-downloads");

// Wider than the upload id schema because the stored name is "<kind>-<id>".
const fileIdSchema = z.string().regex(/^[a-zA-Z0-9-]{8,100}$/);

export async function GET(request: Request, { params }: LocalDownloadRouteProps) {
  const { id } = await params;
  const parsedId = fileIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid download id." }, { status: 400 });
  }

  const absolutePngPath = path.resolve(downloadsDir, `${parsedId.data}.png`);
  const expectedRoot = path.resolve(downloadsDir);

  if (!absolutePngPath.startsWith(expectedRoot + path.sep)) {
    return NextResponse.json({ error: "Invalid download path." }, { status: 400 });
  }

  try {
    const image = await readFile(absolutePngPath);
    const wantsAttachment =
      new URL(request.url).searchParams.get("download") === "1";

    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      // These expire quickly by design; never let a phone or proxy hold one.
      "Cache-Control": "no-store",
    };

    if (wantsAttachment) {
      headers["Content-Disposition"] =
        `attachment; filename="${parsedId.data}.png"`;
    }

    return new Response(new Uint8Array(image), { headers });
  } catch {
    // Also the expected path once the 30-minute cleanup has removed the file.
    return NextResponse.json(
      { error: "This download has expired." },
      { status: 404 },
    );
  }
}
