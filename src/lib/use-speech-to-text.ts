"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Minimal typings for the Web Speech API, which is not in the standard TS lib.
interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlternative;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

interface UseSpeechToTextOptions {
  lang?: string;
  onTranscript: (transcript: string) => void;
}

// The set of supported APIs never changes after load, so there is nothing to subscribe to.
const subscribeToNothing = () => () => {};

/**
 * Dictation via the browser Web Speech API. Runs entirely through the browser
 * (no API key); `supported` is false where the API is unavailable so callers
 * can hide the control and fall back to typing.
 */
export function useSpeechToText({ lang = "en-US", onTranscript }: UseSpeechToTextOptions) {
  const supported = useSyncExternalStore(
    subscribeToNothing,
    () => getRecognitionConstructor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const RecognitionCtor = getRecognitionConstructor();
    if (!RecognitionCtor) {
      setError("unsupported");
      return;
    }

    if (recognitionRef.current) {
      return;
    }

    setError(null);

    const recognition = new RecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      // Rebuild the entire recognition session on every result event. This
      // includes both final phrases and the current interim phrase, allowing
      // the form to display words while the guest is still speaking.
      let liveText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        liveText += `${event.results[index][0].transcript} `;
      }

      if (liveText.trim()) {
        onTranscriptRef.current(liveText.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn(`[speech] recognition error: ${event.error}`);
      setError(event.error);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (startError) {
      console.warn("[speech] failed to start recognition", startError);
      setError("start-failed");
      recognitionRef.current = null;
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  return { supported, listening, error, toggle };
}
