"use client";

import { ArrowRight, Camera, Home, Info, Landmark, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardForm } from "@/components/CardForm";
import { CardPreview } from "@/components/CardPreview";
import { CardReveal } from "@/components/CardReveal";
import { ImageUpload } from "@/components/ImageUpload";
import { PhotoCollage } from "@/components/PhotoCollage";
import type { CardIdentity, CardRequest } from "@/lib/card-schema";
import { createFallbackCard } from "@/lib/fallback-card";
import { generateCardIdentity } from "@/lib/generate-card";

// "cardIntro" is Chloe's CARDIFY BOOTH splash (her cardify1 design): the guest
// taps the Trading Card tile, lands here, and taps START to begin the flow.
type Step = "choose" | "cardIntro" | "cardSetup" | "generating" | "reveal" | "collage";

const sampleCard = createFallbackCard({
  name: "Your Name",
  theme: "gettysburg",
  selfDescription: "I build quick prototypes and help my team finish under pressure.",
});

const samplePhoto =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#222222"/>
    <circle cx="400" cy="210" r="92" fill="#d8b98d"/>
    <path d="M240 540c25-130 97-205 160-205s135 75 160 205" fill="#043371"/>
    <rect x="0" y="455" width="800" height="145" fill="#3a312a"/>
    <path d="M80 120h180l-36 160H44z" fill="#cc4e00" opacity=".78"/>
    <path d="M540 90h180l36 160H576z" fill="#8fdbff" opacity=".76"/>
  </svg>`);

export function BoothApp() {
  const [step, setStep] = useState<Step>("choose");
  const [photo, setPhoto] = useState<string | null>(null);
  const [card, setCard] = useState<CardIdentity | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [isSampleCardOpen, setIsSampleCardOpen] = useState(false);
  const [isGameFullscreen, setIsGameFullscreen] = useState(false);
  const [idleTimeout, setIdleTimeout] = useState(120000);
  const gamePanelRef = useRef<HTMLDivElement>(null);
  const gameFrameRef = useRef<HTMLIFrameElement>(null);
  // Bumped by children (e.g. the collage taking a shot) to signal "still in use"
  // when there are no pointer/key events because the guest is just posing.
  const [activityNonce, setActivityNonce] = useState(0);

  useEffect(() => {
    if (step === "choose" || step === "generating") return;

    let timeout: ReturnType<typeof setTimeout>;
    // The collage takes a while with no taps at all (3s countdown per shot while
    // the guest poses), so it gets a much longer leash than the tap-driven card
    // flow. The collage also reports activity of its own via onActivity.
    const currentTimeout =
      step === "reveal" ? 30000 : step === "collage" ? 120000 : idleTimeout;


    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setPhoto(null);
        setCard(null);
        setCardId(null);
        setIdleTimeout(120000);
        setStep("choose");
      }, currentTimeout);
    };

    const handleActivity = () => resetTimer();

    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [step, idleTimeout, activityNonce]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsGameFullscreen(document.fullscreenElement === gamePanelRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isGameFullscreen) return;

    let timeout: ReturnType<typeof setTimeout>;

    const returnToHome = async () => {
      gameFrameRef.current?.contentWindow?.postMessage(
        { type: "ghost-runner:reset" },
        window.location.origin,
      );

      if (document.fullscreenElement === gamePanelRef.current) {
        await document.exitFullscreen();
      }
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => void returnToHome(), 30000);
    };

    const handleGameActivity = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === gameFrameRef.current?.contentWindow &&
        event.data?.type === "ghost-runner:activity"
      ) {
        resetTimer();
      }
    };

    window.addEventListener("message", handleGameActivity);
    window.addEventListener("pointerdown", resetTimer);
    window.addEventListener("keydown", resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handleGameActivity);
      window.removeEventListener("pointerdown", resetTimer);
      window.removeEventListener("keydown", resetTimer);
    };
  }, [isGameFullscreen]);

  const toggleGameFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === gamePanelRef.current) {
        await document.exitFullscreen();
        return;
      }
      await gamePanelRef.current?.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by browser or kiosk policy; the embedded
      // quarter remains playable when that happens.
    }
  }, []);

  const leaveGameForHome = useCallback(async () => {
    gameFrameRef.current?.contentWindow?.postMessage(
      { type: "ghost-runner:reset" },
      window.location.origin,
    );
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    setStep("choose");
  }, []);

  const resetCardFlow = useCallback(() => {
    setStep("cardSetup");
    setPhoto(null);
    setCard(null);
    setCardId(null);
    setIsSampleCardOpen(false);
  }, []);

  const resetToChooser = useCallback(() => {
    setStep("choose");
    setPhoto(null);
    setCard(null);
    setCardId(null);
    setIsSampleCardOpen(false);
    setIdleTimeout(120000);
  }, []);

  const handleGenerate = useCallback(
    async (request: CardRequest) => {
      if (!photo) {
        return;
      }

      const startedAt = performance.now();
      setStep("generating");
      const generated = await generateCardIdentity(request);
      setCard(generated.card);
      setCardId(generated.cardId);

      const elapsed = performance.now() - startedAt;
      if (elapsed < 1200) {
        await new Promise((resolve) => setTimeout(resolve, 1200 - elapsed));
      }

      setStep("reveal");
    },
    [photo],
  );

  return (
    <main
      className={
        step === "choose" || step === "cardIntro"
          ? "relative h-dvh w-full overflow-hidden text-[var(--gc-black)]"
          : step === "collage"
            ? "min-h-screen overflow-y-auto bg-transparent px-4 py-2 text-[var(--gc-black)] sm:px-6 lg:h-dvh lg:overflow-hidden lg:px-8"
            : "min-h-screen overflow-y-auto px-5 py-4 text-[var(--gc-black)] sm:px-8 lg:h-dvh lg:overflow-hidden"
      }
      // Chloe's orange gradient backs the whole trading-card flow. The collage
      // keeps her sky-blue and the 4-quadrant home keeps its cream look.
      style={
        step === "cardSetup" || step === "generating" || step === "reveal"
          ? {
              backgroundImage: "url('/cardify/bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div
        className={
          step === "choose" || step === "cardIntro"
            ? "relative z-10 h-full w-full"
            : step === "collage"
              ? "relative z-10 mx-auto flex h-full max-w-[1440px] flex-col"
              : "relative z-10 mx-auto h-full max-w-[1440px]"
        }
      >
        {step === "collage" && (
          <header className="mx-auto mb-1.5 flex max-w-md shrink-0 flex-col items-center gap-1 rounded-[8px] border border-[#d7c9bb]/50 bg-[#fffdf9]/80 px-5 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md">
            <h1 className="text-xl font-black tracking-normal text-[var(--gc-black)]">CardifyBooth</h1>
          </header>
        )}

        {step === "choose" && (
          <section className="grid h-full w-full grid-cols-2 grid-rows-2">
            {/* Quarter 1 — Trading Card */}
            <button
              type="button"
              onClick={() => setStep("cardIntro")}
              className="group flex flex-col items-start justify-between overflow-hidden bg-[var(--gc-orange)] p-8 text-left text-white transition-all hover:brightness-110 active:brightness-95"
            >
              <Camera size={52} strokeWidth={2.2} />
              <span>
                <span className="flex items-center gap-3 text-4xl font-black tracking-wide">
                  Trading Card
                  <ArrowRight size={32} className="transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-1.5 block text-lg font-semibold text-white/85">Take a portrait &amp; create a personalized card</span>
              </span>
            </button>

            {/* Quarter 2 — Photo Collage */}
            <button
              type="button"
              onClick={() => setStep("collage")}
              className="group flex flex-col items-start justify-between overflow-hidden bg-[var(--gc-blue)] p-8 text-left text-white transition-all hover:brightness-110 active:brightness-95"
            >
              <Landmark size={52} strokeWidth={2.2} />
              <span>
                <span className="flex items-center gap-3 text-4xl font-black tracking-wide">
                  Photo Collage
                  <ArrowRight size={32} className="transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-1.5 block text-lg font-semibold text-white/85">Build a multi-photo keepsake print</span>
              </span>
            </button>

            {/* Quarter 3 — Ghost Runner (live, running in-quadrant) */}
            <div ref={gamePanelRef} className="group relative overflow-hidden bg-[#16213e]">
              <iframe
                ref={gameFrameRef}
                src="/ghost-runner/index.html"
                title="Ghost Runner Game"
                allow="camera; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
              {isGameFullscreen && (
                <button
                  type="button"
                  onClick={leaveGameForHome}
                  className="absolute bottom-6 right-6 z-20 inline-flex h-16 items-center gap-3 rounded-[8px] border-2 border-white bg-[var(--gc-orange)] px-7 text-xl font-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition-colors hover:bg-[#b94300] active:bg-[#963700]"
                >
                  <Home size={26} strokeWidth={2.5} />
                  Home
                </button>
              )}
              {!isGameFullscreen && (
                <button
                  type="button"
                  onClick={toggleGameFullscreen}
                  aria-label="Open game full screen"
                  title="Full screen"
                  className="absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-[8px] border border-white/30 bg-black/70 text-white hover:bg-black/85"
                >
                  <Maximize2 size={21} />
                </button>
              )}
            </div>

            {/* Quarter 4 — Description */}
            <div className="flex flex-col justify-between overflow-hidden bg-[#fffdf9] p-8 text-left">
              <div className="flex items-center gap-2.5">
                <Info size={38} strokeWidth={2.2} className="text-[var(--gc-orange)]" />
                <span className="text-2xl font-black text-[var(--gc-black)]">Welcome to CardifyBooth</span>
              </div>
              <div className="space-y-3 text-[var(--gc-gray)]">
                <p className="text-lg font-semibold leading-6">
                  Snap a portrait and our AI turns it into a collectible Gettysburg College trading card — printed on the spot.
                </p>
                <p className="text-lg font-semibold leading-6">
                  Want a keepsake strip instead? Build a photo collage. Waiting your turn? Play Ghost Runner.
                </p>
              </div>
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--gc-black)]/70">
                Tap a tile to start →
              </p>
            </div>
          </section>
        )}

        {/* Chloe's cardify1 splash. The gold cards + "CARDIFY BOOTH" wordmark are
            baked into home-bg.png, so START is positioned below the artwork's
            centred title and the logos sit bottom-left, per her storyboard. */}
        {step === "cardIntro" && (
          <section
            className="relative h-full w-full bg-[#F5A623] bg-cover bg-center"
            style={{ backgroundImage: "url('/cardify/home-bg.png')" }}
          >
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="absolute left-6 top-6 z-20 rounded-[30px] border border-black/25 bg-white/30 px-5 py-2.5 text-sm font-bold text-[#222] backdrop-blur-[4px] transition-all hover:bg-white/50 active:scale-95"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={() => setStep("cardSetup")}
              aria-label="Start making your trading card"
              className="absolute left-1/2 top-[60%] z-20 -translate-x-1/2 rounded-full transition-transform hover:scale-105 active:scale-95"
              style={{ animation: "cardifyPulseRing 1.8s infinite" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cardify/start-btn.png" alt="Start" className="h-auto w-[340px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]" />
            </button>

            <div className="absolute bottom-7 left-9 z-20 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cardify/icl-logo.png" alt="ICL" className="h-11 w-auto object-contain" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cardify/glogo.png" alt="Gettysburg College" className="h-11 w-auto object-contain" />
            </div>
          </section>
        )}

        {step === "collage" && (
          <section className="min-h-0 w-full flex-1 pb-4">
            <div className="overflow-hidden h-full rounded-[8px] border border-[var(--gc-black)]/14 bg-[#ffffff] shadow-lg">
              <PhotoCollage
                onExit={() => setStep("choose")}
                onActivity={() => setActivityNonce((n) => n + 1)}
              />
            </div>
          </section>
        )}

        {/* Chloe's cardify2: the photo panel sits left, the white field bars sit
            right, and her circular CONTINUE button submits — all straight on the
            orange gradient with no white shell around it. */}
        {step === "cardSetup" && (
          <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5">
            <button
              type="button"
              onClick={resetToChooser}
              className="w-fit rounded-[30px] border border-black/25 bg-white/30 px-5 py-2 text-sm font-bold text-[#222] backdrop-blur-[4px] transition-all hover:bg-white/50 active:scale-95"
            >
              ← Back
            </button>

            <CardForm
              isGenerating={false}
              photoReady={Boolean(photo)}
              mediaSlot={
                <ImageUpload
                  photo={photo}
                  onUpload={setPhoto}
                  onChooseAnother={() => setPhoto(null)}
                  onViewSample={() => setIsSampleCardOpen(true)}
                  samplePhoto={samplePhoto}
                />
              }
              onSubmit={handleGenerate}
            />
          </section>
        )}

        {isSampleCardOpen && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-[rgba(34,34,34,0.48)] p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Sample card"
          >
            <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-[8px] border border-[#d7c9bb] bg-white p-4 shadow-[0_8px_24px_rgba(34,34,34,0.18)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-black text-[var(--gc-black)]">Sample card</h2>
                <button
                  type="button"
                  onClick={() => setIsSampleCardOpen(false)}
                  className="rounded-[6px] border border-[var(--gc-black)]/18 bg-white px-3 py-2 text-sm font-bold text-[var(--gc-black)] hover:bg-[var(--gc-alabaster)]"
                >
                  Close
                </button>
              </div>
              <div className="mx-auto max-w-[320px]">
                <CardPreview card={sampleCard} photo={samplePhoto} />
              </div>
            </div>
          </div>
        )}

        {/* Chloe's loading screen: just the LOADING wordmark + three pulsing
            dots on the orange gradient (replaces the old white skeleton card). */}
        {step === "generating" && (
          <section className="relative grid h-full min-h-0 place-items-center overflow-hidden">
            <style>{`
              @keyframes cardifyDot {
                0%, 80%, 100% { transform: scale(0.7); opacity: 0.45; }
                40%           { transform: scale(1);   opacity: 1; }
              }
              /* Whole loader drifts off the left edge, then re-enters from the right. */
              @keyframes cardifyMarquee {
                from { transform: translateX(calc(50vw + 100%)); }
                to   { transform: translateX(calc(-50vw - 100%)); }
              }
              /* Pac-Man is two stacked quarter-notched circles chomping in opposite
                 directions; the wrapper is scaleX(-1) so he faces left, chasing the
                 dots as the marquee travels. */
              @keyframes cardifyJawTop {
                from { transform: rotate(38deg); }
                to   { transform: rotate(-2deg); }
              }
              @keyframes cardifyJawBottom {
                from { transform: rotate(-38deg); }
                to   { transform: rotate(2deg); }
              }
              .cardify-pacman { position: relative; width: 48px; height: 48px; transform: scaleX(-1); }
              .cardify-pacman .jaw {
                position: absolute; inset: 0; width: 0; height: 0;
                border: 24px solid #f2c40d; border-radius: 50%;
                border-right-color: transparent;
              }
              .cardify-pacman .jaw-top    { animation: cardifyJawTop 0.32s linear infinite alternate; }
              .cardify-pacman .jaw-bottom { animation: cardifyJawBottom 0.32s linear infinite alternate; }
              .cardify-pacman .eye {
                position: absolute; top: 9px; left: 22px; width: 6px; height: 6px;
                border-radius: 50%; background: #111; z-index: 1;
              }
            `}</style>
            <div
              className="flex flex-col items-center gap-7"
              style={{ animation: "cardifyMarquee 7s linear infinite" }}
              aria-hidden="true"
            >
              <h2 className="whitespace-nowrap text-center text-[56px] font-black uppercase leading-none tracking-[6px] text-black">
                Creating your card
              </h2>
              <div className="flex items-center gap-3.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full bg-black"
                    style={{ animation: `cardifyDot 1.3s ${i * 0.18}s infinite ease-in-out` }}
                  />
                ))}
                <span className="ml-4 cardify-pacman">
                  <span className="jaw jaw-top" />
                  <span className="jaw jaw-bottom" />
                  <span className="eye" />
                </span>
              </div>
            </div>
            <p className="sr-only">Making your card. Hold tight.</p>
          </section>
        )}

        {step === "reveal" && card && photo && (
          <CardReveal
            card={card}
            cardId={cardId}
            photo={photo}
            onRestart={resetCardFlow}
            onGoHome={resetToChooser}
          />
        )}
      </div>
    </main>
  );
}
