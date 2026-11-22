"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Ear,
  Eye,
  User,
  Sun,
  ImageOff,
  ScanFace,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CameraStatus } from "@/hooks/useWebcamCapture";

/**
 * Live face-verified selfie capture. A face-landmark model (MediaPipe) runs on the
 * camera feed and the photo is taken ONLY when, for ~1.5s in a row:
 *   • exactly one face is inside the circle (not cut by the frame/circle)
 *   • both ears are visible (face is straight, neither side is cut or turned away)
 *   • both eyes are open and the head is level
 *   • lighting is good and the background behind the head is plain/clear
 */

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const HOLD_MS = 1500;
const COUNTDOWN = 3;

type Checks = {
  face: boolean; // one face, fully inside circle
  single: boolean;
  ears: boolean;
  eyes: boolean;
  straight: boolean;
  light: boolean;
  background: boolean;
};
const EMPTY: Checks = { face: false, single: false, ears: false, eyes: false, straight: false, light: false, background: false };

type Phase = "idle" | "loading" | "live" | "countdown" | "captured" | "error";

export function SelfieCapture({
  videoRef,
  cameraStatus,
  onRequestCamera,
  onConfirm,
  uploading,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  onRequestCamera: () => Promise<boolean>;
  /** Called with the verified selfie; resolve true when it has been saved. */
  onConfirm: (blob: Blob) => Promise<boolean>;
  uploading: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [checks, setChecks] = useState<Checks>(EMPTY);
  const [message, setMessage] = useState<string>("Enable your camera to begin");
  const [earSide, setEarSide] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const [count, setCount] = useState(COUNTDOWN);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const passSinceRef = useRef<number | null>(null);
  const countStartRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  phaseRef.current = phase;

  const allPass = Object.values(checks).every(Boolean);

  // Load the model once the camera is ready.
  useEffect(() => {
    if (cameraStatus !== "READY" || landmarkerRef.current || phase === "captured") return;
    let cancelled = false;
    (async () => {
      setPhase("loading");
      setMessage("Loading face check…");
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM);
        const lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 2,
          outputFaceBlendshapes: true,
        });
        if (cancelled) return lm.close();
        landmarkerRef.current = lm;
        setPhase("live");
        setMessage("Place your face inside the circle");
      } catch (e) {
        if (cancelled) return;
        setLoadError((e as Error).message || "Could not load the face model");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cameraStatus, phase]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    },
    []
  );

  const takePhoto = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - side) / 2;
    const sy = (v.videoHeight - side) / 2;
    const c = document.createElement("canvas");
    c.width = c.height = 480;
    c.getContext("2d")!.drawImage(v, sx, sy, side, side, 0, 0, 480, 480);
    c.toBlob(
      (b) => {
        if (!b) return;
        setShot({ blob: b, url: URL.createObjectURL(b) });
        setPhase("captured");
      },
      "image/jpeg",
      0.9
    );
  }, [videoRef]);

  // Analysis loop.
  useEffect(() => {
    if (phase !== "live" && phase !== "countdown") return;
    let last = 0;
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (t - last < 120) return;
      last = t;
      const v = videoRef.current;
      const box = boxRef.current;
      const lm = landmarkerRef.current;
      if (!v || !box || !lm || v.readyState < 2 || !v.videoWidth) return;

      const S = box.clientWidth;
      const scale = S / Math.min(v.videoWidth, v.videoHeight);
      const offX = (v.videoWidth * scale - S) / 2;
      const offY = (v.videoHeight * scale - S) / 2;
      const cx = S / 2;
      const cy = S / 2;
      const R = S * 0.36;

      let res;
      try {
        res = lm.detectForVideo(v, performance.now());
      } catch {
        return;
      }
      const faces = res.faceLandmarks ?? [];
      const c: Checks = { ...EMPTY };
      let msg = "";
      let ears = { left: false, right: false };

      if (faces.length === 0) {
        msg = "No face found — look at the camera";
      } else if (faces.length > 1) {
        c.face = true;
        msg = "More than one person in view — only you should be visible";
      } else {
        c.single = true;
        const pts = faces[0] as { x: number; y: number }[];
        const P = (i: number) => ({ x: pts[i]!.x * v.videoWidth * scale - offX, y: pts[i]!.y * v.videoHeight * scale - offY });
        const inCircle = (p: { x: number; y: number }, k = 1) => Math.hypot(p.x - cx, p.y - cy) <= R * k;
        const top = P(10), chin = P(152), edgeA = P(234), edgeB = P(454), nose = P(1);
        const inFrame = (p: { x: number; y: number }) => p.x > 4 && p.y > 4 && p.x < S - 4 && p.y < S - 4;

        const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
        const tooBig = ![top, chin, edgeA, edgeB].every((p) => inCircle(p));
        const tooSmall = faceH < R * 1.1;
        c.face = !tooBig && !tooSmall && [top, chin, edgeA, edgeB].every(inFrame);

        // Ears: both side edges (tragion area) must be inside the circle AND the head must be
        // frontal, so that neither ear is hidden by a turned head.
        const dA = Math.abs(nose.x - edgeA.x);
        const dB = Math.abs(edgeB.x - nose.x);
        const ratio = dA / Math.max(1, dA + dB); // 0.5 = perfectly frontal
        // Display is mirrored: landmark 454 (image-right) shows on the user's LEFT.
        const leftVisible = inCircle(edgeB) && ratio < 0.62;
        const rightVisible = inCircle(edgeA) && ratio > 0.38;
        ears = { left: leftVisible, right: rightVisible };
        c.ears = leftVisible && rightVisible;

        const eyeL = P(33), eyeR = P(263);
        const roll = Math.abs((Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x) * 180) / Math.PI);
        c.straight = roll < 9 && ratio > 0.38 && ratio < 0.62;

        const shapes = res.faceBlendshapes?.[0]?.categories ?? [];
        const sc = (n: string) => shapes.find((s: { categoryName: string }) => s.categoryName === n)?.score ?? 1;
        c.eyes = sc("eyeBlinkLeft") < 0.4 && sc("eyeBlinkRight") < 0.4;

        // Lighting + background from a small sample of the square crop.
        const N = 64;
        const cv = (sampleRef.current ??= document.createElement("canvas"));
        cv.width = cv.height = N;
        const g = cv.getContext("2d", { willReadFrequently: true })!;
        const side = Math.min(v.videoWidth, v.videoHeight);
        g.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, N, N);
        const d = g.getImageData(0, 0, N, N).data;
        const lum = (x: number, y: number) => {
          const i = (y * N + x) * 4;
          return 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
        };
        let faceSum = 0, faceN = 0, grad = 0, gradN = 0;
        const rr = (R / S) * N;
        for (let y = 1; y < N - 1; y++) {
          for (let x = 1; x < N - 1; x++) {
            const dist = Math.hypot(x - N / 2, y - N / 2);
            if (dist < rr * 0.6) {
              faceSum += lum(x, y);
              faceN++;
            } else if (dist > rr * 1.12 && y < N / 2 + rr * 0.55) {
              grad += Math.abs(lum(x + 1, y) - lum(x, y)) + Math.abs(lum(x, y + 1) - lum(x, y));
              gradN++;
            }
          }
        }
        const faceLum = faceN ? faceSum / faceN : 0;
        const bgGrad = gradN ? grad / gradN : 0;
        c.light = faceLum > 60 && faceLum < 215;
        c.background = bgGrad < 15;

        if (!c.face) msg = tooSmall ? "Move closer — fill the circle with your face" : "Keep your whole face and both ears inside the circle";
        else if (!c.ears) {
          const which = !leftVisible && !rightVisible ? "Both ears are" : !leftVisible ? "Left ear is" : "Right ear is";
          msg = `${which} not fully visible — face the camera straight, keep both ears inside the circle`;
        } else if (!c.eyes) msg = "Open both eyes";
        else if (!c.straight) msg = "Keep your head straight and level";
        else if (!c.light) msg = faceLum <= 60 ? "Too dark — face a light source" : "Too bright — reduce glare behind/over your face";
        else if (!c.background) msg = "Background is not clear — sit in front of a plain wall";
      }

      const ok = Object.values(c).every(Boolean);
      setChecks(c);
      setEarSide(ears);

      const now = performance.now();
      if (!ok) {
        passSinceRef.current = null;
        countStartRef.current = null;
        if (phaseRef.current === "countdown") setPhase("live");
        setMessage(msg || "Adjust your position");
        return;
      }
      if (passSinceRef.current == null) passSinceRef.current = now;
      if (phaseRef.current === "live") {
        setMessage("Perfect — hold still");
        if (now - passSinceRef.current >= HOLD_MS) {
          countStartRef.current = now;
          setCount(COUNTDOWN);
          setPhase("countdown");
        }
      } else if (phaseRef.current === "countdown" && countStartRef.current != null) {
        const left = COUNTDOWN - Math.floor((now - countStartRef.current) / 1000);
        setMessage("Hold still…");
        if (left <= 0) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          takePhoto();
        } else setCount(left);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, videoRef, takePhoto]);

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    passSinceRef.current = null;
    setChecks(EMPTY);
    setPhase("live");
    setMessage("Place your face inside the circle");
  }

  const ring = phase === "captured" ? "#10b981" : allPass ? "#10b981" : checks.single || checks.face ? "#ef4444" : "#94a3b8";
  const live = phase === "live" || phase === "countdown";
  const bad = live && !allPass && (checks.single || checks.face || message.startsWith("No face"));

  const CheckRow = ({ ok, icon: Icon, label }: { ok: boolean; icon: typeof Ear; label: string }) => (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
      !live ? "border-slate-700 text-slate-400" : ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"
    }`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {live && (ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />)}
    </div>
  );

  return (
    <div className="grid md:grid-cols-[minmax(0,320px)_1fr] gap-6 items-start">
      <div>
        <div ref={boxRef} className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-700">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)] ${phase === "captured" ? "invisible" : ""}`}
          />
          {phase === "captured" && shot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.url} alt="Your selfie" className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
          )}

          {/* Circle guide: dim everything outside */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full pointer-events-none">
            <defs>
              <mask id="hole">
                <rect width="100" height="100" fill="white" />
                <circle cx="50" cy="50" r="36" fill="black" />
              </mask>
            </defs>
            <rect width="100" height="100" fill="rgba(2,6,23,0.72)" mask="url(#hole)" />
            <circle cx="50" cy="50" r="36" fill="none" stroke={ring} strokeWidth="1.4" strokeDasharray={allPass || phase === "captured" ? "0" : "3 2"} />
          </svg>

          {phase === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl font-bold text-white drop-shadow-lg">{count}</span>
            </div>
          )}

          {(cameraStatus !== "READY" || phase === "loading" || phase === "error") && phase !== "captured" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 text-center">
              {cameraStatus === "DENIED" || cameraStatus === "ERROR" || cameraStatus === "UNSUPPORTED" ? (
                <CameraOff className="h-9 w-9 text-red-400" />
              ) : phase === "loading" || cameraStatus === "REQUESTING" ? (
                <Loader2 className="h-9 w-9 animate-spin text-blue-400" />
              ) : (
                <Camera className="h-9 w-9 text-slate-400" />
              )}
              <p className="text-sm text-slate-300">
                {phase === "error"
                  ? loadError ?? "Face check failed to load"
                  : cameraStatus === "DENIED"
                    ? "Camera access denied"
                    : cameraStatus === "READY"
                      ? "Loading face check…"
                      : "Camera is off"}
              </p>
              {cameraStatus !== "READY" && cameraStatus !== "REQUESTING" && (
                <Button size="sm" onClick={onRequestCamera}>
                  <Camera className="h-4 w-4" /> Enable camera
                </Button>
              )}
              {phase === "error" && (
                <Button size="sm" variant="secondary" onClick={() => { setLoadError(null); setPhase("idle"); }}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              )}
            </div>
          )}

          {/* Ear markers */}
          {live && (
            <>
              <EarTag side="left" ok={earSide.left} />
              <EarTag side="right" ok={earSide.right} />
            </>
          )}
        </div>

        <div
          className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
            phase === "captured"
              ? "bg-emerald-500/15 text-emerald-300"
              : bad
                ? "bg-red-500/15 text-red-300 border border-red-500/40"
                : allPass && live
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-slate-800 text-slate-300"
          }`}
        >
          {phase === "captured" ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : bad ? <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <ScanFace className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{phase === "captured" ? "Photo captured — check it and confirm" : message}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-emerald-400" /> Selfie requirements
        </p>
        <CheckRow ok={checks.single} icon={User} label="Only you in the frame" />
        <CheckRow ok={checks.face} icon={ScanFace} label="Full face inside the circle" />
        <CheckRow ok={checks.ears} icon={Ear} label="Both ears visible (none cut)" />
        <CheckRow ok={checks.eyes} icon={Eye} label="Both eyes open" />
        <CheckRow ok={checks.straight} icon={User} label="Head straight, looking at camera" />
        <CheckRow ok={checks.light} icon={Sun} label="Good lighting on face" />
        <CheckRow ok={checks.background} icon={ImageOff} label="Plain, clear background" />

        {phase === "captured" && (
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={retake} disabled={uploading}>
              <RefreshCw className="h-4 w-4" /> Retake
            </Button>
            <Button className="flex-1" disabled={uploading || !shot} onClick={() => shot && onConfirm(shot.blob)}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Use this photo
            </Button>
          </div>
        )}
        {live && <p className="text-xs text-slate-500 pt-1">The photo is taken automatically when every check is green. It is shown to your center and admin as your exam record.</p>}
      </div>
    </div>
  );
}

function EarTag({ side, ok }: { side: "left" | "right"; ok: boolean }) {
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-2" : "right-2"} flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
        ok ? "bg-emerald-500/90 text-white" : "bg-red-500 text-white animate-pulse"
      }`}
    >
      <Ear className="h-3 w-3" /> {side === "left" ? "L" : "R"}
    </div>
  );
}
