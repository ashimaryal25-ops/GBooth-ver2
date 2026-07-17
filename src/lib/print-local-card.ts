import { z } from "zod";

const printLocalCardResponseSchema = z.object({
  ok: z.literal(true),
  printStatus: z.literal("printed"),
  printerName: z.string().nullable(),
});

export async function printLocalCard(id: string) {
  const response = await fetch(`/api/local-cards/${id}/print`, {
    method: "POST",
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Could not send card to the kiosk printer.";

    throw new Error(message);
  }

  return printLocalCardResponseSchema.parse(data);
}
