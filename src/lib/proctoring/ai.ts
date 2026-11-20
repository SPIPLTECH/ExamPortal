import { env } from "@/lib/env";

/** Client for the Python AI service (ProctorGuard proctor_ai) + server-side rules. */

export type AiAnalysis = {
  faces: {
    count: number;
    classification: "NO_FACE" | "ONE_FACE" | "MULTIPLE_FACES";
    items: { score: number; headPose?: { yawDeg: number; pitchDeg: number; reliable: boolean } | null }[];
  };
  objects: { status: string; items: { label: string; score: number }[] };
  identity: { status: string; embedding?: number[] | null };
};

export function aiEnabled(): boolean {
  return !!env.AI_SERVICE_URL && env.AI_SERVICE_TOKEN.length >= 16;
}

export async function analyzeFrame(buf: Buffer, mime: string, wantIdentity: boolean): Promise<AiAnalysis | null> {
  if (!aiEnabled()) return null;
  try {
    const url = `${env.AI_SERVICE_URL.replace(/\/$/, "")}/v1/analyze?identity=${wantIdentity}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_SERVICE_TOKEN}`,
        "Content-Type": mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg",
      },
      body: new Uint8Array(buf),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.error("[proctor-ai] service returned", res.status);
      return null;
    }
    return (await res.json()) as AiAnalysis;
  } catch (err) {
    console.error("[proctor-ai] unreachable", (err as Error).message);
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot; // features are L2-normalised
}

// ── Rules ────────────────────────────────────────────────
const YAW_LIMIT_DEG = 35;
const IDENTITY_MATCH = 0.363;
const COOLDOWN_MS = 25_000;

type Streaks = Record<string, number>;
export type AiEventType = "FACE_MISSING" | "MULTIPLE_FACES" | "PHONE_DETECTED" | "HEAD_POSE_AWAY" | "IDENTITY_MISMATCH";

/**
 * Consecutive-frame rules. Returns the violations to record and the new state.
 * A single noisy frame never warns (except an obvious phone / second face).
 */
export function evaluateFrame(
  prev: Streaks | null | undefined,
  a: AiAnalysis,
  baseline: number[] | undefined,
  now = Date.now()
): { events: { type: AiEventType; meta: Record<string, unknown> }[]; state: Streaks } {
  const s: Streaks = { noFace: 0, multiple: 0, phone: 0, away: 0, mismatch: 0, ...(prev ?? {}) };
  const events: { type: AiEventType; meta: Record<string, unknown> }[] = [];
  const fire = (type: AiEventType, key: string, meta: Record<string, unknown>) => {
    const last = s[`last_${type}`] ?? 0;
    if (now - last < COOLDOWN_MS) return;
    s[`last_${type}`] = now;
    s[key] = 0;
    events.push({ type, meta });
  };

  const faces = a.faces.count;
  const phones = a.objects.items.filter((o) => o.label === "cell phone");
  const topPhone = phones.reduce((m, o) => Math.max(m, o.score), 0);

  // No face
  if (faces === 0) {
    s.noFace += 1;
    if (s.noFace >= 2) fire("FACE_MISSING", "noFace", { frames: s.noFace });
  } else s.noFace = 0;

  // Another person
  if (faces > 1) {
    s.multiple += 1;
    if (s.multiple >= 1) fire("MULTIPLE_FACES", "multiple", { count: faces });
  } else s.multiple = 0;

  // Phone: one confident frame, or two weaker ones in a row
  if (topPhone > 0) {
    s.phone += 1;
    if (topPhone >= 0.5 || s.phone >= 2) fire("PHONE_DETECTED", "phone", { score: Number(topPhone.toFixed(2)) });
  } else s.phone = 0;

  // Looking away (only with one reliable face)
  const pose = a.faces.items[0]?.headPose;
  if (faces === 1 && pose?.reliable && Math.abs(pose.yawDeg) > YAW_LIMIT_DEG) {
    s.away += 1;
    if (s.away >= 2) fire("HEAD_POSE_AWAY", "away", { yawDeg: Math.round(pose.yawDeg) });
  } else s.away = 0;

  // Identity
  if (faces === 1 && baseline?.length && a.identity.status === "OK" && a.identity.embedding?.length) {
    const sim = cosine(baseline, a.identity.embedding);
    if (sim < IDENTITY_MATCH) {
      s.mismatch += 1;
      if (s.mismatch >= 2) fire("IDENTITY_MISMATCH", "mismatch", { similarity: Number(sim.toFixed(2)) });
    } else s.mismatch = 0;
  } else if (faces !== 1) s.mismatch = 0;

  return { events, state: s };
}
