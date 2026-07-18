"use client";

import { ArrowRight, Keyboard as KeyboardIcon, Mic, MicOff } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import Keyboard from "react-simple-keyboard";
import type { CardRequest } from "@/lib/card-schema";
import { gettysburgTheme } from "@/lib/themes";
import { useSpeechToText } from "@/lib/use-speech-to-text";

const MAX_NAME_LENGTH = 28;

type ActiveField = "name" | "selfDescription" | null;

const keyboardLayout = {
  default: [
    "1 2 3 4 5 6 7 8 9 0",
    "q w e r t y u i o p",
    "a s d f g h j k l",
    "{shift} z x c v b n m {bksp}",
    "{space} , . ' {done}",
  ],
  shift: [
    "1 2 3 4 5 6 7 8 9 0",
    "Q W E R T Y U I O P",
    "A S D F G H J K L",
    "{shift} Z X C V B N M {bksp}",
    "{space} , . ! ? {done}",
  ],
};

const keyboardDisplay = {
  "{bksp}": "Backspace",
  "{shift}": "Shift",
  "{space}": "Space",
  "{done}": "Done",
};

function describeVoiceError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in the browser, then try again.";
    case "no-speech":
      return "Nothing was detected. Tap Speak and try again.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Voice input needs an internet connection.";
    case "unsupported":
      return "Voice input is unavailable in this browser.";
    default:
      return "Voice input stopped. You can continue typing.";
  }
}

interface CardFormProps {
  isGenerating: boolean;
  photoReady?: boolean;
  mediaSlot?: ReactNode;
  onSubmit: (request: CardRequest) => void;
}

