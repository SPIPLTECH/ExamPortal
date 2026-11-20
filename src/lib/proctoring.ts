import type { IProctoringSession } from "@/models/ProctoringSession";
import type { HydratedDocument } from "mongoose";

/**
 * Server-side proctoring policy. The browser monitor reports raw events; the
 * server alone decides warnings and termination (clients are never trusted).
 */

/** Event types that count as a violation (increment the warning counter). */
const VIOLATION_TYPES = new Set([
  "TAB_HIDDEN",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
  "SCREENSHOT_ATTEMPT",
  "SCREEN_SHARE_ATTEMPT",
  "FACE_MISSING",
  "MULTIPLE_FACES",
  "PHONE_DETECTED",
  "HEAD_POSE_AWAY",
  "IDENTITY_MISMATCH",
]);

/** Which session counter (if any) a raw event type bumps. */
const COUNTER_FOR: Record<string, keyof IProctoringSession["counters"]> = {
  TAB_HIDDEN: "tabSwitches",
  FULLSCREEN_EXIT: "fullscreenExits",
  WINDOW_BLUR: "visibilityHidden",
  FACE_MISSING: "faceMissing",
  MULTIPLE_FACES: "multipleFaces",
  PHONE_DETECTED: "multipleFaces",
  VOICE_DETECTED: "voiceFlags",
};

const HUMAN: Record<string, string> = {
  TAB_HIDDEN: "You switched away from the exam tab.",
  WINDOW_BLUR: "The exam window lost focus.",
  FULLSCREEN_EXIT: "You exited fullscreen mode.",
  SCREENSHOT_ATTEMPT: "A screenshot attempt was detected.",
  SCREEN_SHARE_ATTEMPT: "Screen sharing is not allowed during the exam.",
  FACE_MISSING: "Your face was not visible to the camera. Stay in view of the camera.",
  MULTIPLE_FACES: "Another person was detected in your camera view. Only you may be present during the exam.",
  PHONE_DETECTED: "A mobile phone or other prohibited object was detected. Put it away now.",
  HEAD_POSE_AWAY: "You were looking away from the screen. Face the camera while taking the exam.",
  IDENTITY_MISMATCH: "The person in front of the camera does not match your verified photo.",
};

export type PolicyResult = {
  currentWarnings: number;
  maxWarnings: number;
  isFlagged: boolean;
  warningIssued: boolean;
  message: string | null;
  terminated: boolean;
};

/**
 * Apply one event to a session in memory (caller saves). Returns the policy
 * decision to send back to the client. Does NOT finalize the attempt — the
 * route does that when `terminated` is true.
 */
export function applyPolicy(
  session: HydratedDocument<IProctoringSession>,
  eventType: string
): PolicyResult {
  const counterKey = COUNTER_FOR[eventType];
  if (counterKey) {
    session.counters[counterKey] = (session.counters[counterKey] ?? 0) + 1;
  }

  let warningIssued = false;
  let message: string | null = null;

  if (VIOLATION_TYPES.has(eventType)) {
    session.warnings = (session.warnings ?? 0) + 1;
    session.isFlagged = true;
    warningIssued = true;
    const reason = HUMAN[eventType] ?? "A proctoring violation was detected.";
    message = `Proctoring Warning (${session.warnings}/${session.maxWarnings}): ${reason}`;
    session.latestWarningMessage = message;
  }

  const terminated = session.warnings >= session.maxWarnings && warningIssued;
  if (terminated) {
    session.status = "TERMINATED";
    session.terminationReason = "Exceeded the allowed number of proctoring violations";
    session.endedAt = new Date();
    message = `You have exceeded the allowed number of violations (${session.maxWarnings}). Your exam has been submitted.`;
  }

  return {
    currentWarnings: session.warnings,
    maxWarnings: session.maxWarnings,
    isFlagged: session.isFlagged,
    warningIssued,
    message,
    terminated,
  };
}
