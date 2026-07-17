"use client";

import { Download, Home, Printer, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadPng, makeCardFilename, renderCardAsPng } from "@/lib/export-card";
import type { CardIdentity } from "@/lib/card-schema";
import { CardPreview } from "@/components/CardPreview";
import { printLocalCard } from "@/lib/print-local-card";
import { saveLocalCardPrint } from "@/lib/save-local-card";

interface CardRevealProps {
  card: CardIdentity;
  cardId: string | null;
  photo: string;
  qrCode?: string;
  onRestart: () => void;
  onGoHome: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
type PrintStatus = "idle" | "printing" | "printed" | "error";

export function CardReveal({ card, cardId, photo, qrCode, onRestart, onGoHome }: CardRevealProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasAutoSavedRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [printStatus, setPrintStatus] = useState<PrintStatus>("idle");
  const [printError, setPrintError] = useState<string | null>(null);
  const filename = makeCardFilename(card.displayName);

  useEffect(() => {
    if (!cardId || !cardRef.current || hasAutoSavedRef.current) {
      return;
    }

    setSaveStatus("saving");

    const timer = window.setTimeout(async () => {
      if (hasAutoSavedRef.current) {
        return;
      }

      hasAutoSavedRef.current = true;

      if (!cardRef.current) {
        setSaveStatus("error");
        return;
      }

      try {
        const dataUrl = await renderCardAsPng(cardRef.current);
        await saveLocalCardPrint({
          id: cardId,
          card,
          imageDataUrl: dataUrl,
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [card, cardId]);

  async function downloadCard() {
    if (!cardRef.current) {
      return;
    }

    setIsExporting(true);
    setExportError(false);

    try {
      const dataUrl = await renderCardAsPng(cardRef.current);
      downloadPng(dataUrl, filename);
    } catch {
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  }

  async function printCard() {
    if (!cardId || saveStatus !== "saved") {
      setPrintStatus("error");
      setPrintError("The card print file is still being prepared. Try again in a moment.");
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
          : "Could not send card to the kiosk printer.",
      );
    }
  }

  // Chloe's cardify4: card on the left, the big circular PRINT button on the
  // right, straight on the orange. (The card keeps its own baked-in QR.)
  return (
    <section className="mx-auto grid h-full w-full max-w-[1100px] content-center items-center gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div ref={cardRef} className="mx-auto">
        <CardPreview card={card} photo={photo} qrCode={qrCode} />
      </div>

      <div className="flex w-full flex-col items-center gap-6 lg:items-start">
        <h2 className="text-3xl font-black uppercase tracking-wide text-black">
          Your card is ready!
        </h2>

        {/* PRINT hero on the left, a tidy uniform column of secondary actions
            beside it — one visual group instead of scattered pills. */}
        <div className="flex flex-wrap items-center justify-center gap-9 lg:justify-start">
          <button
            type="button"
            onClick={printCard}
            disabled={saveStatus !== "saved" || printStatus === "printing"}
            aria-label={printStatus === "printing" ? "Printing card" : "Print card"}
            className="grid place-items-center rounded-full bg-[linear-gradient(145deg,#f4f4f4,#8f8f8f)] p-[7px] shadow-[0_8px_22px_rgba(0,0,0,0.28)] transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 disabled:hover:scale-100"
          >
            <span className="grid h-[136px] w-[136px] place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#d07a41,#b05a24_62%,#8e451a)]">
              <span className="flex flex-col items-center gap-1 text-white">
                <span className="text-xl font-black tracking-[2px] drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]">
                  {printStatus === "printing" ? "..." : "PRINT"}
                </span>
                <Printer size={30} strokeWidth={2.4} />
              </span>
            </span>
          </button>

          <div className="flex w-[230px] flex-col gap-2.5">
            <button
              type="button"
              onClick={downloadCard}
              disabled={isExporting}
              className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-white px-5 text-base font-bold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.16)] transition hover:bg-[#fff6ea] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} />
              {isExporting ? "Preparing PNG" : "Save PNG"}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-white px-5 text-base font-bold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.16)] transition hover:bg-[#fff6ea]"
            >
              <RotateCcw size={18} />
              New card
            </button>
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-white px-5 text-base font-bold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.16)] transition hover:bg-[#fff6ea]"
            >
              <Home size={18} />
              Go home
            </button>
          </div>
        </div>

        <p className="text-sm font-semibold text-[#5c3a10]" aria-live="polite">
          {printStatus === "printed"
            ? "Card sent to the kiosk printer."
            : printStatus === "error"
              ? (printError ?? "Could not send card to the kiosk printer.")
              : exportError
                ? "PNG export hit a browser rendering issue. Try again in a moment."
                : saveStatus === "saved"
                  ? "Card saved - tap PRINT to get your copy."
                  : saveStatus === "error"
                    ? "Card generated, but local saving failed. Try Save PNG as backup."
                    : "Preparing your card for printing..."}
        </p>
      </div>
    </section>
  );
}
