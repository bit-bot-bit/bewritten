import { formatDictation } from '../services/geminiService';
import { apiGet } from '../services/apiClient';

export interface DictationResult {
  text: string;
  isFinal: boolean;
}

export class DictationService {
  private recognition: any;
  private isListening = false;
  private onResultCallback?: (result: DictationResult) => void;
  private onErrorCallback?: (error: string) => void;
  private onEndCallback?: () => void;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (this.onResultCallback) {
          if (finalTranscript) {
            this.onResultCallback({ text: finalTranscript, isFinal: true });
          } else if (interimTranscript) {
            this.onResultCallback({ text: interimTranscript, isFinal: false });
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        // Prevent infinite restart loops on permission or fatal errors
        if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'network') {
          this.isListening = false;
        }

        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try {
            this.recognition.start(); // Auto-restart if it stops unexpectedly
          } catch (e) {
            this.isListening = false;
            if (this.onEndCallback) this.onEndCallback();
          }
        } else if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
    }
  }

  public isSupported() {
    return !!this.recognition;
  }

  public async start(
    onResult: (result: DictationResult) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      onError('Speech recognition is not supported in this browser.');
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onEndCallback = onEnd;

    try {
      // Explicitly ask the user for microphone access first if they haven't granted it.
      // This forces the browser permission dialogue to appear instead of failing silently.
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop the tracks since we don't need the raw stream, just the permission
        stream.getTracks().forEach(track => track.stop());
      }

      this.isListening = true;
      try {
        this.recognition.start();
      } catch (e) {
        // Ignore start errors if already started
      }
    } catch (err: any) {
      console.error("Microphone permission error:", err);
      this.isListening = false;
      // Provide a clearer error message based on the exception
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        onError("Microphone access denied. Please allow microphone access in your browser settings (HTTPS is required on some browsers).");
      } else {
        onError("Microphone access error: " + (err.message || String(err)));
      }
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }
}

export const processDictationText = async (text: string, context: string): Promise<string> => {
  try {
    // We shouldn't cache the settings here, but fetch them when needed.
    // Given the small size, fetching here is okay, but let's cache for only 5 seconds
    // to prevent rapid back-to-back fetching while allowing quick updates if they change settings
    const response = await apiGet('/user/settings');
    const settings = response.settings;

    if (settings?.aiDictation) {
       const res = await formatDictation(text, context);
       return res.text;
    }
    return text; // Return raw text if AI is disabled
  } catch (err) {
    console.error("Failed to format dictation", err);
    return text;
  }
}
