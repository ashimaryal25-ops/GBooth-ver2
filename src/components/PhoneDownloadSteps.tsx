"use client";

/**
 * The "get it on your phone" panel, shared by the card and collage final
 * screens so both give guests the same instructions.
 *
 * When the booth runs its own hotspot the guest must join that network before
 * the download link resolves, and a camera can only act on one QR at a time —
 * so this shows two numbered steps. With no hotspot configured (public URL
 * mode) the join step disappears and it collapses to the single download QR.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildWifiQrPayload, HOTSPOT_CONFIG } from "@/lib/hotspot";

export type PhoneDownloadStatus = "idle" | "uploading" | "ready" | "error";

type PhoneDownloadStepsProps = {
  downloadQr: string | null;
  status: PhoneDownloadStatus;
  errorMessage?: string | null;
  /** Border/step-badge colour, so each screen keeps its own palette. */
  accent?: string;
  qrSize?: number;
};

function StepBadge({ step, label, accent }: { step: number; label: string; accent: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black text-white"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      >
        {step}
      </span>
      <span className="text-[12px] font-black uppercase tracking-[0.06em] text-[#171717]">
        {label}
      </span>
    </div>
  );
}

export function PhoneDownloadSteps({
  downloadQr,
  status,
  errorMessage,
  accent = "#043371",
  qrSize = 132,
}: PhoneDownloadStepsProps) {
  const hotspot = HOTSPOT_CONFIG;
  const [wifiQr, setWifiQr] = useState<string | null>(null);

  useEffect(() => {
    if (!hotspot) return;

    let cancelled = false;

    QRCode.toDataURL(buildWifiQrPayload(hotspot), {
      width: 320,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setWifiQr(dataUrl);
      })
      .catch(() => {
        // Falls back to the printed network name below the box.
      });

    return () => {
      cancelled = true;
    };
  }, [hotspot]);

  const box = "grid place-items-center border-2 bg-white p-1.5";
  const boxStyle = { width: qrSize, height: qrSize, borderColor: accent };

  return (
    <div className="flex flex-col items-center">
      {hotspot && (
        <>
          <div className="flex flex-col items-center">
            <StepBadge step={1} label="Join booth Wi-Fi" accent={accent} />
            <div className={box} style={boxStyle}>
              {wifiQr ? (
                // eslint-disable-next-line @next/next/no-img-element -- Generated QR data URL.
                <img
                  src={wifiQr}
                  alt={`QR code to join the ${hotspot.ssid} Wi-Fi network`}
                  className="h-full w-full"
                />
              ) : (
                <span className="text-[10px] font-bold text-[#666]">Loading</span>
              )}
            </div>
            {/* Typed fallback for phones that will not act on a Wi-Fi QR. */}
            <p className="mt-1.5 text-[11px] font-bold text-[#444]">{hotspot.ssid}</p>
          </div>

          <div className="my-2 h-4 w-px" style={{ backgroundColor: `${accent}55` }} aria-hidden="true" />
        </>
      )}

      <div className="flex flex-col items-center">
        {hotspot ? (
          <StepBadge step={2} label="Scan to download" accent={accent} />
        ) : (
          <span className="mb-1.5 text-[12px] font-black uppercase tracking-[0.06em] text-[#171717]">
            Scan to download
          </span>
        )}

        <div className={box} style={boxStyle}>
          {downloadQr ? (
            // eslint-disable-next-line @next/next/no-img-element -- Generated QR data URL.
            <img src={downloadQr} alt="QR code to download your photo" className="h-full w-full" />
          ) : status === "error" ? (
            <p className="px-2 text-center text-[11px] font-bold text-[#9f2d20]">
              QR unavailable
            </p>
          ) : (
            <div className="flex flex-col items-center gap-1.5" style={{ color: accent }}>
              <span
                className="h-5 w-5 animate-spin rounded-full border-[3px] border-[#c8d5e6]"
                style={{ borderTopColor: accent }}
              />
              <span className="text-[9px] font-black uppercase tracking-[0.1em]">
                Preparing
              </span>
            </div>
          )}
        </div>
      </div>

      <p
        className="mt-2 min-h-8 max-w-[220px] text-center text-[11px] font-semibold text-[#666]"
        aria-live="polite"
      >
        {status === "ready"
          ? hotspot
            ? "Join the Wi-Fi first, then scan to save the PNG."
            : "Open your camera, scan, and save the PNG."
          : status === "error"
            ? (errorMessage ?? "Phone download is unavailable.")
            : "Preparing your download..."}
      </p>
    </div>
  );
}
