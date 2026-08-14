export interface BrowserSpeechResult {
  readonly transcript: string;
  readonly confidence: number | null;
}

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence?: number;
}

interface SpeechRecognitionResultLike {
  readonly 0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: { readonly 0: SpeechRecognitionResultLike };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function browserSpeechSupported(): boolean {
  return recognitionConstructor() !== null;
}

export function listenOnce(
  onResult: (result: BrowserSpeechResult) => void,
  onEnd: () => void,
  onError: (message: string) => void
): () => void {
  const Constructor = recognitionConstructor();
  if (!Constructor) {
    onError("Reconhecimento de voz não está disponível neste navegador.");
    onEnd();
    return () => undefined;
  }

  const recognition = new Constructor();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const alternative = event.results[0]?.[0];
    if (!alternative?.transcript) return;
    onResult({
      transcript: alternative.transcript.trim(),
      confidence: typeof alternative.confidence === "number" ? alternative.confidence : null
    });
  };
  recognition.onerror = () => onError("Não foi possível interpretar o comando de voz.");
  recognition.onend = onEnd;
  recognition.start();

  return () => recognition.stop();
}

export function speakStudioResponse(message: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "pt-BR";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}