export function CardForm({ isGenerating, photoReady = true, mediaSlot, onSubmit }: CardFormProps) {
  const [name, setName] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [layoutName, setLayoutName] = useState<"default" | "shift">("default");
  const speechBaseRef = useRef("");

  const canSubmit = useMemo(
    () => photoReady && name.trim().length > 0 && selfDescription.trim().length >= 8,
    [photoReady, name, selfDescription],
  );

  const focusField = useCallback((field: Exclude<ActiveField, null>) => {
    setActiveField(field);
    setLayoutName("default");
  }, []);

  const handleKeyPress = useCallback(
    (button: string) => {
      if (button === "{shift}") {
        setLayoutName((current) => (current === "default" ? "shift" : "default"));
        return;
      }
      if (button === "{done}") {
        setActiveField(null);
        return;
      }
      if (!activeField) return;

      const setter = activeField === "name" ? setName : setSelfDescription;

      if (button === "{bksp}") {
        setter((current) => current.slice(0, -1));
      } else if (button === "{space}") {
        setter((current) =>
          activeField === "name"
            ? `${current} `.slice(0, MAX_NAME_LENGTH)
            : `${current} `,
        );
      } else {
        setter((current) =>
          activeField === "name"
            ? `${current}${button}`.slice(0, MAX_NAME_LENGTH)
            : `${current}${button}`,
        );
        if (layoutName === "shift") setLayoutName("default");
      }
    },
    [activeField, layoutName],
  );

  const applyLiveTranscript = useCallback((spoken: string) => {
    const base = speechBaseRef.current.trimEnd();
    const separator = base ? " " : "";
    setSelfDescription(`${base}${separator}${spoken}`);
  }, []);

  const {
    supported: voiceSupported,
    listening,
    error: voiceError,
    toggle: toggleVoice,
  } = useSpeechToText({ onTranscript: applyLiveTranscript });

  const handleVoiceToggle = useCallback(() => {
    if (!listening) {
      speechBaseRef.current = selfDescription;
      setActiveField("selfDescription");
    }
    toggleVoice();
  }, [listening, selfDescription, toggleVoice]);

  return (
    <form
      className="h-full min-h-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        setActiveField(null);
        onSubmit({
          name: name.trim(),
          theme: gettysburgTheme.id,
          selfDescription: selfDescription.trim(),
        });
      }}
    >
      <div className="card-setup-frame grid h-full min-h-0 overflow-hidden rounded-[10px] border border-black/20 bg-[#fffaf2] shadow-[0_8px_24px_rgba(78,38,9,0.18)] lg:grid-cols-[minmax(420px,0.9fr)_minmax(560px,1.1fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-b border-black/12 bg-[#f6eee2] p-4 lg:border-r lg:border-b-0">
          <div className="min-h-0 flex-1">{mediaSlot}</div>
          <div className="mt-3 grid shrink-0 grid-cols-3 divide-x divide-black/12 border-t border-black/12 pt-3 text-left">
            <div className="pr-3">
              <strong className="block text-sm text-[#1b1a17]">1. Take a photo</strong>
              <span className="mt-1 block text-xs leading-4 text-[#6d6255]">Face the camera screen.</span>
            </div>
            <div className="px-3">
              <strong className="block text-sm text-[#1b1a17]">2. Tell us about you</strong>
              <span className="mt-1 block text-xs leading-4 text-[#6d6255]">Type or use the microphone.</span>
            </div>
            <div className="pl-3">
              <strong className="block text-sm text-[#1b1a17]">3. Create and print</strong>
              <span className="mt-1 block text-xs leading-4 text-[#6d6255]">Your card is made on the spot.</span>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-[#fffaf2] p-4">
          <div className="mb-3 flex shrink-0 items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-[#1b1a17]">Create your card</h1>
              <p className="mt-1 text-sm font-semibold text-[#6d6255]" aria-live="polite">
                {voiceError
                  ? describeVoiceError(voiceError)
                  : listening
                    ? "Listening - your words will appear below as you speak."
                    : !photoReady
                      ? "Take your photo, then complete both fields."
                      : "Complete both fields, then create your card."}
              </p>
            </div>
            <span className="shrink-0 border-l border-black/12 pl-4 text-right text-xs font-bold text-[#6d6255]">
              Gettysburg College
              <span className="block font-medium">Trading Card</span>
            </span>
          </div>

          <div className="shrink-0">
            <label className="grid gap-1 text-xs font-bold text-[#4f463c]" htmlFor="name">
              Name or nickname
              <input
                id="name"
                name="booth-guest-name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="none"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onFocus={() => focusField("name")}
                onChange={(event) => setName(event.target.value.slice(0, MAX_NAME_LENGTH))}
                placeholder="Your name"
                className={`h-12 rounded-[7px] border bg-white px-3 text-base font-semibold text-[#1b1a17] outline-none placeholder:text-[#a49787] ${
                  activeField === "name"
                    ? "border-[var(--gc-orange)] ring-2 ring-[var(--gc-orange)]/20"
                    : "border-black/18"
                }`}
              />
            </label>
          </div>

          <label className="mt-3 grid shrink-0 gap-1 text-xs font-bold text-[#4f463c]" htmlFor="self-description">
            Describe yourself in 1-2 sentences
            <div className="relative">
              <textarea
                id="self-description"
                inputMode="none"
                value={selfDescription}
                onFocus={() => focusField("selfDescription")}
                onChange={(event) => setSelfDescription(event.target.value)}
                placeholder="What do you enjoy, make, lead, study, or help with?"
                className={`card-description h-[112px] w-full resize-none rounded-[7px] border bg-white px-3 py-3 pr-28 text-base font-medium leading-6 text-[#1b1a17] outline-none placeholder:text-[#a49787] ${
                  activeField === "selfDescription"
                    ? "border-[var(--gc-orange)] ring-2 ring-[var(--gc-orange)]/20"
                    : "border-black/18"
                }`}
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  aria-pressed={listening}
                  className={`absolute right-2 top-2 inline-flex h-9 items-center gap-1.5 rounded-[7px] border px-3 text-xs font-bold ${
                    listening
                      ? "border-[var(--gc-orange)] bg-[var(--gc-orange)] text-white"
                      : "border-black/15 bg-[#f3ede3] text-[#1b1a17] hover:bg-[#e9dece]"
                  }`}
                >
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                  {listening ? "Stop" : "Speak"}
                </button>
              )}
            </div>
          </label>

          <div className="mt-3 min-h-0 shrink-0 rounded-[8px] border border-black/14 bg-[#e9e1d5] p-2.5">
            <div className="mb-2 flex h-6 items-center justify-between gap-3 px-1">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#5e554a]">
                <KeyboardIcon size={16} />
                {activeField
                  ? `Typing: ${activeField === "name" ? "name" : "description"}`
                  : "Tap a field to start typing"}
              </span>
              {activeField && (
                <button
                  type="button"
                  onClick={() => setActiveField(null)}
                  className="h-7 rounded-[6px] border border-black/15 bg-white px-3 text-xs font-bold text-[#1b1a17]"
                >
                  Close
                </button>
              )}
            </div>
            <Keyboard
              layoutName={layoutName}
              layout={keyboardLayout}
              display={keyboardDisplay}
              onKeyPress={handleKeyPress}
              theme="hg-theme-default booth-kb"
              preventMouseDownDefault
            />
          </div>

          <div className="mt-3 flex min-h-12 shrink-0 items-center justify-between gap-4 border-t border-black/12 pt-3">
            <p className="text-xs font-semibold text-[#6d6255]">
              A few clear sentences work best.
            </p>
            <button
              type="submit"
              disabled={!canSubmit || isGenerating}
              className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-[8px] bg-[var(--gc-orange)] px-6 text-base font-black text-white hover:bg-[#a94000] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isGenerating ? "Creating card" : "Create my card"}
              <ArrowRight size={19} />
            </button>
          </div>
        </section>
      </div>

      <style>{`
        .booth-kb.hg-theme-default { background: transparent; padding: 0; }
        .booth-kb .hg-row { margin-bottom: 5px; }
        .booth-kb .hg-row:last-child { margin-bottom: 0; }
        .booth-kb .hg-button {
          height: 46px;
          border-radius: 7px;
          border: 1px solid rgba(34, 34, 34, 0.16);
          background: #ffffff;
          box-shadow: 0 2px 0 rgba(34, 34, 34, 0.13);
          color: #1b1a17;
          font-size: 16px;
          font-weight: 700;
        }
        .booth-kb .hg-button:active { background: #ffe9da; transform: translateY(1px); box-shadow: none; }
        .booth-kb .hg-button.hg-functionBtn { background: #dcd3c5; font-size: 13px; }
        .booth-kb .hg-button[data-skbtn="{space}"] { max-width: none; flex-grow: 6; }
        .booth-kb .hg-button[data-skbtn="{done}"] { background: var(--gc-orange); color: white; flex-grow: 2; }
        .booth-kb .hg-button[data-skbtn="{shift}"],
        .booth-kb .hg-button[data-skbtn="{bksp}"] { flex-grow: 1.6; }
        @media (max-height: 820px) {
          .card-setup-frame { font-size: 14px; }
          .card-description { height: 86px; }
          .booth-kb .hg-button { height: 40px; font-size: 15px; }
          .booth-kb .hg-row { margin-bottom: 4px; }
        }
      `}</style>
    </form>
  );
}
