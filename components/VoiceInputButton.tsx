"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// Ditado por voz (Web Speech API do navegador): grátis, sem servidor — o áudio é
// processado pelo próprio navegador. Funciona no Chrome, Edge e Safari; onde não
// existir, o botão não aparece. Escreve no campo de texto dentro de `within`
// (primeiro textarea/input de texto), disparando o evento `input` — então serve
// tanto pra campo controlado (React) quanto pra não controlado.
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function appendText(el: HTMLTextAreaElement | HTMLInputElement, text: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const current = el.value;
  const spacer = current && !/\s$/.test(current) ? " " : "";
  let next = `${current}${spacer}${text.trim()}`;
  const max = el.maxLength > 0 ? el.maxLength : null;
  if (max && next.length > max) next = next.slice(0, max);
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Permita o uso do microfone no navegador.",
  "service-not-allowed": "Permita o uso do microfone no navegador.",
  "no-speech": "Não ouvi nada — tente de novo.",
  "audio-capture": "Microfone não encontrado.",
  network: "Sem conexão pro reconhecimento de voz.",
};

export function VoiceInputButton({
  within,
  className = "",
}: {
  within: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => recRef.current?.stop();
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    const el = within.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea, input:not([type]), input[type="text"], input[type="tel"], input[type="email"], input[type="url"], input[type="search"]');
    if (!Ctor || !el) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) appendText(el, result[0].transcript);
      }
    };
    rec.onerror = (event) => {
      setError(ERROR_MESSAGES[event.error] ?? "Não deu pra usar o microfone.");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        title={listening ? "Parar o ditado" : "Ditar por voz"}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
          listening ? "animate-pulse border-red-500 bg-red-50 text-red-600" : "border-border text-muted hover:border-brand hover:text-brand"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
          <path d="M12 18v4" />
        </svg>
      </button>
      {listening && <span className="text-[11px] text-red-600">ouvindo…</span>}
      {error && <span className="text-[11px] text-brand">{error}</span>}
    </span>
  );
}
