"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const GRACE_SECONDS = 15;

/**
 * Blocks the whole exam while the student is not in fullscreen. If they do not
 * return within GRACE_SECONDS the exam is terminated (onTimeout).
 */
export function FullscreenGate({
  warnings,
  maxWarnings,
  onReturn,
  onTimeout,
}: {
  warnings: number;
  maxWarnings: number;
  onReturn: () => Promise<unknown>;
  onTimeout: () => void;
}) {
  const [left, setLeft] = useState(GRACE_SECONDS);
  const firedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0 && !firedRef.current) {
      firedRef.current = true;
      onTimeout();
    }
  }, [left, onTimeout]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-red-600/20 flex items-center justify-center">
          <ShieldAlert className="h-9 w-9 text-red-400 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold">Fullscreen mode is mandatory</h1>
        <p className="text-slate-300 leading-relaxed">
          You exited fullscreen. <b>Your exam will be terminated</b> if you do not return to fullscreen.
          You cannot take this exam outside fullscreen mode.
        </p>
        <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-sm text-red-200">
          Violation {Math.min(warnings, maxWarnings)} of {maxWarnings} recorded. Reaching {maxWarnings} ends your exam automatically.
        </div>
        <div className="text-4xl font-mono font-bold text-amber-300">{left}s</div>
        <p className="text-xs text-slate-400">Time left to return before the exam is terminated.</p>
        <Button size="lg" className="w-full" onClick={() => void onReturn()}>
          <Maximize className="h-5 w-5" /> Return to fullscreen
        </Button>
      </div>
    </div>
  );
}
