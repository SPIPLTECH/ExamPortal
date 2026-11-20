"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  sendProctoringEvent,
  sendProctoringHeartbeat,
} from "@/lib/proctoring/service";
import { enterExamLock } from "@/lib/proctoring/examLock";

/** Focus must be away this long before it counts (permission prompts/OS toasts flicker focus). */
export const BLUR_GRACE_MS = 1500;

type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Props {
  isActive: boolean;
  trackClipboard?: boolean;
  onEnded?: () => void;
  initialWarnings?: number;
  initialMaxWarnings?: number;
}

/**
 * Browser monitoring ported from ProctorGuard: tab/visibility/focus/fullscreen
 * tracking, clipboard & screenshot blocking, heartbeat. The server decides
 * warnings & termination; this hook reports events and reacts to the decision.
 */
export function useBrowserMonitoring({
  isActive,
  trackClipboard = true,
  onEnded,
  initialWarnings = 0,
  initialMaxWarnings = 3,
}: Props) {
  const [warnings, setWarnings] = useState(initialWarnings);
  const [maxWarnings, setMaxWarnings] = useState(initialMaxWarnings);
  const [isFlagged, setIsFlagged] = useState(false);
  const [activeWarningMessage, setActiveWarningMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && Boolean(document.fullscreenElement)
  );
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const lastEventTimeRef = useRef<Record<string, number>>({});
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScreenshotRef = useRef(0);
  const warningsRef = useRef(initialWarnings);
  useEffect(() => {
    warningsRef.current = warnings;
  }, [warnings]);

  const wipeClipboard = useCallback(() => {
    navigator.clipboard?.writeText?.("").catch(() => {});
  }, []);

  const reportEvent = useCallback(
    async (eventType: string, severity: Severity, isSimulated = false, metadata?: Record<string, unknown>) => {
      if (!isActive) return;
      const now = Date.now();
      const last = lastEventTimeRef.current[eventType] || 0;
      if (!isSimulated && now - last < 800) return;
      lastEventTimeRef.current[eventType] = now;
      try {
        const res = await sendProctoringEvent({
          eventType,
          severity,
          isSimulated,
          metadata,
          clientTimestamp: new Date().toISOString(),
        });
        const p = res.policyResult;
        if (p) {
          setWarnings(p.currentWarnings);
          setMaxWarnings(p.maxWarnings);
          setIsFlagged(p.isFlagged);
          if (p.warningIssued && p.message) setActiveWarningMessage(p.message);
          if (p.terminated && onEnded) onEnded();
        }
      } catch (err) {
        console.error("[Proctoring] event failed", err);
      }
    },
    [isActive, onEnded]
  );

  // Heartbeat loop (also surfaces background warnings).
  useEffect(() => {
    if (!isActive) return;
    const ping = async () => {
      try {
        const res = await sendProctoringHeartbeat();
        if (res.status === "TERMINATED" || res.status === "COMPLETED") {
          onEnded?.();
          return;
        }
        if (res.warningCount > warningsRef.current) {
          setWarnings(res.warningCount);
          if (res.latestWarningMessage) setActiveWarningMessage(res.latestWarningMessage);
        }
      } catch (err) {
        if ((err as { code?: string }).code === "ATTEMPT_ENDED") onEnded?.();
      }
    };
    ping();
    heartbeatTimerRef.current = setInterval(ping, 10000);
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isActive, onEnded]);

  // Event listeners.
  useEffect(() => {
    if (!isActive) return;

    const onVisibility = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        wipeClipboard();
        reportEvent("TAB_HIDDEN", "MEDIUM", false, { reason: "Switched tab or minimized" });
      } else {
        setIsWindowFocused(true);
        reportEvent("TAB_VISIBLE", "INFO", false, { reason: "Returned to exam" });
      }
    };
    const onBlur = () => {
      setIsWindowFocused(false);
      wipeClipboard();
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      const leftAt = Date.now();
      blurTimerRef.current = setTimeout(() => {
        blurTimerRef.current = null;
        if (!document.hasFocus()) reportEvent("WINDOW_BLUR", "MEDIUM", false, { awayMs: Date.now() - leftAt });
      }, BLUR_GRACE_MS);
    };
    const onFocus = () => {
      setIsWindowFocused(true);
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };
    const onFullscreen = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      reportEvent(fs ? "FULLSCREEN_ENTER" : "FULLSCREEN_EXIT", fs ? "INFO" : "HIGH");
    };
    const blockClip = (e: ClipboardEvent) => {
      if (trackClipboard) {
        e.preventDefault();
        reportEvent(`${e.type.toUpperCase()}_ATTEMPT`, "LOW");
      }
    };
    const onContext = (e: MouseEvent) => {
      if (trackClipboard) {
        e.preventDefault();
        reportEvent("CONTEXT_MENU", "LOW");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const isPrintScreen = e.key === "PrintScreen" || e.code === "PrintScreen";
      const isPrint = (e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P");
      const isSnip = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S");
      const isDevtools = e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "I", "j", "J", "c", "C"].includes(e.key));
      if (isPrintScreen || isPrint || isSnip) {
        e.preventDefault();
        e.stopPropagation();
        wipeClipboard();
        const now = Date.now();
        if (now - lastScreenshotRef.current > 1000) {
          lastScreenshotRef.current = now;
          reportEvent("SCREENSHOT_ATTEMPT", "HIGH", false, { shortcut: isPrint ? "Ctrl+P" : isSnip ? "Win+Shift+S" : "PrintScreen" });
        }
      } else if (isDevtools) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", blockClip);
    document.addEventListener("paste", blockClip);
    document.addEventListener("cut", blockClip);
    document.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", blockClip);
      document.removeEventListener("paste", blockClip);
      document.removeEventListener("cut", blockClip);
      document.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, [isActive, trackClipboard, reportEvent, wipeClipboard]);

  const requestFullscreen = useCallback(async () => {
    const state = await enterExamLock();
    setIsFullscreen(state.fullscreen);
    return state;
  }, []);

  // Allow external monitors (camera object detection, voice) to push events
  // through the same warning/termination pipeline.
  const reportExternal = useCallback(
    (eventType: string, severity: Severity = "HIGH", metadata?: Record<string, unknown>) =>
      reportEvent(eventType, severity, false, metadata),
    [reportEvent]
  );

  return {
    reportExternal,
    warnings,
    maxWarnings,
    isFlagged,
    activeWarningMessage,
    clearWarningMessage: () => setActiveWarningMessage(null),
    isFullscreen,
    requestFullscreen,
    isWindowFocused,
    isOnline,
  };
}
