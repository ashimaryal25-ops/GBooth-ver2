"use client";

/**
 * PhotoCollage
 * ------------
 * Native React port of Chloe's GBOOTH photo-strip booth (commit 33626c6 on
 * CardifyBooth#newcode1), rendered directly in the app instead of an iframe.
 *
 * Ported faithfully from her Gbooth.html / Gboothjava.js:
 *   - layout picker (2 / 3 / 4 slots) with her strip mock-ups
 *   - 5s countdown capture + retake, mirrored viewfinder
 *   - strip canvas (360x960) with her exact per-slot spacing maths
 *   - her 6 filters, 5 preset frame colours + colour wheel, 8 emoji stickers
 *   - final screen: QR + strip + print, 30s auto-reset
 *
 * Deliberate differences from her standalone file, and why:
 *   - Her "home" view is dropped: the app's Photo Collage tile is already the
 *     entry point, so her second home screen would be a duplicate.
 *   - Her UI chrome was 17 PNGs (buttons/headings/background) that were never
 *     committed, so they are rebuilt in CSS using her palette and typography.
 *   - QR is generated locally with the `qrcode` package (same ICL URL she used)
 *     instead of fetching api.qrserver.com. Drawing a cross-origin image would
 *     TAINT the canvas and make toDataURL() throw - which would break printing -
 *     and it would also fail offline at an event.
 *   - Printing posts the strip PNG to /api/collage/print (silent DS-RX1 print,
 *     DoubleStrip4x6 = two strips per 4x6) instead of window.print().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type CollageView = "layout" | "camera" | "decor" | "final";
type FilterName = "none" | "traditional" | "sepia" | "soft" | "y2k" | "vivid";
type Sticker = { id: number; emoji: string; x: number; y: number; size: number };

type PhotoCollageProps = {
  /** Return to the app's home (the 4-quadrant chooser). */
  onExit: () => void;
  /**
   * Signals "still in use" to the shell's idle timer. Needed because during the
   * countdown the guest is posing, not tapping, so no pointer/key events fire
   * and the booth would otherwise reset to home mid-session.
   */
  onActivity?: () => void;
};

// Chloe's strip geometry.
const STRIP_W = 360;
const STRIP_H = 960;
const STRIP_PADDING_X = 24;

const ICL_URL = "https://icl.sites.gettysburg.edu/";

// Her palette.
const PRESET_COLORS = ["#043371", "#CC4E00", "#EB9AB2", "#CDED76", "#AEA43A"];
const DEFAULT_STRIP_COLOR = "#EB9AB2";
const SKY = "#82c4f5";
const ACCENT = "#0022ff";

const FILTERS: { key: FilterName; label: string }[] = [
  { key: "none", label: "Original" },
  { key: "traditional", label: "Traditional" },
  { key: "sepia", label: "Sepia" },
  { key: "soft", label: "Soft Light" },
  { key: "y2k", label: "Y2K" },
  { key: "vivid", label: "Vivid" },
];

const STICKER_EMOJIS = ["❤️", "⭐", "✨", "🎀", "🕶️", "👑", "🐈", "🍒"];

const LAYOUT_OPTIONS = [
  { slots: 2, label: "2 SHOTS", sub: "Classic duo" },
  { slots: 3, label: "3 SHOTS", sub: "Triple strip" },
  { slots: 4, label: "4 SHOTS", sub: "Full strip" },
];

