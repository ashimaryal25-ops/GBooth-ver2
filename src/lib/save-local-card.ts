import { z } from "zod";
import type { CardIdentity } from "@/lib/card-schema";

const localCardRecordSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  rarity: z.string(),
  traitScores: z.record(z.string(), z.number()),
  campusPower: z.number(),
  knownFor: z.string(),
  specialAbility: z.string(),
  cardPngPath: z.string(),
  cardUrl: z.string(),
  printStatus: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

const saveLocalCardResponseSchema = z.object({
  record: localCardRecordSchema,
});

export async function saveLocalCardPrint(params: {
  id: string;
  card: CardIdentity;
  imageDataUrl: string;
}) {
  const response = await fetch("/api/local-cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Could not save card locally.");
  }

  const data: unknown = await response.json();
  return saveLocalCardResponseSchema.parse(data);
}