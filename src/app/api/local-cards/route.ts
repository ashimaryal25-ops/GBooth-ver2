import { NextResponse } from "next/server";
import { z } from "zod";
import { cardSchema } from "@/lib/card-schema";
import { saveLocalCard } from "@/lib/local-card-storage";

export const runtime = "nodejs";

const saveLocalCardSchema = z.object({
  id: z.string().uuid(),
  card: cardSchema,
  imageDataUrl: z.string().startsWith("data:image/png;base64,"),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = saveLocalCardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid local card save request." },
      { status: 400 },
    );
  }

  try {
    const record = await saveLocalCard(parsed.data);

    return NextResponse.json({
      record,
    });
  } catch (error) {
    console.error("Could not save card locally.", error);

    return NextResponse.json(
      { error: "Could not save card locally." },
      { status: 500 },
    );
  }
}
