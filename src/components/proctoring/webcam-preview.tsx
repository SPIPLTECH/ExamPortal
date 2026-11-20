"use client";

import React from "react";
import { Camera, CameraOff, Radio } from "lucide-react";
import type { CameraStatus } from "@/hooks/useWebcamCapture";

/** Ported from ProctorGuard WebcamPreview. */
export function WebcamPreview({
  videoRef,
  cameraStatus,
  compact = false,
  showStatusBanner = true,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  compact?: boolean;
  showStatusBanner?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-md ${
        compact ? "w-44 h-32" : "w-full max-w-md aspect-video"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${cameraStatus !== "READY" ? "hidden" : ""}`}
      />
      {cameraStatus !== "READY" && (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-400 space-y-2">
          {cameraStatus === "DENIED" ? (
            <>
              <CameraOff className="w-8 h-8 text-red-400" />
              <p className="text-xs text-red-300 font-medium">Camera access denied</p>
            </>
          ) : cameraStatus === "REQUESTING" ? (
            <>
              <Camera className="w-8 h-8 text-blue-400 animate-pulse" />
              <p className="text-xs text-slate-300">Requesting permission…</p>
            </>
          ) : (
            <>
              <Camera className="w-8 h-8 text-slate-500" />
              <p className="text-xs text-slate-400">Camera offline</p>
            </>
          )}
        </div>
      )}
      {cameraStatus === "READY" && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>LIVE</span>
        </div>
      )}
      {showStatusBanner && cameraStatus === "READY" && (
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300 flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>Webcam monitored</span>
        </div>
      )}
    </div>
  );
}
