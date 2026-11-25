"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Self-contained exam countdown.
 *
 *  - Lives in its own component, so the per-second update re-renders ONLY this badge,
 *    not the whole exam room (question, options, palette, proctoring overlays).
 *  - The remaining time is always recomputed from the server deadline (never counted down
 *    tick by tick), so a missed tick can never make the clock drift or "pause".
 *  - Ticks come from a Web Worker timer when available: browsers throttle/freeze
 *    main-thread timers in background tabs and while the page is busy (camera AI), but
 *    worker timers keep running. It also re-syncs instantly on tab focus / visibility.
 *  - Uses the smaller of the monotonic clock and the wall clock, so neither a laptop
 *    sleep nor a changed system clock can give the student extra time.
 */
function ExamTimerImpl({
  deadlineAt,
  serverNow,
  onExpire,
}: {
  deadlineAt: string;
  serverNow: string;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(deadlineAt).getTime() - new Date(serverNow).getTime()) / 1000))
  );
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    // Anchor once: how many ms were left at the moment the server answered.
    const remainingAtStart = new Date(deadlineAt).getTime() - new Date(serverNow).getTime();
    const perfStart = performance.now();
    const wallStart = Date.now();
    let lastShown = -1;
    let expiredFired = false;

    const update = () => {
      const byPerf = remainingAtStart - (performance.now() - perfStart);
      const byWall = remainingAtStart - (Date.now() - wallStart);
      const secs = Math.max(0, Math.ceil(Math.min(byPerf, byWall) / 1000));
      if (secs !== lastShown) {
        lastShown = secs;
        setLeft(secs);
      }
      if (secs <= 0 && !expiredFired) {
        expiredFired = true;
        onExpireRef.current();
      }
    };

    let worker: Worker | null = null;
    let url: string | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    try {
      const src = "let t=setInterval(()=>postMessage(0),250);onmessage=()=>clearInterval(t);";
      url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      worker = new Worker(url);
      worker.onmessage = update;
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        if (!fallback) fallback = setInterval(update, 250);
      };
    } catch {
      fallback = setInterval(update, 250);
    }

    const resync = () => update();
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);
    update();

    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("pageshow", resync);
      if (fallback) clearInterval(fallback);
      if (worker) {
        worker.postMessage("stop");
        worker.terminate();
      }
      if (url) URL.revokeObjectURL(url);
    };
  }, [deadlineAt, serverNow]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const low = left <= 60;
  return (
    <div
      role="timer"
      aria-live="off"
      className={`flex items-center gap-2 font-mono font-semibold px-3 py-1.5 rounded-lg tabular-nums ${
        low ? "bg-red-100 text-red-700 animate-pulse" : "bg-slate-100 text-slate-800"
      }`}
    >
      <Clock className="h-4 w-4" />
      {mm}:{ss}
    </div>
  );
}

export const ExamTimer = memo(ExamTimerImpl);
