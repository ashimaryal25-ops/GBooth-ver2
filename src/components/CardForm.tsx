"use client";

import { Mic, MicOff } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import type { CardRequest } from "@/lib/card-schema";
import { gettysburgTheme } from "@/lib/themes";
import { useSpeechToText } from "@/lib/use-speech-to-text";

const MAX_DESCRIPTION_LENGTH = 220;
const MAX_NAME_LENGTH = 28;

function describeVoiceError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow mic access in the browser, then try Speak again.";
    case "no-speech":
      return "Didn't catch anything - tap Speak and talk a little louder.";
    case "audio-capture":
      return "No microphone was found. Plug one in, then try again.";
    case "network":
      return "Voice needs an internet connection to transcribe.";
    case "unsupported":
      return "Voice input isn't supported in this browser. Try Chrome or Edge.";
    default:
      return "Voice input failed - you can type instead.";
  }
}

interface CardFormProps {
  isGenerating: boolean;
  /** cardify2 shows the form beside the camera; CONTINUE stays locked until a photo exists. */
  photoReady?: boolean;
  mediaSlot?: ReactNode;
  onSubmit: (request: CardRequest) => void;
}

export function CardForm({ isGenerating, photoReady = true, mediaSlot, onSubmit }: CardFormProps) {
  const [name, setName] = useState("");
  const [selfDescription, setSelfDescription] = useState("");

  const canSubmit = useMemo(
    () => photoReady && name.trim().length > 0 && selfDescription.trim().length >= 8,
    [photoReady, name, selfDescription],
  );

  const appendSpokenText = useCallback((spoken: string) => {
    setSelfDescription((previous) => {
      const addition = spoken.trim();
      if (!addition) {
        return previous;
      }

      const separator = previous.length > 0 && !previous.endsWith(" ") ? " " : "";
      return `${previous}${separator}${addition}`.slice(0, MAX_DESCRIPTION_LENGTH);
    });
  }, []);

  const {
    supported: voiceSupported,
    listening,
    error: voiceError,
    toggle: toggleVoice,
  } = useSpeechToText({ onResult: appendSpokenText });

  // Chloe's cardify2 right column: two white bars (name + theme), one white
  // description box, and her circular CONTINUE button anchored bottom-right.
  // Fields take native focus so the Windows touchscreen keyboard pops up.
  const hint = (
    <p className="shrink-0 text-base font-bold text-[#5c3a10]" aria-live="polite">
      {voiceError
        ? describeVoiceError(voiceError)
        : listening
          ? "Listening... speak now, then tap Stop."
          : !photoReady
            ? "Take your photo, then fill in the card details."
            : "Tap a field to type, or use Speak."}
    </p>
  );

  const fieldPanel = (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <input
        id="name"
        // "booth-guest-name" + autoComplete off keeps Chrome from offering
        // previous guests' names as autofill suggestions on the shared kiosk.
        name="booth-guest-name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Name or nickname"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => setName(event.target.value.slice(0, MAX_NAME_LENGTH))}
        placeholder="Your name or nickname"
        className="h-14 w-full shrink-0 rounded-[8px] bg-white px-4 text-lg font-semibold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.16)] outline-none transition placeholder:text-[#b3a591] focus:ring-[3px] focus:ring-white/80"
      />

      <div className="flex h-14 shrink-0 items-center justify-between rounded-[8px] bg-white px-4 shadow-[0_3px_12px_rgba(112,54,0,0.16)]">
        <span className="text-base font-bold text-[#1b1a17]">Theme</span>
        <span className="text-base font-semibold text-[#8a7a63]">{gettysburgTheme.name}</span>
      </div>

      <div className="relative">
        <textarea
          id="self-description"
          aria-label="Describe yourself in 1-2 sentences"
          value={selfDescription}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(event) => setSelfDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
          placeholder="Describe yourself in 1-2 sentences..."
          className="h-[170px] w-full resize-none rounded-[8px] bg-white px-4 py-3 text-lg font-medium text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.16)] outline-none transition placeholder:text-[#b3a591] focus:ring-[3px] focus:ring-white/80"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-[22px] px-4 py-2 text-sm font-bold shadow-sm transition ${
              listening
                ? "bg-[var(--gc-orange)] text-white"
                : "bg-[#f3ede3] text-[#1b1a17] hover:bg-[#eadfcd]"
            }`}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
            {listening ? "Stop" : "Speak"}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end">
        <button
          type="submit"
          disabled={!canSubmit || isGenerating}
          aria-label={isGenerating ? "Generating card" : "Continue and generate card"}
          className={`shrink-0 rounded-full transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 disabled:hover:scale-100 ${
            canSubmit && !isGenerating ? "animate-pulse-ring" : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cardify/continue-btn.png"
            alt=""
            className="h-auto w-[168px] drop-shadow-[0_10px_22px_rgba(0,0,0,0.35)]"
          />
        </button>
      </div>
    </div>
  );

  return (
    <form
      className="min-h-0 min-w-0 lg:h-full"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) {
          return;
        }

        onSubmit({
          name,
          theme: gettysburgTheme.id,
          selfDescription,
        });
      }}
    >
      {mediaSlot ? (
        // content-center keeps the whole block vertically centred on the orange
        // now that the description box no longer stretches to fill the screen.
        <div className="grid h-full min-h-0 min-w-0 content-center gap-3">
          {hint}
          <div className="grid min-h-0 min-w-0 gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1fr)] lg:items-start">
            <div className="min-h-0 min-w-0">{mediaSlot}</div>
            {fieldPanel}
          </div>
        </div>
      ) : (
        <div className="grid h-full content-center gap-3">
          {hint}
          {fieldPanel}
        </div>
      )}
    </form>
  );
}
