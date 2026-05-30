// Respiratory rate counter — envelope-peak detection on the breathing portion
// of a 30-sec voice note. Pure signal processing, no ML, no model.
//
// Why this matters: WHO IMCI's primary clinical criterion for pediatric
// pneumonia is tachypnea (fast breathing), not cough sound. Thresholds:
//   • 0–2 months   ≥ 60 breaths/min
//   • 2–12 months  ≥ 50 breaths/min
//   • 12–60 months ≥ 40 breaths/min
// A child meeting tachypnea criteria + a non-healthy cough class is high-
// confidence pneumonia even when the acoustic classifier's confidence is
// borderline. This is the multi-modal lift over an audio-only system.
//
// Algorithm:
//   1. Bandpass 100–800 Hz on the PCM signal (breathing energy band).
//   2. Compute short-time RMS envelope (30 ms hop).
//   3. Smooth envelope, find peaks separated by ≥ 250 ms (the physiological
//      ceiling — even tachypneic infants don't exceed ~150 bpm = 400 ms between
//      breaths). 250 ms keeps a small margin for noise rejection.
//   4. Count peaks × (60 / duration_sec) → breaths/min.
//
// The result is intentionally conservative — when the recording is too noisy
// to confidently detect ≥ 3 peaks, returns `null` and the severity rules
// fall back to audio-class-only behavior.

export interface RespiratoryRateResult {
  breathsPerMin: number;
  peakCount: number;
  durationSec: number;
  confidence: "high" | "medium" | "low";
}

const FRAME_HOP_MS = 30;
const MIN_PEAK_DISTANCE_MS = 250;
const MIN_PEAKS_REQUIRED = 3;

export function computeRespiratoryRate(
  samples: Float32Array,
  sampleRate: number
): RespiratoryRateResult | null {
  if (samples.length < sampleRate * 2) return null; // need ≥2 sec
  const durationSec = samples.length / sampleRate;

  // 1. Light bandpass for breathing band — simple cascaded biquads.
  const filtered = bandpass(samples, sampleRate, 100, 800);

  // 2. Short-time RMS envelope.
  const hopSamples = Math.round((FRAME_HOP_MS / 1000) * sampleRate);
  const frameSamples = hopSamples * 3; // ~90 ms windows, 67% overlap
  const env: number[] = [];
  for (let i = 0; i + frameSamples <= filtered.length; i += hopSamples) {
    let acc = 0;
    for (let j = 0; j < frameSamples; j++) {
      const v = filtered[i + j];
      acc += v * v;
    }
    env.push(Math.sqrt(acc / frameSamples));
  }
  if (env.length < 10) return null;

  // 3. Smooth (moving average, ~120 ms) + peak-find.
  const smoothed = movingAverage(env, 4);
  const minDistFrames = Math.round(
    (MIN_PEAK_DISTANCE_MS / 1000) * (sampleRate / hopSamples)
  );
  const peaks = findPeaks(smoothed, minDistFrames);

  if (peaks.length < MIN_PEAKS_REQUIRED) return null;

  // 4. Scale.
  const breathsPerMin = (peaks.length * 60) / durationSec;
  const confidence: RespiratoryRateResult["confidence"] =
    peaks.length >= 8 ? "high" : peaks.length >= 5 ? "medium" : "low";

  return {
    breathsPerMin: Math.round(breathsPerMin),
    peakCount: peaks.length,
    durationSec,
    confidence
  };
}

// WHO IMCI pediatric tachypnea thresholds. Returns true if the measured RR
// crosses the age-banded fast-breathing line.
export function meetsTachypneaCriteria(
  breathsPerMin: number,
  ageMonths: number
): boolean {
  if (ageMonths < 2) return breathsPerMin >= 60;
  if (ageMonths < 12) return breathsPerMin >= 50;
  if (ageMonths < 60) return breathsPerMin >= 40;
  return false; // ≥5 yr — adult thresholds out of scope for this app
}

// ────────────────── internal signal-processing helpers ──────────────────

// 4th-order Butterworth bandpass via two cascaded biquads. Stable, low-order,
// good enough for breath-envelope work — not a clinical-grade filter.
function bandpass(
  x: Float32Array,
  fs: number,
  fLow: number,
  fHigh: number
): Float32Array {
  const lp = biquadLowpass(x, fs, fHigh);
  return biquadHighpass(lp, fs, fLow);
}

function biquadLowpass(x: Float32Array, fs: number, fc: number): Float32Array {
  const w0 = (2 * Math.PI * fc) / fs;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const Q = Math.SQRT1_2;
  const alpha = sinw / (2 * Q);
  const b0 = (1 - cosw) / 2;
  const b1 = 1 - cosw;
  const b2 = (1 - cosw) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw;
  const a2 = 1 - alpha;
  return applyBiquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function biquadHighpass(x: Float32Array, fs: number, fc: number): Float32Array {
  const w0 = (2 * Math.PI * fc) / fs;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const Q = Math.SQRT1_2;
  const alpha = sinw / (2 * Q);
  const b0 = (1 + cosw) / 2;
  const b1 = -(1 + cosw);
  const b2 = (1 + cosw) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw;
  const a2 = 1 - alpha;
  return applyBiquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function applyBiquad(
  x: Float32Array,
  b0: number,
  b1: number,
  b2: number,
  a1: number,
  a2: number
): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const out = b0 * x[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    y[n] = out;
    x2 = x1;
    x1 = x[n];
    y2 = y1;
    y1 = out;
  }
  return y;
}

function movingAverage(x: number[], window: number): number[] {
  const out = new Array(x.length).fill(0);
  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc += x[i];
    if (i >= window) acc -= x[i - window];
    out[i] = acc / Math.min(i + 1, window);
  }
  return out;
}

// Simple peak-find: local maxima with min separation. No derivative tricks —
// reliable for slow envelopes like breath traces.
function findPeaks(x: number[], minDistance: number): number[] {
  const peaks: number[] = [];
  // Adaptive threshold: median + 0.3 × IQR of the envelope.
  const sorted = [...x].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const threshold = median + 0.3 * (q3 - q1);

  let lastPeak = -minDistance;
  for (let i = 1; i < x.length - 1; i++) {
    if (
      x[i] > threshold &&
      x[i] > x[i - 1] &&
      x[i] >= x[i + 1] &&
      i - lastPeak >= minDistance
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  return peaks;
}
