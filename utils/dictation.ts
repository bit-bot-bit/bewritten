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
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          this.recognition.start(); // Auto-restart if it stops unexpectedly
        } else if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
    }
  }

  public isSupported() {
    return !!this.recognition;
  }

  public start(
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
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (e) {
      // Ignore start errors if already started
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
