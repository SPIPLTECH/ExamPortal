"use client";

import React, { useState } from "react";
import { Camera, ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { WebcamPreview } from "./webcam-preview";
import type { CameraStatus } from "@/hooks/useWebcamCapture";

/**
 * Pre-exam readiness gate for proctored exams: camera permission + live preview,
 * identity capture and consent. Start is disabled until all mandatory checks pass.
 */
export function PreExamCheck({
  testName,
  videoRef,
  cameraStatus,
  errorMessage,
  onRequestCamera,
  onCaptureIdentity,
  onStart,
}: {
  testName: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  errorMessage: string | null;
  onRequestCamera: () => Promise<boolean>;
  onCaptureIdentity: () => Promise<boolean>;
  onStart: () => Promise<void>;
}) {
  const [consent, setConsent] = useState(false);
  const [identityDone, setIdentityDone] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [starting, setStarting] = useState(false);

  const cameraReady = cameraStatus === "READY";

  async function capture() {
    setCapturing(true);
    const ok = await onCaptureIdentity();
    setCapturing(false);
    setIdentityDone(ok);
  }

  const canStart = cameraReady && consent && identityDone;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900 text-slate-100">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-800 border border-slate-700 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <h1 className="text-xl font-bold">Proctoring check</h1>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          “{testName}” is a proctored exam. Complete these steps to begin.
        </p>

        <div className="grid sm:grid-cols-2 gap-6 items-start">
          <WebcamPreview videoRef={videoRef} cameraStatus={cameraStatus} showStatusBanner />
          <div className="space-y-3">
            <Step done={cameraReady} label="Camera access">
              {!cameraReady && (
                <Button size="sm" variant="secondary" onClick={onRequestCamera}>
                  <Camera className="h-4 w-4" /> Enable camera
                </Button>
              )}
            </Step>
            <Step done={identityDone} label="Capture identity photo">
              {cameraReady && !identityDone && (
                <Button size="sm" variant="secondary" onClick={capture} disabled={capturing}>
                  {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  Take photo
                </Button>
              )}
            </Step>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 text-red-300 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5" /> {errorMessage}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm mt-6">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} className="mt-0.5 border-slate-500" />
          <span className="text-slate-300">
            I consent to being monitored by my camera during this examination. I understand that tab
            switching, leaving fullscreen, and other violations are recorded and may end my exam.
          </span>
        </label>

        <div className="mt-6 flex justify-end">
          <Button
            disabled={!canStart || starting}
            onClick={async () => {
              setStarting(true);
              await onStart();
            }}
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Start exam in fullscreen
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ done, label, children }: { done: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`h-4 w-4 ${done ? "text-emerald-400" : "text-slate-600"}`} />
        <span className={`text-sm ${done ? "text-slate-200" : "text-slate-400"}`}>{label}</span>
      </div>
      {!done && <div className="mt-2">{children}</div>}
    </div>
  );
}
