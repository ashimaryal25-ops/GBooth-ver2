import { z } from "zod";
import { cardTemplateIds } from "@/lib/card-templates";

export const raritySchema = z.enum([
  "Common",
  "Rare",
  "Epic",
  "Legend",
  "Campus Myth",
]);

export const cardSchema = z.object({
  displayName: z.string().min(1).max(28),
  cardTitle: z.string().min(3).max(42),
  type: z.array(z.string().min(2).max(22)).min(1).max(3),
  rarity: raritySchema,
  stats: z
    .record(z.string().min(2).max(24), z.number().int().min(60).max(99))
    .refine((stats) => Object.keys(stats).length === 4, {
      message: "A card needs exactly three trait scores plus Campus Power.",
    })
    .refine((stats) => typeof stats["Campus Power"] === "number", {
      message: "A card needs a Campus Power score.",
    }),
  specialAbility: z.string().min(3).max(34),
  description: z.string().min(12).max(150),
  colorTheme: z.enum(cardTemplateIds),
});

export const cardRequestSchema = z.object({
  name: z.string().trim().min(1).max(28),
  theme: z.string().trim().min(1).max(40),
  selfDescription: z.string().trim().min(8).max(220),
});

export type CardIdentity = z.infer<typeof cardSchema>;
export type CardRequest = z.infer<typeof cardRequestSchema>;
