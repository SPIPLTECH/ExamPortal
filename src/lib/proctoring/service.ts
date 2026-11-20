/**
 * Client service for proctoring, adapted to this app's Next.js endpoints under
 * /api/exam/[testId]/proctoring/*. Call configureProctoring(testId) once before
 * use (the exam room does this on mount).
 */

export type PolicyResult = {
  currentWarnings: number;
  maxWarnings: number;
  isFlagged: boolean;
  warningIssued: boolean;
  message: string | null;
  terminated: boolean;
};
export type HeartbeatResult = {
  status: "ACTIVE" | "TERMINATED" | "COMPLETED";
  warningCount: number;
  latestWarningMessage: string | null;
};
export type SnapshotUploadResult = { status: string; category?: string; url?: string; policyResult?: PolicyResult };

let TEST_ID = "";
export function configureProctoring(testId: string) {
  TEST_ID = testId;
}
function base() {
  return `/api/exam/${TEST_ID}/proctoring`;
}

class ProctoringError extends Error {
  code?: string;
  statusCode?: number;
}

export async function sendConsent(): Promise<{ sessionId: string; warnings: number; maxWarnings: number; aiEnabled?: boolean }> {
  const res = await fetch(`${base()}/consent`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Consent failed");
  return json.data;
}

export async function sendProctoringEvent(input: {
  eventType: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isSimulated?: boolean;
  metadata?: Record<string, unknown>;
  clientTimestamp?: string;
}): Promise<{ policyResult?: PolicyResult }> {
  const res = await fetch(`${base()}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new ProctoringError(json.error || "Event failed");
    err.statusCode = res.status;
    throw err;
  }
  return json.data;
}

export async function sendProctoringHeartbeat(): Promise<HeartbeatResult> {
  const res = await fetch(`${base()}/heartbeat`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) {
    const err = new ProctoringError(json.error || "Heartbeat failed");
    err.statusCode = res.status;
    if (res.status === 404) err.code = "ATTEMPT_ENDED";
    throw err;
  }
  return json.data;
}

export async function uploadProctoringSnapshot(
  type: "PRE_EXAM_IDENTITY" | "PERIODIC_SNAPSHOT" | "INCIDENT_SNAPSHOT" | "AI_FRAME",
  blob: Blob,
  _simulationMode?: "NORMAL" | "NO_FACE" | "MULTIPLE_FACES",
  capturedAt?: string,
  reason?: string
): Promise<SnapshotUploadResult> {
  const fd = new FormData();
  if (reason) fd.set("reason", reason);
  fd.set("type", type);
  fd.set("frame", blob, "frame.jpg");
  if (capturedAt) fd.set("capturedAt", capturedAt);
  const res = await fetch(`${base()}/snapshot`, { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) {
    const err = new ProctoringError(json.error || "Snapshot failed");
    err.statusCode = res.status;
    if (json.code === "ATTEMPT_ENDED" || res.status === 409) err.code = "ATTEMPT_ENDED";
    throw err;
  }
  return json.data;
}
