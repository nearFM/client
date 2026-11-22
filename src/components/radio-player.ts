import type { RadioStation } from "../types";
import { resolveStationStream } from "../services/radio-browser";

export interface PlayerSnapshot {
  station: RadioStation | null;
  playing: boolean;
  loading: boolean;
  volume: number;
  error: string | null;
  visualizerAvailable: boolean;
  visualizerNote: string;
  analyser: AnalyserNode | null;
}

type Listener = (snapshot: PlayerSnapshot) => void;

export class RadioPlayer {
  private audio: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private station: RadioStation | null = null;
  private playing = false;
  private loading = false;
  private volume = 0.72;
  private error: string | null = null;
  private visualizerAvailable = false;
  private visualizerNote = "Select a station to begin.";
  private generation = 0;
  private listeners = new Set<Listener>();

  get snapshot(): PlayerSnapshot {
    return {
      station: this.station,
      playing: this.playing,
      loading: this.loading,
      volume: this.volume,
      error: this.error,
      visualizerAvailable: this.visualizerAvailable,
      visualizerNote: this.visualizerNote,
      analyser: this.analyser
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async play(station: RadioStation): Promise<void> {
    if (this.station?.stationuuid === station.stationuuid && this.audio) {
      await this.toggle();
      return;
    }

    const token = ++this.generation;
    this.releaseAudio();
    this.station = station;
    this.playing = false;
    this.loading = true;
    this.error = null;
    this.visualizerAvailable = false;
    this.visualizerNote = "Preparing audio analysis…";
    this.emit();

    try {
      const streamUrl = await resolveStationStream(station);
      if (token !== this.generation) return;

      try {
        this.visualizerNote = "Connecting audio analyser…";
        await this.startAudio(streamUrl, true, token);
        if (token !== this.generation) return;
        this.visualizerAvailable = true;
        this.visualizerNote = "LIVE AUDIO ANALYSIS";
        this.emit();
      } catch {
        if (token !== this.generation) return;
        this.releaseAudio();
        this.visualizerAvailable = false;
        this.visualizerNote = "VISUALIZER UNAVAILABLE FOR THIS STREAM";
        await this.startAudio(streamUrl, false, token);
        if (token !== this.generation) return;
        this.emit();
      }
    } catch (error) {
      if (token !== this.generation) return;
      this.loading = false;
      this.playing = false;
      this.error = this.describeError(error);
      this.visualizerNote = "NO AUDIO SIGNAL";
      this.emit();
    }
  }

  async toggle(): Promise<void> {
    if (!this.audio) return;
    if (this.audio.paused) {
      try {
        await this.context?.resume();
        await this.audio.play();
      } catch (error) {
        this.error = this.describeError(error);
        this.emit();
      }
    } else {
      this.audio.pause();
    }
  }

  setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
    if (this.audio) this.audio.volume = this.volume;
    this.emit();
  }

  private async startAudio(url: string, withAnalyser: boolean, token: number): Promise<void> {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = this.volume;

    if (withAnalyser) {
      audio.crossOrigin = "anonymous";
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) throw new Error("Web Audio API is unavailable.");

      this.context ??= new AudioContextConstructor();
      if (this.context.state === "suspended") await this.context.resume();

      const source = this.context.createMediaElementSource(audio);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(this.context.destination);

      this.source = source;
      this.analyser = analyser;
    } else {
      this.analyser = null;
    }

    this.audio = audio;
    this.attachAudioEvents(audio, token);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => finishReject(new Error("The stream did not begin playing in time.")), 15000);

      const finishResolve = (): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve();
      };

      const finishReject = (reason: unknown): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      };

      audio.addEventListener("playing", finishResolve, { once: true });
      audio.addEventListener("error", () => {
        const mediaError = audio.error;
        finishReject(new Error(mediaError ? `Media error (${mediaError.code}).` : "The stream could not be loaded."));
      }, { once: true });

      audio.src = url;
      audio.load();
      void audio.play().catch(finishReject);
    });
  }

  private attachAudioEvents(audio: HTMLAudioElement, token: number): void {
    audio.addEventListener("playing", () => {
      if (token !== this.generation) return;
      this.playing = true;
      this.loading = false;
      this.error = null;
      this.emit();
    });

    audio.addEventListener("waiting", () => {
      if (token !== this.generation) return;
      this.loading = true;
      this.emit();
    });

    audio.addEventListener("pause", () => {
      if (token !== this.generation) return;
      this.playing = false;
      this.loading = false;
      this.emit();
    });

    audio.addEventListener("ended", () => {
      if (token !== this.generation) return;
      this.playing = false;
      this.loading = false;
      this.emit();
    });

    audio.addEventListener("error", () => {
      if (token !== this.generation || !audio.error) return;
      this.playing = false;
      this.loading = false;
      this.error = `Stream interrupted (media error ${audio.error.code}).`;
      this.emit();
    });
  }

  private releaseAudio(): void {
    this.source?.disconnect();
    this.source = null;
    this.analyser?.disconnect();
    this.analyser = null;

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") return "Playback was blocked by the browser. Press play again.";
      return error.message;
    }
    return "Unable to play this station.";
  }

  private emit(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
