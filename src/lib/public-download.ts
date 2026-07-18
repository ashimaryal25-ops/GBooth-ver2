import { z } from "zod";

const publicDownloadResponseSchema = z.object({
  url: z.string().url(),
  downloadUrl: z.string().url(),
});

type PublicDownloadKind = "card" | "collage";

export async function uploadPublicPng(input: {
  kind: PublicDownloadKind;
  id: string;
  imageDataUrl: string;
}) {
  const response = await fetch("/api/public-downloads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Could not prepare the phone download.";
    throw new Error(message);
  }

  return publicDownloadResponseSchema.parse(data);
}
