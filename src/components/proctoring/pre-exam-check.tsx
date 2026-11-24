"use client";

import React, { useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Building2, Camera, ScanFace, ClipboardCheck, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SelfieCapture } from "./selfie-capture";
import type { CameraStatus } from "@/hooks/useWebcamCapture";

/**
 * Pre-exam gate for proctored exams: camera → live face-verified selfie → consent.
 * Start stays disabled until every step is done.
 */
export function PreExamCheck({
  testName,
  centerName,
  videoRef,
  cameraStatus,
  errorMessage,
  onRequestCamera,
  onSelfie,
  onStart,
}: {
  testName: string;
  centerName?: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  errorMessage: string | null;
  onRequestCamera: () => Promise<boolean>;
  onSelfie: (blob: Blob) => Promise<boolean>;
  onStart: () => Promise<void>;
}) {
  const [consent, setConsent] = useState(false);
  const [selfieDone, setSelfieDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const cameraReady = cameraStatus === "READY";

  const steps = [
    { label: "Camera", icon: Camera, done: cameraReady },
    { label: "Face selfie", icon: ScanFace, done: selfieDone },
    { label: "Consent", icon: ClipboardCheck, done: selfieDone && consent },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 text-slate-100">
      <div className="w-full max-w-4xl rounded-2xl bg-slate-900/90 border border-slate-700 shadow-2xl p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div className="mr-auto">
            <h1 className="text-xl font-bold leading-tight">Proctoring check</h1>
            <p className="text-slate-400 text-sm">“{testName}” is a proctored exam.</p>
          </div>
          {centerName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200">
              <Building2 className="h-4 w-4 text-purple-300" /> {centerName}
            </span>
          )}
        </div>

        <ol className="flex items-center gap-2 mb-6 text-xs sm:text-sm">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2 flex-1">
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 border ${s.done ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-slate-700 text-slate-400"}`}>
                {s.done ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />} {i + 1}. {s.label}
              </span>
              {i < steps.length - 1 && <span className="h-px flex-1 bg-slate-700" />}
            </li>
          ))}
        </ol>

        {selfieDone ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
            <p className="text-sm">Selfie verified and saved. This photo will be shown during your exam and kept in your record.</p>
          </div>
        ) : (
          <SelfieCapture
            videoRef={videoRef}
            cameraStatus={cameraStatus}
            onRequestCamera={onRequestCamera}
            uploading={uploading}
            onConfirm={async (blob) => {
              setUploading(true);
              const ok = await onSelfie(blob);
              setUploading(false);
              if (ok) setSelfieDone(true);
              return ok;
            }}
          />
        )}

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 text-red-300 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5" /> {errorMessage}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm mt-6">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} className="mt-0.5 border-slate-500" />
          <span className="text-slate-300">
            I consent to being monitored by my camera during this examination. Tab switching, leaving fullscreen,
            looking away, other people or phones are recorded and may end my exam.
          </span>
        </label>

        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            disabled={!(cameraReady || selfieDone) || !selfieDone || !consent || starting}
            onClick={async () => {
              setStarting(true);
              await onStart();
            }}
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Maximize className="h-4 w-4" />}
            Start exam in fullscreen
          </Button>
        </div>
      </div>
    </div>
  );
}
