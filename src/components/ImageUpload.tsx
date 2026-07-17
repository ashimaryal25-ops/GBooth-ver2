"use client";

/* eslint-disable @next/next/no-img-element -- Captured/uploaded images are data URLs. */

import { Camera, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ImageUploadProps {
  photo: string | null;
  onUpload: (photo: string) => void;
  onChooseAnother: () => void;
  onViewSample: () => void;
  samplePhoto: string;
}

type CameraStatus = "idle" | "starting" | "active" | "error";

export function ImageUpload({ photo, onUpload, onChooseAnother, onViewSample, samplePhoto }: ImageUploadProps) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const mirrorChannelRef = useRef<BroadcastChannel | null>(null);
  const captureRequestIdRef = useRef<string | null>(null);
  const captureTimeoutRef = useRef<number | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const lastRelayIdRef = useRef(0);

  const sendToMirror = useCallback((message: Record<string, unknown>) => {
    mirrorChannelRef.current?.postMessage(message);
    void fetch("/api/mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "mirror", ...message }),
    }).catch(() => {});
  }, []);

  const clearCaptureTimeout = useCallback(() => {
    if (captureTimeoutRef.current !== null) {
      window.clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
  }, []);

  const startCamera = useCallback(() => {
    setCameraStatus("starting");
    sendToMirror({ type: "mirror-start" });
    sendToMirror({ type: "mirror-ping" });

    if (readyTimeoutRef.current !== null) {
      window.clearTimeout(readyTimeoutRef.current);
    }
    readyTimeoutRef.current = window.setTimeout(() => {
      setCameraStatus((status) => {
        if (status === "starting") {
          return "error";
        }
        return status;
      });
    }, 3500);
  }, [sendToMirror]);

  const capturePhoto = useCallback(() => {
    const channel = mirrorChannelRef.current;
    if ((!channel && typeof fetch === "undefined") || cameraStatus !== "active") {
      return;
    }

    clearCaptureTimeout();
    const requestId = crypto.randomUUID();
    captureRequestIdRef.current = requestId;
    sendToMirror({ type: "capture-request", requestId });

    captureTimeoutRef.current = window.setTimeout(() => {
      captureRequestIdRef.current = null;
      setCameraStatus("error");
    }, 3500);
  }, [cameraStatus, clearCaptureTimeout, sendToMirror]);

  const handleMirrorMessage = useCallback((data: Record<string, unknown>) => {
    if (data.type === "mirror-ready") {
      if (readyTimeoutRef.current !== null) {
        window.clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
      setCameraStatus("active");
      return;
    }

    if (data.type === "mirror-error") {
      setCameraStatus("error");
      return;
    }

    if (data.type === "captured-photo" && data.requestId === captureRequestIdRef.current && typeof data.dataUrl === "string") {
      clearCaptureTimeout();
      captureRequestIdRef.current = null;
      setCountdown(null);
      setCameraStatus("active");
      onUpload(data.dataUrl);
    }
  }, [clearCaptureTimeout, onUpload]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      window.setTimeout(() => {
        setCameraStatus("error");
      }, 0);
    } else {
      const channel = new BroadcastChannel("cardifybooth-mirror");
      mirrorChannelRef.current = channel;
      channel.onmessage = (event) => handleMirrorMessage(event.data || {});
    }

    window.setTimeout(() => startCamera(), 0);

    return () => {
      clearCaptureTimeout();
      if (readyTimeoutRef.current !== null) {
        window.clearTimeout(readyTimeoutRef.current);
      }
      mirrorChannelRef.current?.close();
      mirrorChannelRef.current = null;
    };
  }, [clearCaptureTimeout, handleMirrorMessage, startCamera]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/mirror?role=kiosk&since=${lastRelayIdRef.current}`, { cache: "no-store" });
        const data = (await response.json()) as { events?: Array<Record<string, unknown> & { id?: number }> };
        for (const event of data.events ?? []) {
          lastRelayIdRef.current = Math.max(lastRelayIdRef.current, event.id ?? 0);
          handleMirrorMessage(event);
        }
      } catch {}

      if (!cancelled) window.setTimeout(poll, 200);
    };

    void poll();
    return () => { cancelled = true; };
  }, [handleMirrorMessage]);

  useEffect(() => {
    sendToMirror({ type: "countdown", value: countdown ?? 0 });
  }, [countdown, sendToMirror]);

  useEffect(() => {
    if (countdown === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        capturePhoto();
        return;
      }

      setCountdown(countdown - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown, capturePhoto]);

  if (photo) {
    return (
      <section className="mx-auto grid w-full max-w-lg content-start justify-items-center gap-3 lg:max-w-none">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-[var(--gc-black)] shadow-[0_4px_16px_rgba(112,54,0,0.22)]">
          <img
            src={photo}
            alt="Captured booth portrait"
            className="h-full w-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onChooseAnother();
            window.setTimeout(() => startCamera(), 0);
          }}
          className="flex h-12 w-fit items-center justify-center gap-2.5 rounded-full bg-white px-10 text-base font-bold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.16)] transition hover:bg-[#fff6ea]"
        >
          <RefreshCw size={19} />
          Retake photo
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto grid h-full min-h-0 w-full max-w-lg content-start gap-2.5 lg:max-w-none">
      <div className="overflow-hidden rounded-[10px] bg-white p-2.5 shadow-[0_3px_12px_rgba(112,54,0,0.16)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-[#efece6]">
          <div className="grid h-full place-items-center p-6">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[6px] border border-[var(--gc-orange)]/24 bg-white text-[var(--gc-orange)]">
                <Camera size={28} />
              </div>
              <p className="mt-4 text-xl font-black text-[var(--gc-black)]">Look at the camera</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--gc-gray)]">
                Your photo will appear here after the countdown.
              </p>
            </div>
          </div>

          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 grid place-items-center bg-black/30 text-white" role="status" aria-live="assertive">
              <span className="text-8xl font-black tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {countdown}
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCountdown(3)}
        disabled={cameraStatus !== "active" || countdown !== null}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#c25a1f] text-base font-bold text-white shadow-[0_3px_12px_rgba(112,54,0,0.24)] transition hover:bg-[#a84c17] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Camera size={20} />
        {countdown !== null ? "Ready..." : "Take Picture"}
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onUpload(samplePhoto)}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/75 text-base font-semibold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.14)] transition hover:bg-white"
        >
          Use sample
        </button>

        <button
          type="button"
          onClick={onViewSample}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/75 text-base font-semibold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.14)] transition hover:bg-white"
        >
          See sample card
        </button>
      </div>
    </section>
  );
}
