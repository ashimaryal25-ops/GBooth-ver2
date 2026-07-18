import { cardSchema, type CardIdentity, type CardRequest } from "@/lib/card-schema";
import { chooseFallbackTemplateId, resolveTemplateId } from "@/lib/card-templates";
import { gettysburgTheme } from "@/lib/themes";

const titles = [
  "The Campus Catalyst",
  "The Gettysburg Spark",
  "The First-Year Force",
  "The Campus Signal",
  "The Bullet Blueprint",
  "The Servo Scholar",
] as const;

const abilities = [
  "Last-Minute Launch",
  "Room-Read Rally",
  "Prototype Burst",
  "Focus Lock",
  "Chaos Control",
  "Campus Signal",
] as const;

function score(seed: string, offset: number) {
  const total = [...seed].reduce((sum, char, index) => {
    return sum + char.charCodeAt(0) * (index + 3 + offset);
  }, 0);

  return 60 + (total % 40);
}

function pickFallbackTraits(seed: string) {
  return [...gettysburgTheme.traits]
    .map((trait, index) => ({
      trait,
      rank: score(`${seed}-${trait}`, index),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map((item) => item.trait);
}

function rarityFromCampusPower(campusPower: number): CardIdentity["rarity"] {
  if (campusPower >= 96) {
    return "Campus Myth";
  }

  if (campusPower >= 89) {
    return "Legend";
  }

  if (campusPower >= 80) {
    return "Epic";
  }

  if (campusPower >= 70) {
    return "Rare";
  }

  return "Common";
}

function compactDescription(description: string, maxLength = 120) {
  const cleaned = description.replace(/\s+/g, " ").replace(/\.$/, "").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const shortened = cleaned.slice(0, maxLength + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}...`;
}

export function createFallbackCard(input: CardRequest): CardIdentity {
  const seed = `${input.name}-${input.selfDescription}`;
  const title = titles[score(seed, 1) % titles.length];
  const ability = abilities[score(seed, 2) % abilities.length];
  const selectedTraits = pickFallbackTraits(seed);
  const primaryTrait = selectedTraits[0];
  const traitStats = Object.fromEntries(
    selectedTraits.map((trait, index) => [trait, score(`${seed}-${trait}`, index + 4)]),
  );
  const campusPower = Math.round(
    Object.values(traitStats).reduce((sum, value) => sum + value, 0) / selectedTraits.length,
  );
  const rarity = rarityFromCampusPower(campusPower);
  const cleanedDescription = compactDescription(input.selfDescription);

  const card = {
    displayName: input.name,
    cardTitle: title,
    type: selectedTraits,
    rarity,
    stats: {
      ...traitStats,
      "Campus Power": campusPower,
    },
    specialAbility: ability,
    description: cleanedDescription
      ? `Known for ${cleanedDescription}.`
      : `Known for turning ${primaryTrait.toLowerCase()} energy into campus-ready results.`,
    colorTheme: resolveTemplateId(
      rarity,
      chooseFallbackTemplateId(input.selfDescription),
      input.selfDescription,
    ),
  };

  return cardSchema.parse(card);
}
