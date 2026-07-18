"use client";

import { Download, Home, Printer, RotateCcw, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { CardPreview } from "@/components/CardPreview";
import type { CardIdentity } from "@/lib/card-schema";
import { downloadPng, makeCardFilename, renderCardAsPng } from "@/lib/export-card";
import { printLocalCard } from "@/lib/print-local-card";
import { uploadPublicPng } from "@/lib/public-download";
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
type DownloadStatus = "idle" | "uploading" | "ready" | "error";

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
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [printStatus, setPrintStatus] = useState<PrintStatus>("idle");
  const [printError, setPrintError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] =
    useState<DownloadStatus>("idle");
  const [downloadQr, setDownloadQr] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const filename = makeCardFilename(card.displayName);

  useEffect(() => {
    if (!cardRef.current || hasPreparedRef.current) {
      return;
    }

    setSaveStatus(cardId ? "saving" : "idle");
    setDownloadStatus("uploading");

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

        try {
          const publicFile = await uploadPublicPng({
            kind: "card",
            id: cardId ?? crypto.randomUUID(),
            imageDataUrl,
          });
          const qrDataUrl = await QRCode.toDataURL(publicFile.downloadUrl, {
            width: 320,
            margin: 2,
            color: { dark: "#111111", light: "#ffffff" },
          });
          setDownloadQr(qrDataUrl);
          setDownloadStatus("ready");
        } catch (error) {
          setDownloadStatus("error");
          setDownloadError(
            error instanceof Error
              ? error.message
              : "Phone download is unavailable.",
          );
        }
      } catch {
        setSaveStatus("error");
        setDownloadStatus("error");
        setDownloadError("Could not render the finished card.");
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
      const dataUrl =
        renderedPngRef.current ?? (await renderCardAsPng(cardRef.current));
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
    <section className="mx-auto grid h-full w-full max-w-[1220px] content-center items-center gap-6 xl:grid-cols-[330px_250px_minmax(260px,1fr)]">
      <div ref={cardRef} className="mx-auto">
        <CardPreview card={card} photo={photo} />
      </div>

      <div className="flex min-h-[320px] flex-col items-center justify-center border-y border-black/20 px-5 text-center xl:border-x xl:border-y-0">
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#043371] text-white">
          <Smartphone size={21} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-black text-[#171717]">Get it on your phone</h2>
        <p className="mt-1 max-w-[220px] text-sm font-semibold text-[#5b5b5b]">
          Scan to download the finished card.
        </p>

        <div className="mt-4 grid h-[172px] w-[172px] place-items-center border-2 border-[#043371] bg-white p-2">
          {downloadQr ? (
            // eslint-disable-next-line @next/next/no-img-element -- Generated QR data URL.
            <img
              src={downloadQr}
              alt="QR code to download this card"
              className="h-full w-full"
            />
          ) : downloadStatus === "error" ? (
            <p className="px-3 text-sm font-bold text-[#9f2d20]">QR unavailable</p>
          ) : (
            <div className="flex flex-col items-center gap-3 text-[#043371]">
              <span className="h-7 w-7 animate-spin rounded-full border-4 border-[#c8d5e6] border-t-[#043371]" />
              <span className="text-xs font-black uppercase tracking-[0.12em]">
                Preparing
              </span>
            </div>
          )}
        </div>

        <p className="mt-3 min-h-10 max-w-[220px] text-xs font-semibold text-[#666]" aria-live="polite">
          {downloadStatus === "ready"
            ? "Open your camera, scan, and save the PNG."
            : downloadStatus === "error"
              ? (downloadError ?? "Phone download is unavailable.")
              : "Creating a secure public download link..."}
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-5 xl:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#b84900]">
            Finished
          </p>
          <h2 className="mt-1 text-3xl font-black text-[#171717]">Your card is ready</h2>
        </div>

        <button
          type="button"
          onClick={printCard}
          disabled={saveStatus !== "saved" || printStatus === "printing"}
          className="inline-flex h-16 w-full max-w-[300px] items-center justify-center gap-3 bg-[#cc4e00] px-7 text-lg font-black text-white shadow-[0_5px_0_#843200] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        >
          <Printer size={24} />
          {printStatus === "printing" ? "Printing..." : "Print card"}
        </button>

        <div className="grid w-full max-w-[300px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <button
            type="button"
            onClick={downloadCard}
            disabled={isExporting}
            className="inline-flex h-11 items-center justify-center gap-2 border border-black/20 bg-white px-4 text-sm font-bold text-[#171717] hover:border-[#043371]"
          >
            <Download size={17} />
            {isExporting ? "Preparing..." : "Save on this device"}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-11 items-center justify-center gap-2 border border-black/20 bg-white px-4 text-sm font-bold text-[#171717] hover:border-[#043371]"
          >
            <RotateCcw size={17} />
            New card
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex h-11 items-center justify-center gap-2 border border-black/20 bg-white px-4 text-sm font-bold text-[#171717] hover:border-[#043371] sm:col-span-2 xl:col-span-1"
          >
            <Home size={17} />
            Home
          </button>
        </div>

        <p className="max-w-[320px] text-sm font-semibold text-[#5c3a10]" aria-live="polite">
          {printStatus === "printed"
            ? "Card sent to the kiosk printer."
            : printStatus === "error"
              ? (printError ?? "Could not send the card to the kiosk printer.")
              : exportError
                ? "PNG export failed. Try again in a moment."
                : saveStatus === "saved"
                  ? "Print file ready."
                  : saveStatus === "error"
                    ? "Local saving failed. Use Save on this device as a backup."
                    : "Preparing the print file..."}
        </p>
      </div>
    </section>
  );
}
