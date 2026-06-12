"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeRespiratoryRate } from "@/lib/respiratory-rate";
import type { ChildProfile } from "@/lib/types";

export interface DemoResult {
  simulated: boolean;
  class: string;
  confidence: number;
  classProbs: Record<string, number>;
  modelVersion: string;
  breathsPerMin: number | null;
  rrConfidence: "high" | "medium" | "low" | null;
  severity: "critical" | "high" | "moderate" | "low";
  reason: string;
  mustEscalate: boolean;
  recommendedAction: string;
  banglaText: string;
  audioUrl: string | null;
  imciTitles: string[];
  escalatedTo: string | null;
}

type Status = "idle" | "recording" | "analyzing" | "error";

export function CoughRecorder({
  profile,
  onResult
}: {
  profile: ChildProfile;
  onResult: (r: DemoResult) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(24).fill(8));

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    rafRef.current = null;
    timerRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  function drawLoop() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const bars = 24;
    const step = Math.floor(data.length / bars) || 1;
    const next: number[] = [];
    for (let i = 0; i < bars; i++) {
      let acc = 0;
      for (let j = 0; j < step; j++) acc += data[i * step + j] ?? 0;
      next.push(8 + (acc / step / 255) * 92);
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(drawLoop);
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(drawLoop);

      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => void analyze(rec.mimeType || "audio/webm");
      mediaRef.current = rec;
      rec.start();

      startedAtRef.current = Date.now();
      setElapsed(0);
      setStatus("recording");
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (e) {
      setError(
        (e as Error).name === "NotAllowedError"
          ? "Microphone permission denied. Allow mic access and try again."
          : `Could not start recording: ${(e as Error).message}`
      );
      setStatus("error");
      cleanup();
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      setStatus("analyzing");
      mediaRef.current.stop();
    }
  }

  async function analyze(mimeType: string) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // Decode to PCM and measure real respiratory rate in the browser.
      let breathsPerMin: number | null = null;
      let rrConfidence: "high" | "medium" | "low" | null = null;
      try {
        const arrayBuf = await blob.arrayBuffer();
        const AC: typeof AudioContext =
          window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const decodeCtx = new AC();
        const audioBuf = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
        const samples = audioBuf.getChannelData(0);
        const rr = computeRespiratoryRate(samples as Float32Array, audioBuf.sampleRate);
        if (rr) {
          breathsPerMin = rr.breathsPerMin;
          rrConfidence = rr.confidence;
        }
        await decodeCtx.close();
      } catch (e) {
        console.warn("[recorder] RR decode failed:", (e as Error).message);
      }

      const audioBase64 = await blobToBase64(blob);

      const res = await fetch("/api/demo-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          audioMimeType: mimeType,
          breathsPerMin,
          rrConfidence,
          profile
        })
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      onResult((await res.json()) as DemoResult);
      setStatus("idle");
    } catch (e) {
      setError(`Analysis failed: ${(e as Error).message}`);
      setStatus("error");
    } finally {
      cleanup();
    }
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const recording = status === "recording";
  const analyzing = status === "analyzing";

  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="relative aspect-[9/19] rounded-[2.5rem] border-[10px] border-pulmo-deep bg-white shadow-2xl">
        <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-pulmo-deep" />
        <div className="flex items-center justify-between px-6 pt-6 text-[10px] text-pulmo-deep">
          <span>9:41</span>
          <span>● ▾</span>
        </div>
        <div className="flex h-[calc(100%-3rem)] flex-col items-center justify-between p-6">
          <div className="flex flex-col items-center pt-10 text-center">
            <p className="text-xs text-slate-500">
              {recording ? "Recording…" : analyzing ? "Analyzing…" : "Tap to record cough"}
            </p>
            <p className="mt-1 text-4xl font-bold text-pulmo-deep">{mmss}</p>
          </div>

          <div className="flex h-20 items-end gap-1">
            {levels.map((h, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-pulmo-blue transition-[height] duration-75"
                style={{ height: `${recording ? h : 12 + Math.abs(Math.sin(i * 0.7)) * 28}%` }}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 pb-4">
            {!recording ? (
              <button
                onClick={start}
                disabled={analyzing}
                aria-label="Start recording"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-pulmo-blue text-white shadow-lg transition hover:bg-pulmo-medium disabled:opacity-50"
              >
                <span className="block h-5 w-5 rounded-full bg-white" />
              </button>
            ) : (
              <button
                onClick={stop}
                aria-label="Stop recording"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
              >
                <span className="block h-4 w-4 rounded-sm bg-white" />
              </button>
            )}
            <p className="max-w-[18ch] text-center text-[11px] leading-snug text-slate-500">
              {error
                ? error
                : recording
                  ? "Hold near the child; tap stop after ~15–30s."
                  : analyzing
                    ? "Measuring breathing rate & deciding…"
                    : "Record the child's cough in a quiet place."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = String(reader.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
