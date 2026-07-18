import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decodePngDataUrl } from "@/lib/png-data-url";

export const runtime = "nodejs";

const uploadSchema = z.object({
  kind: z.enum(["card", "collage"]),
  id: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/),
  imageDataUrl: z.string().startsWith("data:image/png;base64,"),
});

const blobPrefix = "cardifybooth/";
const maxPublicOutputs = 100;

async function pruneOldPublicOutputs() {
  const result = await list({ prefix: blobPrefix, limit: 1000 });
  const oldBlobs = result.blobs
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    .slice(maxPublicOutputs);

  if (oldBlobs.length > 0) {
    await del(oldBlobs.map((blob) => blob.url));
  }
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Phone downloads are not configured on this booth yet." },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid public download request." }, { status: 400 });
  }

  try {
    const png = decodePngDataUrl(parsed.data.imageDataUrl);
    const pathname = `${blobPrefix}${parsed.data.kind}/${parsed.data.id}.png`;
    const blob = await put(pathname, png, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
      cacheControlMaxAge: 60,
    });

    try {
      await pruneOldPublicOutputs();
    } catch (error) {
      // The new download is still valid if cleanup has a transient failure.
      console.warn("Could not prune old public booth downloads.", error);
    }

    return NextResponse.json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
    });
  } catch (error) {
    console.error("Could not upload public booth output.", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not prepare the phone download.",
      },
      { status: 500 },
    );
  }
}
