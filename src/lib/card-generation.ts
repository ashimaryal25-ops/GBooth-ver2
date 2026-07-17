import { z } from "zod";
import {
  cardTemplateIds,
  getCardTemplatePromptCatalog,
  resolveTemplateId,
} from "@/lib/card-templates";
import { cardSchema, raritySchema, type CardIdentity, type CardRequest } from "@/lib/card-schema";
import { createFallbackCard } from "@/lib/fallback-card";
import { gettysburgTheme } from "@/lib/themes";

type GenerationSource = "openai" | "fallback";

export interface CardGenerationResult {
  card: CardIdentity;
  source: GenerationSource;
  model: string;
  durationMs: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  error?: string;
}

const CARD_IDENTITY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "cardTitle",
    "traits",
    "campusPower",
    "rarity",
    "knownFor",
    "specialAbility",
    "colorTheme",
  ],
  properties: {
    cardTitle: { type: "string" },
    traits: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score"],
        properties: {
          name: { type: "string", enum: gettysburgTheme.traits },
          score: { type: "integer", minimum: 60, maximum: 99 },
        },
      },
    },
    campusPower: { type: "integer", minimum: 60, maximum: 99 },
    rarity: {
      type: "string",
      enum: gettysburgTheme.rarities,
    },
    knownFor: { type: "string" },
    specialAbility: { type: "string" },
    colorTheme: { type: "string", enum: cardTemplateIds },
  },
} as const;

const aiCardContentSchema = z.object({
  cardTitle: z.string().min(3).max(42),
  traits: z.array(z.object({
    name: z.enum(gettysburgTheme.traits),
    score: z.number().int().min(60).max(99),
  })).length(3),
  campusPower: z.number().int().min(60).max(99),
  rarity: raritySchema,
  knownFor: z.string().min(8).max(140),
  specialAbility: z.string().min(3).max(34),
  colorTheme: z.enum(cardTemplateIds),
});

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function buildSystemPrompt() {
  return [
    "You generate collectible campus trading-card identities for CardifyBooth.",
    "Return strict JSON only. Do not include markdown, prose, comments, or code fences.",
    "The app controls card layout and display name, so you only generate the card identity/content.",
    "Use a playful but printable Gettysburg College campus tone.",
    "Avoid insults, sensitive personal attributes, stereotypes, and private information.",
    `Allowed traits: ${gettysburgTheme.traits.join(", ")}.`,
    `Allowed rarities: ${gettysburgTheme.rarities.join(", ")}.`,
    "Choose colorTheme from the allowed card template ids only. The chosen template should match the person's self-description, selected traits, and overall card energy.",
    "The 'gettysburg-gold' template is the rarest, most powerful card. Only choose it when the card is Legend or Campus Myth and every trait plus Campus Power is roughly 90 or higher (someone maxing out campus contribution). For all other people, choose a casual themed template that fits them, never gettysburg-gold.",
    "Create an original Gettysburg College-themed card title. It may reference campus life, Bullet pride, first-year energy, clubs, making/building, classes, or student leadership, but do not copy a fixed title list.",
    "Pick exactly three traits that best match the user's self-description.",
    "Return traits as an array of exactly three objects with name and score.",
    "Trait scores must be integers from 60 to 99 based on evidence in the sentence.",
    "Use this score rubric: 60-69 weak/vague evidence, 70-79 moderate evidence, 80-88 strong evidence, 89-95 exceptional evidence, 96-99 extremely rare/mythic evidence.",
    "Do not reward generic self-praise too highly. Concrete actions, difficulty, impact, and pressure should score higher than vague claims.",
    "Campus Power should be the overall score, roughly the average of the three trait scores with small adjustment for sentence quality.",
    "Use this rarity rubric: 60-69 Common, 70-79 Rare, 80-88 Epic, 89-95 Legend, 96-99 Campus Myth.",
    "Most normal cards should be Rare or Epic. Legend should be uncommon. Campus Myth should be extremely rare.",
    "knownFor should be one sentence fragment without the words 'Known for'.",
    "Return exactly one JSON object for exactly one card.",
  ].join("\n");
}