/** Her exact Safari-safe canvas filter strings. */
function canvasFilter(name: FilterName): string {
  switch (name) {
    case "traditional":
      return "grayscale(100%) contrast(120%) brightness(103%)";
    case "sepia":
      return "sepia(75%) saturate(115%) contrast(105%)";
    case "soft":
      return "brightness(114%) contrast(92%) saturate(108%)";
    case "y2k":
      return "contrast(120%) brightness(108%) saturate(50%) hue-rotate(-8deg)";
    case "vivid":
      return "contrast(112%) saturate(170%) brightness(104%)";
    default:
      return "none";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PhotoCollage({ onExit, onActivity }: PhotoCollageProps) {
  const [view, setView] = useState<CollageView>("layout");
  const [slots, setSlots] = useState(4);
  const [filter, setFilter] = useState<FilterName>("none");
  const [bgColor, setBgColor] = useState(DEFAULT_STRIP_COLOR);
  const [stickers, setStickers] = useState<Sticker[]>([]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [retakeNonce, setRetakeNonce] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [stripDataUrl, setStripDataUrl] = useState("");
  const [printState, setPrintState] = useState<"idle" | "printing" | "sent">("idle");
  const [printError, setPrintError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  const lastRelayIdRef = useRef(0);
  const captureResolversRef = useRef(new Map<string, (photo: string | null) => void>());
  const photosRef = useRef<HTMLCanvasElement[]>([]);
  const decorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrImgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);

  // Held in a ref: the parent passes an inline arrow, so depending on it
  // directly would restart the capture session on every parent render.
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  // Same reason: keeps the final 30s countdown from restarting whenever the
  // parent re-renders and hands us a fresh onExit closure.
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  // --- QR: generated locally so the canvas is never tainted -----------------
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(ICL_URL, {
      margin: 1,
      width: 180,
      color: { dark: "#222222", light: "#ffffff" },
    })
      .then((url) => {
        if (!alive) return;
        setQrDataUrl(url);
        const img = new Image();
        img.onload = () => {
          qrImgRef.current = img;
        };
        img.src = url;
      })
      .catch(() => {
        /* strip still renders without the QR */
      });
    return () => {
      alive = false;
    };
  }, []);

  // --- Camera relay ---------------------------------------------------------
  const sendToMirror = useCallback((message: Record<string, unknown>) => {
    void fetch("/api/mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "mirror", ...message }),
    }).catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    sendToMirror({ type: "countdown", value: 0 });
  }, [sendToMirror]);

  const requestMirrorPhoto = useCallback(() => new Promise<string | null>((resolve) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      captureResolversRef.current.delete(requestId);
      resolve(null);
    }, 5000);

    captureResolversRef.current.set(requestId, (photo) => {
      window.clearTimeout(timeout);
      captureResolversRef.current.delete(requestId);
      resolve(photo);
    });
    sendToMirror({ type: "capture-request", requestId });
  }), [sendToMirror]);

  useEffect(() => {
    let cancelled = false;
    const captureResolvers = captureResolversRef.current;

    const poll = async () => {
      try {
        const response = await fetch(`/api/mirror?role=kiosk&since=${lastRelayIdRef.current}`, { cache: "no-store" });
        const data = (await response.json()) as { events?: Array<Record<string, unknown> & { id?: number }> };
        for (const event of data.events ?? []) {
          lastRelayIdRef.current = Math.max(lastRelayIdRef.current, event.id ?? 0);
          if (event.type === "captured-photo" && typeof event.requestId === "string" && typeof event.dataUrl === "string") {
            captureResolversRef.current.get(event.requestId)?.(event.dataUrl);
          }
        }
      } catch {}

      if (!cancelled) window.setTimeout(poll, 200);
    };

    void poll();
    return () => {
      cancelled = true;
      captureResolvers.forEach((resolve) => resolve(null));
      captureResolvers.clear();
      stopCamera();
    };
  }, [stopCamera]);

  /** Clear the shot state. Called from handlers (not the effect) so we never
   *  setState synchronously inside an effect body. */
  const resetShots = useCallback(() => {
    photosRef.current = [];
    setPreviews([]);
    setSessionDone(false);
    setCountdown(null);
    setCameraError(null);
  }, []);

  const startSession = (nextSlots: number) => {
    resetShots();
    setSlots(nextSlots);
    setStickers([]);
    setFilter("none");
    setBgColor(DEFAULT_STRIP_COLOR);
    setView("camera");
  };

  const retakeAll = () => {
    resetShots();
    setRetakeNonce((n) => n + 1);
  };

  // --- Capture session (her countdown + retake flow) -------------------------
  useEffect(() => {
    if (view !== "camera") return;
    let cancelled = false;

    (async () => {
      setCameraError(null);
      sendToMirror({ type: "mirror-start" });
      sendToMirror({ type: "mirror-ping" });
      await sleep(500);

      for (let i = 0; i < slots; i++) {
        for (let t = 5; t > 0; t--) {
          if (cancelled) return;
          setCountdown(t);
          sendToMirror({ type: "countdown", value: t });
          await sleep(1000);
        }
        if (cancelled) return;
        setCountdown(null);
        sendToMirror({ type: "countdown", value: 0 });

        const photo = await requestMirrorPhoto();
        if (cancelled) return;
        if (!photo) {
          setCameraError("Please check the camera screen and try again.");
          return;
        }

        const image = new Image();
        image.src = photo;
        await new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
        });

        if (image.naturalWidth > 0) {
          const c = document.createElement("canvas");
          c.width = 640;
          c.height = 480;
          const cx = c.getContext("2d");
          if (cx) {
            // The CRT relay sends its mirrored view; flip it back for the print.
            cx.translate(640, 0);
            cx.scale(-1, 1);
            cx.drawImage(image, 0, 0, 640, 480);
            photosRef.current.push(c);
            setPreviews((p) => [...p, c.toDataURL("image/png")]);
            // Taking a shot counts as being actively used, even though the guest
            // never touched the screen.
            onActivityRef.current?.();
          }
        }
        if (i < slots - 1) await sleep(1200);
      }
      if (!cancelled) setSessionDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [view, slots, retakeNonce, requestMirrorPhoto, sendToMirror]);

  // --- Strip rendering (direct port of renderPhotoStripCanvas) --------------
  const renderStrip = useCallback(() => {
    const canvas = decorCanvasRef.current;
    if (!canvas) return;
    canvas.width = STRIP_W;
    canvas.height = STRIP_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, STRIP_W, STRIP_H);

    const photos = photosRef.current;
    const slotCount = photos.length;
    const photoW = STRIP_W - STRIP_PADDING_X * 2;

    let photoH = photoW * 0.75;
    let topOffsetMargin = 24;
    let gapSpacingValue = 16;

    if (slotCount === 2) {
      photoH = photoW * 0.78;
      topOffsetMargin = 70;
      gapSpacingValue = 50;
    } else if (slotCount === 3) {
      photoH = photoW * 0.78;
      topOffsetMargin = 40;
      gapSpacingValue = 22;
    } else if (slotCount === 4) {
      photoH = photoW * 0.62;
      topOffsetMargin = 16;
      gapSpacingValue = 10;
    }

    for (let i = 0; i < slotCount; i++) {
      const y = topOffsetMargin + i * (photoH + gapSpacingValue);
      ctx.save();
      // Clip so filters never bleed past the photo frame.
      ctx.beginPath();
      ctx.rect(STRIP_PADDING_X, y, photoW, photoH);
      ctx.clip();
      ctx.filter = canvasFilter(filter);
      // Mirror, like a real booth.
      ctx.translate(STRIP_PADDING_X + photoW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(photos[i], 0, 0, photoW, photoH);
      ctx.restore();
    }

    // Footer branding.
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 16px sans-serif";
    ctx.textAlign = "center";
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "2px";
    ctx.fillText("GETTYSBURG COLLEGE", STRIP_W / 2, STRIP_H - 110);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";

    const qrImg = qrImgRef.current;
    if (qrImg) {
      const qrSize = 65;
      ctx.drawImage(qrImg, STRIP_W - STRIP_PADDING_X - qrSize, STRIP_H - 85, qrSize, qrSize);
    }

    ctx.save();
    stickers.forEach((s) => {
      ctx.font = `${s.size}px Arial`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(s.emoji, s.x, s.y);
    });
    ctx.restore();
  }, [bgColor, filter, stickers]);

  useEffect(() => {
    if (view === "decor") renderStrip();
  }, [view, renderStrip, qrDataUrl]);

  // --- Sticker dragging on the canvas ---------------------------------------
  const canvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * STRIP_W,
      y: ((e.clientY - box.top) / box.height) * STRIP_H,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = canvasCoords(e);
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      if (Math.hypot(p.x - s.x, p.y - s.y) < s.size / 1.2) {
        dragRef.current = { id: s.id, dx: p.x - s.x, dy: p.y - s.y };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = canvasCoords(e);
    setStickers((prev) =>
      prev.map((s) => (s.id === drag.id ? { ...s, x: p.x - drag.dx, y: p.y - drag.dy } : s)),
    );
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  };

  // --- Final screen: 30s auto-reset ----------------------------------------
  // (secondsRemaining is primed in goFinal, not here, to avoid a sync setState
  //  inside the effect body.)
  useEffect(() => {
    if (view !== "final") return;
    const id = setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          clearInterval(id);
          onExitRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [view]);

  const goFinal = () => {
    const canvas = decorCanvasRef.current;
    if (canvas) setStripDataUrl(canvas.toDataURL("image/png"));
    stopCamera();
    setSecondsRemaining(30);
    setView("final");
  };

  const handlePrint = async () => {
    if (!stripDataUrl) return;
    setPrintState("printing");
    setPrintError(null);
    try {
      const res = await fetch("/api/collage/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: stripDataUrl }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Could not send collage to the kiosk printer.";
        throw new Error(msg);
      }
      onActivityRef.current?.();
      setPrintState("sent");
      setTimeout(() => setPrintState("idle"), 1800);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : "Could not print collage.");
      setPrintState("idle");
    }
  };

  // --- Shared styles (rebuilt from her CSS) ---------------------------------
  const glassBtn =
    "rounded-[20px] border border-white/60 bg-white/20 px-3 py-2.5 text-[12px] font-bold uppercase tracking-[0.5px] text-white transition-all hover:bg-white/35";
  const backBtn =
    "absolute left-6 top-5 z-50 rounded-[30px] border border-white/60 bg-white/25 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-[5px] transition-all hover:bg-white/40 active:scale-95";
  const heading =
    "mb-4 font-['Arial_Black',Arial,sans-serif] text-[15px] font-black uppercase tracking-[1.5px] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.25)]";

  return (
    <div
      className="relative h-full w-full overflow-hidden font-[Arial,sans-serif]"
      style={{ backgroundColor: SKY }}
    >
      <style>{`
        @keyframes gboothPulseCount {
          0%   { transform: scale(0.95); opacity: 0.9; }
          100% { transform: scale(1.05); opacity: 1; }
        }
        .gbooth-countdown { animation: gboothPulseCount 1s infinite alternate; }
        .gbooth-wheel { position:absolute; top:-10px; left:-10px; width:68px; height:68px; border:none; background:none; cursor:pointer; -webkit-appearance:none; }
      `}</style>

      {/* ================= LAYOUT PICKER ================= */}
      {view === "layout" && (
        <section className="flex h-full w-full flex-col items-center justify-center px-6">
          <button type="button" className={backBtn} onClick={onExit}>
            ← Back
          </button>

          <h2 className="mb-1 text-[42px] font-black uppercase tracking-[2px] text-white [text-shadow:0_4px_10px_rgba(0,0,0,0.25)]">
            Choose Your Layout
          </h2>
          <p className="mb-10 text-[15px] font-bold text-white/85 [text-shadow:0_2px_4px_rgba(0,0,0,0.2)]">
            How many shots do you want on your strip?
          </p>

          <div className="flex max-w-[1100px] items-center justify-center gap-[60px]">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.slots}
                type="button"
                onClick={() => startSession(opt.slots)}
                className="group flex w-[220px] cursor-pointer flex-col items-center transition-transform duration-[250ms] hover:-translate-y-3"
              >
                {/* Her white strip mock-up */}
                <div className="mb-5 flex w-full justify-center">
                  <div className="flex h-[250px] w-[110px] flex-col gap-2 rounded-[6px] border-2 border-dashed border-[#cbd5e1] bg-white p-2.5 shadow-[0_15px_30px_rgba(0,0,0,0.25)] transition-shadow group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                    {Array.from({ length: opt.slots }).map((_, i) => (
                      <div
                        key={i}
                        className="w-full flex-1 rounded-[4px] border border-[#e2e8f0] bg-[#f1f5f9]"
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[18px] font-black tracking-[1px] text-white [text-shadow:0_2px_5px_rgba(0,0,0,0.3)]">
                  {opt.label}
                </span>
                <span className="mt-1 text-[12px] font-bold text-white/70">{opt.sub}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ================= CAMERA ================= */}
      {view === "camera" && (
        <section className="flex h-full w-full items-center justify-center px-10">
          <button
            type="button"
            className={backBtn}
            onClick={() => {
              stopCamera();
              setView("layout");
            }}
          >
            ← Back
          </button>

          <div className="flex w-full max-w-[1100px] items-center justify-center gap-[50px]">
            {/* Viewfinder */}
            <div className="relative flex h-[590px] w-[520px] shrink-0 items-center justify-center overflow-hidden bg-black shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
              {previews.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[previews.length - 1]}
                  alt="Latest captured photo"
                  className="h-full w-full -scale-x-100 object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-10 text-center text-2xl font-black text-white">
                  Look at the camera screen
                </div>
              )}
              {countdown !== null && (
                <div className="gbooth-countdown pointer-events-none absolute z-10 text-[140px] font-black text-white [text-shadow:0_0_25px_rgba(0,0,0,0.8),0_0_50px_#0022ff]">
                  {countdown}
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-8 text-center text-lg font-bold text-white">
                  {cameraError}
                </div>
              )}
            </div>

            {/* Sidebar previews + controls */}
            <div className="flex w-[480px] flex-col items-center gap-[30px]">
              <div
                className="grid w-full gap-[15px]"
                style={{
                  gridTemplateColumns: slots === 2 ? "1fr" : "repeat(2, 1fr)",
                  maxWidth: slots === 2 ? 240 : "100%",
                  minHeight: 340,
                }}
              >
                {Array.from({ length: slots }).map((_, i) => (
                  <div
                    key={i}
                    className="flex aspect-[4/3] w-full items-center justify-center border border-white/50 bg-white/85 shadow-[0_4px_10px_rgba(0,0,0,0.15)]"
                  >
                    {previews[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previews[i]}
                        alt={`Shot ${i + 1}`}
                        className="h-[90%] w-[90%] -scale-x-100 object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-black text-[#cbd5e1]">{i + 1}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex h-[90px] items-center justify-center gap-[30px]">
                {sessionDone && (
                  <>
                    <button
                      type="button"
                      onClick={retakeAll}
                      className={`${glassBtn} px-6 py-3 text-[13px]`}
                    >
                      Retake All
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("decor")}
                      className="rounded-[20px] border px-8 py-3 text-[13px] font-bold uppercase tracking-[0.5px] text-white shadow-[0_0_10px_rgba(0,34,255,0.4)] transition-transform hover:scale-105"
                      style={{ background: ACCENT, borderColor: ACCENT }}
                    >
                      Continue →
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= DECORATE ================= */}
      {view === "decor" && (
        <section className="flex h-full w-full items-center justify-center overflow-y-auto px-6 py-4">
          <button
            type="button"
            className={backBtn}
            onClick={() => setView("camera")}
          >
            ← Back
          </button>

          <div className="flex w-full max-w-[1200px] items-center justify-center gap-[50px]">
            {/* Strip preview */}
            <div className="flex w-[320px] shrink-0 items-center justify-center">
              <canvas
                ref={decorCanvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="max-h-[80vh] max-w-full cursor-crosshair bg-white shadow-[0_12px_35px_rgba(0,0,0,0.3)]"
                style={{ touchAction: "none" }}
              />
            </div>

            {/* Dashboard */}
            <div className="flex w-[680px] flex-col gap-6">
              <h2 className="text-[34px] font-black uppercase tracking-[2px] text-white [text-shadow:0_4px_10px_rgba(0,0,0,0.25)]">
                Customize Your Strip
              </h2>

              <div className="grid grid-cols-2 gap-x-[45px] gap-y-[30px]">
                {/* FRAME COLOR */}
                <div className="flex flex-col items-start">
                  <h3 className={heading}>Frame Color</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Frame colour ${c}`}
                        onClick={() => setBgColor(c)}
                        className="h-[42px] w-[42px] shrink-0 rounded-full border-2 shadow-[0_4px_10px_rgba(0,0,0,0.15)] transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: bgColor === c ? ACCENT : "rgba(255,255,255,0.8)",
                        }}
                      />
                    ))}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="relative h-[42px] w-[42px] cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="gbooth-wheel"
                          aria-label="Pick a custom frame colour"
                        />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                        pick your color
                      </span>
                    </div>
                  </div>
                </div>

                {/* FILTERS */}
                <div className="flex flex-col items-start">
                  <h3 className={heading}>Filters</h3>
                  <div className="grid w-full grid-cols-2 gap-2.5">
                    {FILTERS.map((f) => {
                      const active = filter === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setFilter(f.key)}
                          className={glassBtn}
                          style={
                            active
                              ? {
                                  background: ACCENT,
                                  borderColor: ACCENT,
                                  boxShadow: "0 0 10px rgba(0,34,255,0.4)",
                                }
                              : undefined
                          }
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* STICKERS */}
                <div className="flex flex-col items-start">
                  <h3 className={heading}>Stickers</h3>
                  <div className="grid w-full grid-cols-4 gap-3">
                    {STICKER_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() =>
                          setStickers((prev) => [
                            ...prev,
                            {
                              id: Date.now() + Math.random(),
                              emoji,
                              x: STRIP_W / 2,
                              y: STRIP_H / 2,
                              size: 45,
                            },
                          ])
                        }
                        className="flex aspect-square select-none items-center justify-center border border-white/40 bg-white/15 text-[28px] transition-transform hover:scale-105 hover:bg-white/25"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {stickers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStickers([])}
                      className="mt-3 text-[11px] font-bold uppercase tracking-[0.5px] text-white/80 underline hover:text-white"
                    >
                      Clear stickers
                    </button>
                  )}
                </div>

                {/* STRIPS */}
                <div className="flex flex-col items-start">
                  <h3 className={heading}>Strips</h3>
                  <div className="grid w-full grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      className={glassBtn}
                      style={{
                        background: ACCENT,
                        borderColor: ACCENT,
                        boxShadow: "0 0 10px rgba(0,34,255,0.4)",
                      }}
                    >
                      Plain Clean
                    </button>
                    <p className="col-span-2 mt-1 text-[12px] italic text-white/70">
                      Custom themes coming soon!
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex w-full justify-end pr-4">
                <button
                  type="button"
                  onClick={goFinal}
                  className="rounded-[30px] border px-10 py-3.5 text-[15px] font-black uppercase tracking-[1px] text-white shadow-[0_0_14px_rgba(0,34,255,0.45)] transition-transform hover:scale-105 active:scale-95"
                  style={{ background: ACCENT, borderColor: ACCENT }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= FINAL ================= */}
      {view === "final" && (
        <section className="relative flex h-full w-full flex-col items-center">
          <h2 className="mt-4 text-[38px] font-black uppercase tracking-[2px] text-white [text-shadow:0_4px_10px_rgba(0,0,0,0.25)]">
            Here is your strip!
          </h2>

          {/* Her black/green countdown box */}
          <div className="absolute right-[4vw] top-[12vh] z-10 flex items-center gap-2.5 rounded-[10px] bg-black px-5 py-2 font-['Courier_New',monospace] text-[24px] font-bold text-[#2cff9f]">
            TIME: <span>{secondsRemaining}</span>
          </div>

          <div className="flex w-full flex-1 items-center justify-between px-[8vw]">
            {/* LEFT: QR */}
            <div className="flex w-[300px] flex-col items-center justify-center">
              <div className="flex h-[250px] w-[250px] items-center justify-center bg-[#8bbceb] shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
                <div className="flex h-[180px] w-[180px] items-center justify-center bg-white p-2.5">
                  {qrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="QR code to the ICL website" className="h-full w-full" />
                  )}
                </div>
              </div>
              <h3 className="mt-6 text-center font-['Arial_Black',Arial,sans-serif] text-[20px] uppercase text-black">
                Download your strip!
              </h3>
            </div>

            {/* CENTER: strip */}
            <div className="flex flex-1 items-center justify-center">
              {stripDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stripDataUrl}
                  alt="Your finished photo strip"
                  className="max-h-[750px] w-auto rounded-[4px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.35)]"
                  style={{ height: "65vh" }}
                />
              )}
            </div>

            {/* RIGHT: actions */}
            <div className="flex w-[300px] flex-col items-end justify-center gap-8">
              <button
                type="button"
                onClick={handlePrint}
                disabled={printState !== "idle"}
                className="flex h-[140px] w-[140px] flex-col items-center justify-center gap-1 rounded-full border-4 border-white text-[15px] font-black uppercase tracking-[1px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
                style={{ background: ACCENT }}
              >
                <span className="text-[32px] leading-none">🖨️</span>
                {printState === "printing" ? "Printing…" : printState === "sent" ? "Sent!" : "Print"}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onExit();
                }}
                className="flex h-[140px] w-[140px] flex-col items-center justify-center gap-1 rounded-full border-4 border-white bg-white/25 text-[14px] font-black uppercase tracking-[1px] text-white backdrop-blur-[5px] shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 active:scale-95"
              >
                <span className="text-[30px] leading-none">🏠</span>
                Start Over
              </button>
            </div>
          </div>

          {printError && (
            <p className="mb-3 rounded-md bg-black/70 px-4 py-2 text-sm font-bold text-[#ff9a9a]">
              {printError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
