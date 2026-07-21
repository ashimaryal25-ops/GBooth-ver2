"use client";

import { Home, Printer, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardPreview } from "@/components/CardPreview";
import type { CardIdentity } from "@/lib/card-schema";
import { renderCardAsPng } from "@/lib/export-card";
import { printLocalCard } from "@/lib/print-local-card";
import { saveLocalCardPrint } from "@/lib/save-local-card";

interface CardRevealProps {
  card: CardIdentity;
  cardId: string | null;
  photo: string;
  onRestart: () => void;
  onGoHome: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
type PrintStatus = "idle" | "printing" | "printed" | "error";

export function CardReveal({
  card,
  cardId,
  photo,
  onRestart,
  onGoHome,
}: CardRevealProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const renderedPngRef = useRef<string | null>(null);
  const hasPreparedRef = useRef(false);
  const [exportError, setExportError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [printStatus, setPrintStatus] = useState<PrintStatus>("idle");
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!cardRef.current || hasPreparedRef.current) {
      return;
    }

    setSaveStatus(cardId ? "saving" : "idle");

    const timer = window.setTimeout(async () => {
      if (hasPreparedRef.current || !cardRef.current) {
        return;
      }

      hasPreparedRef.current = true;

      try {
        const imageDataUrl = await renderCardAsPng(cardRef.current);
        renderedPngRef.current = imageDataUrl;

        if (cardId) {
          try {
            await saveLocalCardPrint({ id: cardId, card, imageDataUrl });
            setSaveStatus("saved");
          } catch {
            setSaveStatus("error");
          }
        }
      } catch {
        setSaveStatus("error");
        setExportError(true);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [card, cardId]);

  async function printCard() {
    if (!cardId || saveStatus !== "saved") {
      setPrintStatus("error");
      setPrintError("The print file is still being prepared. Try again in a moment.");
      return;
    }

    setPrintStatus("printing");
    setPrintError(null);

    try {
      await printLocalCard(cardId);
      setPrintStatus("printed");
    } catch (error) {
      setPrintStatus("error");
      setPrintError(
        error instanceof Error
          ? error.message
          : "Could not send the card to the kiosk printer.",
      );
    }
  }

  return (
    <section className="relative mx-auto flex h-full w-full items-center justify-center gap-16">
      {/* Home — top left, larger */}
      <button
        type="button"
        onClick={onGoHome}
        className="absolute left-6 top-6 z-10 flex h-[132px] w-[132px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white text-[13px] font-black uppercase tracking-[1px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 active:scale-95"
        style={{ background: "#043371" }}
      >
        <Home size={38} strokeWidth={2.2} />
        Home
      </button>

      {/* Card */}
      <div ref={cardRef} className="shrink-0">
        <CardPreview card={card} photo={photo} />
      </div>

      {/* Actions — circular icon buttons matching the collage final screen */}
      <div className="flex flex-col items-center gap-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-white/80">
            Finished
          </p>
          <h2 className="mt-1 text-3xl font-black text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.25)]">
            Your card is ready
          </h2>
        </div>

        <button
          type="button"
          onClick={printCard}
          disabled={saveStatus !== "saved" || printStatus === "printing"}
          className="flex h-[140px] w-[140px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white text-[15px] font-black uppercase tracking-[1px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
          style={{ background: "#cc4e00" }}
        >
          <Printer size={36} strokeWidth={2.2} />
          {printStatus === "printing" ? "Printing…" : printStatus === "printed" ? "Sent!" : "Print"}
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="flex h-[132px] w-[132px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white px-2 text-[13px] font-black uppercase tracking-[0.5px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 active:scale-95"
          style={{ background: "#043371" }}
        >
          <RotateCcw size={32} strokeWidth={2.2} />
          <span className="w-full text-center leading-[1.1]">New Card</span>
        </button>

        {(printStatus === "error" || exportError) && (
          <p className="max-w-[280px] rounded-md bg-black/60 px-4 py-2 text-center text-sm font-bold text-[#ff9a9a]">
            {printError ?? "Could not print. Try again."}
          </p>
        )}
      </div>
    </section>
  );
}
