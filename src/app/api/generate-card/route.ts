import { NextResponse } from "next/server";
import { cardRequestSchema } from "@/lib/card-schema";
import { generateCard } from "@/lib/card-generation";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = cardRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card request." }, { status: 400 });
  }

  const result = await generateCard(parsed.data);
  const cardId = crypto.randomUUID();

  return NextResponse.json({
    card: result.card,
    cardId,
  }, {
    headers: {
      "X-Card-Generation-Id": cardId,
      "X-Card-Generation-Source": result.source,
      "X-Card-Generation-Model": result.model,
      "X-Card-Generation-Duration-Ms": String(result.durationMs),
      "X-Card-Estimated-Input-Tokens": String(result.estimatedInputTokens),
      "X-Card-Estimated-Output-Tokens": String(result.estimatedOutputTokens),
    },
  });
}
