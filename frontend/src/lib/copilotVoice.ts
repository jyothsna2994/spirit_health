type SpeechResult = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

export const voiceSupported = () => {
  if (typeof window === "undefined") return false;

  const browser = window as any;

  return Boolean(
    browser.SpeechRecognition ||
    browser.webkitSpeechRecognition
  );
};

export function startVoiceInput(
  onText: (text: string) => void,
  onStop: () => void,
  onError: (message: string) => void,
  language = "en-IN"
) {
  if (typeof window === "undefined") {
    onError("Voice input is unavailable.");
    return null;
  }

  const browser = window as any;

  const Recognition = (
    browser.SpeechRecognition ||
    browser.webkitSpeechRecognition
  ) as SpeechRecognitionConstructor | undefined;

  if (!Recognition) {
    onError("Speech recognition is unavailable in this browser.");
    return null;
  }

  const recognition = new Recognition();

  recognition.lang = language;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript;

    if (transcript) {
      onText(transcript.trim());
    }
  };

  recognition.onerror = (event) => {
    if (event.error !== "aborted") {
      onError(`Microphone error: ${event.error}`);
    }
  };

  recognition.onend = onStop;

  try {
    recognition.start();
    return recognition;
  } catch (error: any) {
    onError(error?.message || "Could not start microphone.");
    return null;
  }
}

export function stopVoiceOutput() {
  if (
    typeof window !== "undefined" &&
    "speechSynthesis" in window
  ) {
    window.speechSynthesis.cancel();
  }
}


export function speakVoice(
  text: string,
  onEnd?: () => void
) {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return false;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  const telugu = /[\u0C00-\u0C7F]/.test(text);
  const hindi = /[\u0900-\u097F]/.test(text);
  const tamil = /[\u0B80-\u0BFF]/.test(text);

  utterance.lang = telugu
    ? "te-IN"
    : hindi
    ? "hi-IN"
    : tamil
    ? "ta-IN"
    : "en-IN";

  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = synth.getVoices();

  const matchingVoice = voices.find(
    (voice) =>
      voice.lang.toLowerCase() ===
      utterance.lang.toLowerCase()
  );

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  utterance.onend = () => onEnd?.();

  utterance.onerror = (event) => {
    console.warn("Speech synthesis error:", event.error);
    onEnd?.();
  };

  synth.speak(utterance);

  return true;
}
