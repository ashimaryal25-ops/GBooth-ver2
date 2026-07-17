import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type { CardIdentity } from "@/lib/card-schema";
import { decodePngDataUrl } from "@/lib/png-data-url";
import {
  deleteLocalCardRecords,
  getOverflowLocalCardRecords,
  insertLocalCardRecord,
  type LocalCardRecord,
} from "@/lib/local-card-db";

const storageRoot = path.join(process.cwd(), ".booth-storage");
const cardsDir = path.join(storageRoot, "cards");
const maxCachedCards = 100;

function getTraitScores(card: CardIdentity) {
  return Object.fromEntries(
    Object.entries(card.stats).filter(([label]) => label !== "Campus Power"),
  );
}

function getKnownFor(card: CardIdentity) {
  return card.description
    .replace(/^known for\s+/i, "")
    .replace(/\.$/, "");
}

async function enforceCardCacheLimit() {
  const overflowRecords = getOverflowLocalCardRecords(maxCachedCards);
  const deletedRecordIds: string[] = [];
  const resolvedCardsDir = path.resolve(cardsDir) + path.sep;

  for (const record of overflowRecords) {
    const absolutePngPath = path.resolve(storageRoot, record.card_png_path);

    if (!absolutePngPath.startsWith(resolvedCardsDir)) {
      console.error("Refusing to delete a cached card outside the cards directory.", record.id);
      continue;
    }

    try {
      await unlink(absolutePngPath);
      deletedRecordIds.push(record.id);
    } catch (error) {
      const isMissingFile =
        error instanceof Error && "code" in error && error.code === "ENOENT";

      if (isMissingFile) {
        deletedRecordIds.push(record.id);
      } else {
        console.error("Could not delete an old cached card PNG.", record.id, error);
      }
    }
  }

  deleteLocalCardRecords(deletedRecordIds);
}

export async function saveLocalCard(params: {
  id: string;
  card: CardIdentity;
  imageDataUrl: string;
}) {
  await mkdir(cardsDir, { recursive: true });

  const pngBuffer = decodePngDataUrl(params.imageDataUrl);

  const cardPngPath = `cards/${params.id}.png`;
  const absolutePngPath = path.join(storageRoot, cardPngPath);

  await writeFile(absolutePngPath, pngBuffer);

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  const record: LocalCardRecord = {
    id: params.id,
    displayName: params.card.displayName,
    rarity: params.card.rarity,
    traitScores: getTraitScores(params.card),
    campusPower: params.card.stats["Campus Power"],
    knownFor: getKnownFor(params.card),
    specialAbility: params.card.specialAbility,
    cardPngPath,
    cardUrl: `/local-cards/${params.id}`,
    printStatus: "not_requested",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  insertLocalCardRecord(record);
  await enforceCardCacheLimit();

  return record;
}
