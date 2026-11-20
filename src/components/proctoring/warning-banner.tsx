"use client";

import { AlertTriangle, X, ShieldAlert } from "lucide-react";

/** Ported from ProctorGuard WarningBanner. */
export function WarningBanner({
  message,
  warningCount,
  maxWarnings,
  onDismiss,
}: {
  message: string;
  warningCount: number;
  maxWarnings: number;
  onDismiss: () => void;
}) {
  const critical = warningCount >= maxWarnings;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
      <div
        className={`rounded-xl p-4 shadow-xl border flex items-start gap-3 text-sm ${
          critical ? "bg-red-50 border-red-300 text-red-900" : "bg-amber-50 border-amber-300 text-amber-900"
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {critical ? (
            <ShieldAlert className="w-5 h-5 text-red-600 animate-pulse" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 font-bold mb-1">
            <span>{critical ? "CRITICAL PROCTORING ALERT" : "PROCTORING WARNING"}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${critical ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"}`}>
              Violation {warningCount} of {maxWarnings}
            </span>
          </div>
          <p className="text-xs leading-relaxed">{message}</p>
        </div>
        <button onClick={onDismiss} className="shrink-0 text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