function buildUserPrompt(input: CardRequest) {
  return JSON.stringify({
    task: "Create one Gettysburg College Edition CardifyBooth identity.",
    userInput: {
      selfDescription: input.selfDescription,
      theme: input.theme,
    },
    cardTemplateOptions: getCardTemplatePromptCatalog(),
    outputRules: {
      cardTitle: "Make it punchy, specific, and under 42 characters.",
      traits: "Exactly three objects from the allowed trait list, each with a 60-99 score.",
      campusPower: "Integer from 60 to 99.",
      rarity: "Use the rarity rubric from the system instructions.",
      knownFor: "One concise phrase based on the self-description, without 'Known for'.",
      specialAbility: "Short ability name, not a sentence.",
      colorTheme: "One exact id from cardTemplateOptions.",
    },
  });
}

function extractOutputText(responseBody: unknown) {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "output_text" in responseBody &&
    typeof responseBody.output_text === "string"
  ) {
    return responseBody.output_text;
  }

  if (
    responseBody &&
    typeof responseBody === "object" &&
    "output" in responseBody &&
    Array.isArray(responseBody.output)
  ) {
    for (const item of responseBody.output) {
      if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
        continue;
      }

      for (const content of item.content) {
        if (
          content &&
          typeof content === "object" &&
          "text" in content &&
          typeof content.text === "string"
        ) {
          return content.text;
        }
      }
    }
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown generation error.";
}

function createFallbackResult(
  input: CardRequest,
  startedAt: number,
  model: string,
  error?: string,
): CardGenerationResult {
  const card = createFallbackCard(input);
  const outputText = JSON.stringify(card);

  return {
    card,
    source: "fallback",
    model,
    durationMs: Date.now() - startedAt,
    estimatedInputTokens: estimateTokens(JSON.stringify(input)),
    estimatedOutputTokens: estimateTokens(outputText),
    error,
  };
}

function normalizeGeneratedCard(input: CardRequest, generated: unknown): CardIdentity {
  const parsed = aiCardContentSchema.parse(generated);
  const selectedTraits = parsed.traits.map((trait) => trait.name);
  const traitStats = Object.fromEntries(
    parsed.traits.map((trait) => [trait.name, trait.score]),
  );
  const campusPower = parsed.campusPower;

  return cardSchema.parse({
    displayName: input.name,
    cardTitle: parsed.cardTitle,
    type: selectedTraits,
    rarity: parsed.rarity,
    stats: {
      ...traitStats,
      "Campus Power": campusPower,
    },
    specialAbility: parsed.specialAbility,
    description: `Known for ${parsed.knownFor.replace(/^known for\s+/i, "").replace(/\.$/, "")}.`,
    colorTheme: resolveTemplateId(parsed.rarity, parsed.colorTheme, input.selfDescription),
  });
}

export async function generateCard(input: CardRequest): Promise<CardGenerationResult> {
  const startedAt = Date.now();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return createFallbackResult(
      input,
      startedAt,
      "local-fallback",
      "OPENAI_API_KEY is not configured.",
    );
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "card_identity",
            schema: CARD_IDENTITY_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}.`);
    }

    const data: unknown = await response.json();
    const outputText = extractOutputText(data);

    if (!outputText) {
      throw new Error("OpenAI response did not include output_text.");
    }

    const generated: unknown = JSON.parse(outputText);
    const card = normalizeGeneratedCard(input, generated);

    return {
      card,
      source: "openai",
      model,
      durationMs: Date.now() - startedAt,
      estimatedInputTokens: estimateTokens(`${systemPrompt}\n${userPrompt}`),
      estimatedOutputTokens: estimateTokens(outputText),
    };
  } catch (error) {
    return createFallbackResult(
      input,
      startedAt,
      "local-fallback",
      getErrorMessage(error),
    );
  }
}
