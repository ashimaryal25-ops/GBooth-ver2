import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decodePngDataUrl } from "@/lib/png-data-url";

export const runtime = "nodejs";

/**
 * Prepares the PNG behind the on-screen download QR, in one of two modes:
 *
 *   local  - the booth serves the file itself over its own Wi-Fi hotspot.
 *            Guests' photos never leave this machine, which is the point:
 *            the booth is used by minors and nothing should sit on a public
 *            URL. Enabled by CARDIFYBOOTH_LOCAL_DOWNLOAD_BASE_URL.
 *   blob   - uploads to a public Vercel Blob store, for when phones cannot
 *            reach the booth directly. Enabled by BLOB_READ_WRITE_TOKEN.
 *
 * Local mode wins when both are configured. With neither, the route reports
 * "not configured" and the kiosk hides the QR rather than failing.
 *
 * Either way the response shape is the same, so callers never care which ran.
 */

const uploadSchema = z.object({
  kind: z.enum(["card", "collage"]),
  id: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/),
  imageDataUrl: z.string().startsWith("data:image/png;base64,"),
});

// A download link is only useful while the guest is at the final screen (30s)
// plus however long their phone takes to open it. Nothing in the app reads
// these again, so they are pulled shortly after the guest leaves rather than
// lingering. The window still covers a phone that was locked or on bad signal.
const maxPublicOutputAgeMs = 30 * 60 * 1000;
const maxPublicOutputs = 50;

const blobPrefix = "cardifybooth/";
const storageRoot = path.join(process.cwd(), ".booth-storage");
const downloadsDir = path.join(storageRoot, "public-downloads");

/**
 * Windows Mobile Hotspot always puts this machine on 192.168.137.1, so prefer
 * that address when several interfaces are up (campus ethernet plus the
 * hotspot is the normal booth setup, and only the hotspot is reachable by the
 * guest's phone).
 */
function detectLanBaseUrl(request: Request): string | null {
  const addresses: string[] = [];

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  if (addresses.length === 0) return null;

  const hotspot = addresses.find((address) => address.startsWith("192.168.137."));
  const port = new URL(request.url).port || "3000";

  return `http://${hotspot ?? addresses[0]}:${port}`;
}

function resolveLocalBaseUrl(request: Request): string | null {
  const configured = process.env.CARDIFYBOOTH_LOCAL_DOWNLOAD_BASE_URL?.trim();
  if (!configured) return null;

  const base =
    configured.toLowerCase() === "auto" ? detectLanBaseUrl(request) : configured;

  return base ? base.replace(/\/+$/, "") : null;
}

async function pruneLocalDownloads() {
  const entries = await readdir(downloadsDir).catch(() => [] as string[]);
  const expiredBefore = Date.now() - maxPublicOutputAgeMs;

  const files = (
    await Promise.all(
      entries
        .filter((name) => name.endsWith(".png"))
        .map(async (name) => {
          const filePath = path.join(downloadsDir, name);
          try {
            return { filePath, modifiedAt: (await stat(filePath)).mtimeMs };
          } catch {
            return null;
          }
        }),
    )
  ).filter((file): file is { filePath: string; modifiedAt: number } => file !== null);

  const stale = files
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .filter(
      (file, index) =>
        index >= maxPublicOutputs || file.modifiedAt < expiredBefore,
    );

  await Promise.all(stale.map((file) => unlink(file.filePath).catch(() => {})));
}

async function pruneOldPublicOutputs() {
  const result = await list({ prefix: blobPrefix, limit: 1000 });
  const newestFirst = result.blobs.sort(
    (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
  );
  const expiredBefore = Date.now() - maxPublicOutputAgeMs;
  const staleBlobs = newestFirst.filter(
    (blob, index) =>
      index >= maxPublicOutputs || blob.uploadedAt.getTime() < expiredBefore,
  );

  if (staleBlobs.length > 0) {
    await del(staleBlobs.map((blob) => blob.url));
  }
}

export async function POST(request: Request) {
  const localBaseUrl = resolveLocalBaseUrl(request);
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!localBaseUrl && !blobToken) {
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

    if (localBaseUrl) {
      const fileId = `${parsed.data.kind}-${parsed.data.id}`;
      await mkdir(downloadsDir, { recursive: true });
      await writeFile(path.join(downloadsDir, `${fileId}.png`), png);

      try {
        await pruneLocalDownloads();
      } catch (error) {
        // The new download is still valid if cleanup has a transient failure.
        console.warn("Could not prune old local booth downloads.", error);
      }

      const url = `${localBaseUrl}/api/local-downloads/${fileId}`;

      return NextResponse.json({ url, downloadUrl: `${url}?download=1` });
    }

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
      console.warn("Could not prune old public booth downloads.", error);
    }

    return NextResponse.json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
    });
  } catch (error) {
    console.error("Could not prepare the booth download.", error);
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
