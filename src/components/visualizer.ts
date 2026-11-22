export class Visualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private analyser: AnalyserNode | null = null;
  private playing = false;
  private frame = 0;
  private readonly bars = 48;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    this.context = context;
    this.draw = this.draw.bind(this);
    this.frame = requestAnimationFrame(this.draw);
  }

  setAnalyser(analyser: AnalyserNode | null): void {
    this.analyser = analyser;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
  }

  private draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width * ratio);
      const height = Math.floor(rect.height * ratio);

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.context.clearRect(0, 0, rect.width, rect.height);

      const baseline = rect.height - 3;
      this.context.strokeStyle = "rgba(166, 177, 194, 0.18)";
      this.context.lineWidth = 1;
      this.context.beginPath();
      this.context.moveTo(0, baseline);
      this.context.lineTo(rect.width, baseline);
      this.context.stroke();

      if (this.analyser && this.playing) {
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        const gap = 3;
        const barWidth = Math.max(1, (rect.width - gap * (this.bars - 1)) / this.bars);
        const step = Math.max(1, Math.floor(data.length / this.bars));

        for (let index = 0; index < this.bars; index += 1) {
          let sum = 0;
          const start = index * step;
          for (let sample = start; sample < Math.min(start + step, data.length); sample += 1) {
            sum += data[sample] ?? 0;
          }
          const magnitude = sum / step / 255;
          const eased = Math.pow(magnitude, 1.28);
          const barHeight = Math.max(2, eased * (rect.height - 8));
          const x = index * (barWidth + gap);
          const y = baseline - barHeight;

          this.context.fillStyle = index > this.bars * 0.76
            ? "#e8a15d"
            : index > this.bars * 0.48
              ? "#a8c5f0"
              : "#6f9fdc";
          this.context.fillRect(x, y, barWidth, barHeight);
        }
      } else {
        this.context.fillStyle = "rgba(158, 174, 196, 0.26)";
        this.context.fillRect(0, baseline - 2, rect.width, 2);
      }
    }

    this.frame = requestAnimationFrame(this.draw);
  }
}
