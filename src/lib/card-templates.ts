export const cardTemplates = [
  {
    id: "athletic-blue",
    name: "Athletic Blue",
    imagePath: "/cards/athletic-blue.png",
    textClassName: "gold-card--cool",
    fitSummary:
      "Blue sports pattern with footballs, soccer balls, shuttlecocks, and motion shapes. Best for athletic, energetic, competitive, clutch, team-first, game-day, or high-momentum people.",
    keywords: [
      "athlete",
      "athletic",
      "sport",
      "sports",
      "team",
      "game",
      "competition",
      "competitive",
      "energy",
      "energetic",
      "clutch",
      "practice",
      "coach",
      "captain",
    ],
  },
  {
    id: "empathy-pastel",
    name: "Empathy Pastel",
    imagePath: "/cards/empathy-pastel.png",
    textClassName: "gold-card--soft",
    fitSummary:
      "Soft pastel rainbow with gentle swirls and a lime frame. Best for empathetic, caring, emotionally aware, supportive, mentor-like, calming, inclusive, or community-minded people.",
    keywords: [
      "empathy",
      "empathetic",
      "care",
      "caring",
      "support",
      "supportive",
      "mentor",
      "help",
      "listen",
      "kind",
      "community",
      "calm",
      "feelings",
    ],
  },
  {
    id: "leadership-red",
    name: "Leadership Red",
    imagePath: "/cards/leadership-red.png",
    textClassName: "gold-card--warm",
    fitSummary:
      "Strong red template with target-like ripple circles. Best for leaders, organizers, initiators, strategic decision makers, confident public speakers, and people with high presence.",
    keywords: [
      "lead",
      "leader",
      "leadership",
      "organize",
      "organizer",
      "captain",
      "president",
      "strategy",
      "strategic",
      "decide",
      "initiative",
      "direct",
      "present",
      "public speaking",
    ],
  },
  {
    id: "pride-rainbow",
    name: "Pride Rainbow",
    imagePath: "/cards/pride-rainbow.png",
    textClassName: "gold-card--cool",
    fitSummary:
      "Clean vertical rainbow gradient with a metallic silver frame. Best for expressive identity, inclusion, creativity, bold self-expression, connectors, and celebratory all-colors energy.",
    keywords: [
      "identity",
      "inclusive",
      "inclusion",
      "pride",
      "rainbow",
      "expressive",
      "expression",
      "creative",
      "art",
      "design",
      "connect",
      "belong",
      "community",
      "bold",
    ],
  },
  {
    id: "creative-magenta",
    name: "Creative Magenta",
    imagePath: "/cards/creative-magenta.png",
    textClassName: "gold-card--magenta",
    fitSummary:
      "Bold magenta-purple template with repeated upward triangular/starburst forms. Best for expressive creators, artists, performers, stylish personalities, confident presenters, original thinkers, and people with polished creative energy.",
    keywords: [
      "creative",
      "creator",
      "art",
      "artist",
      "design",
      "style",
      "stylish",
      "fashion",
      "perform",
      "performance",
      "presentation",
      "present",
      "original",
      "expressive",
      "bold",
      "aesthetic",
      "visual",
      "music",
      "theater",
    ],
  },
  {
    id: "gettysburg-gold",
    name: "Gettysburg Gold (Rarest)",
    imagePath: "/cards/gettysburg-gold-template.png",
    textClassName: "gold-card--gold",
    fitSummary:
      "The rarest, most powerful card. Reserved ONLY for the strongest students who max out campus contribution (Legend or Campus Myth, Campus Power around 90+). Premium gold finish.",
    keywords: [
      "award",
      "achieve",
      "achievement",
      "excellent",
      "excellence",
      "standout",
      "legendary",
      "elite",
      "best",
      "accomplished",
      "honor",
    ],
  },
  {
    id: "tech-growth-green",
    name: "Tech Growth Green",
    imagePath: "/cards/tech-growth-green.png",
    textClassName: "gold-card--green",
    fitSummary:
      "Green gear-and-growth pattern with tech/nature energy. Best for builders, technical creators, inventors, problem solvers, growth-minded learners, engineering, robotics, coding, and practical creativity.",
    keywords: [
      "tech",
      "technical",
      "code",
      "coding",
      "robot",
      "robotics",
      "engineering",
      "build",
      "builder",
      "growth",
      "nature",
      "invent",
      "prototype",
      "problem solve",
      "stem",
    ],
  },
] as const;

export type CardTemplate = (typeof cardTemplates)[number];
export type CardTemplateId = CardTemplate["id"];

export const cardTemplateIds = cardTemplates.map((template) => template.id) as [
  CardTemplateId,
  ...CardTemplateId[],
];

export function getCardTemplate(templateId: string | undefined) {
  return cardTemplates.find((template) => template.id === templateId) ?? cardTemplates[4];
}

export function getCardTemplatePromptCatalog() {
  return cardTemplates.map(({ id, name, fitSummary }) => ({
    id,
    name,
    fitSummary,
  }));
}

export function chooseFallbackTemplateId(selfDescription: string): CardTemplateId {
  const normalizedDescription = selfDescription.toLowerCase();

  const rankedTemplates = cardTemplates
    .filter((template) => template.id !== "gettysburg-gold")
    .map((template) => {
      const keywordScore = template.keywords.reduce((total, keyword) => {
        return normalizedDescription.includes(keyword) ? total + 3 : total;
      }, 0);

      return {
        id: template.id,
        score: keywordScore,
      };
    });

  rankedTemplates.sort((a, b) => b.score - a.score);

  return rankedTemplates[0]?.id ?? "creative-magenta";
}

// The gold template is the rarest card, reserved for the top rarities only.
const GOLD_TEMPLATE_ID: CardTemplateId = "gettysburg-gold";
const TOP_RARITIES = new Set(["Legend", "Campus Myth"]);

export function isGoldRarity(rarity: string): boolean {
  return TOP_RARITIES.has(rarity);
}

/**
 * Decides the final template. The rarest gold card is locked to the top
 * rarities; everyone else gets a casual themed template (never gold), keeping
 * the gold finish meaningful regardless of what the model proposed.
 */
export function resolveTemplateId(
  rarity: string,
  preferredId: string,
  selfDescription: string,
): CardTemplateId {
  if (isGoldRarity(rarity)) {
    return GOLD_TEMPLATE_ID;
  }

  if (preferredId === GOLD_TEMPLATE_ID || !cardTemplates.some((template) => template.id === preferredId)) {
    return chooseFallbackTemplateId(selfDescription);
  }

  return preferredId as CardTemplateId;
}
