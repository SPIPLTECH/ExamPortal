import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ProctoringSession } from "@/models/ProctoringSession";
import { ProctoringEvidence } from "@/models/ProctoringEvidence";
import { ProctoringEvent } from "@/models/ProctoringEvent";
import { requireStudentContext } from "@/lib/student";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { applyPolicy, type PolicyResult } from "@/lib/proctoring";
import { analyzeFrame, aiEnabled, evaluateFrame } from "@/lib/proctoring/ai";
import { finalizeAttempt } from "@/lib/exam-engine";
import { ok, fail, handleRoute } from "@/lib/api";

const MAX_BYTES = 3 * 1024 * 1024;
const VALID_TYPES = ["PRE_EXAM_IDENTITY", "PERIODIC_SNAPSHOT", "INCIDENT_SNAPSHOT", "AI_FRAME"];

/**
 * Webcam frames.
 *  - PRE_EXAM_IDENTITY: stored as the baseline (and its face feature when the AI service is on).
 *  - PERIODIC/INCIDENT_SNAPSHOT: stored as evidence.
 *  - AI_FRAME: analysed by the AI service (faces, head pose, phone, identity). Only stored
 *    when a violation is raised. Violations go through the same server policy as browser events.
 */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  const form = await req.formData();
  const type = String(form.get("type") ?? "");
  const file = form.get("frame");
  if (!VALID_TYPES.includes(type)) return fail("Invalid snapshot type", 400);
  if (!file || !(file instanceof File)) return fail("No frame uploaded", 400);
  if (file.size > MAX_BYTES) return fail("Frame too large", 400);
  if (type !== "AI_FRAME" && !env.cloudinary.configured) return fail("Evidence storage is not configured", 503);

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id }).select("status center");
  if (!attempt) return fail("No active attempt", 404);
  if (attempt.status !== "IN_PROGRESS") {
    return fail("Attempt already ended", 409, { code: "ATTEMPT_ENDED" });
  }

  const session = await ProctoringSession.findOne({ attempt: attempt._id }).select("+identityEmbedding");
  if (!session) return fail("No proctoring session", 404);
  if (session.status !== "ACTIVE") return fail("Attempt already ended", 409, { code: "ATTEMPT_ENDED" });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  // ── AI frame ───────────────────────────────────────────
  if (type === "AI_FRAME") {
    if (!aiEnabled()) return ok({ status: "AI_DISABLED" });
    const analysis = await analyzeFrame(buf, mime, !!session.identityEmbedding?.length);
    if (!analysis) return ok({ status: "AI_UNAVAILABLE" });

    const { events, state } = evaluateFrame(session.aiState, analysis, session.identityEmbedding);
    session.aiState = state;
    session.markModified("aiState");

    let policyResult: PolicyResult | undefined;
    for (const ev of events) {
      const r = applyPolicy(session, ev.type);
      policyResult = { ...r, message: r.message ?? policyResult?.message ?? null, warningIssued: true };
      await ProctoringEvent.create({
        session: session._id,
        attempt: attempt._id,
        type: ev.type,
        severity: "HIGH",
        metadata: { ...ev.meta, source: "ai-service" },
        serverTime: new Date(),
      }).catch(() => {});
      if (r.terminated) break;
    }

    if (events.length && env.cloudinary.configured) {
      try {
        const uploaded = await uploadImage(buf, { folder: `exam-portal/proctoring/${attempt._id}`, mimeType: mime });
        await ProctoringEvidence.create({
          session: session._id,
          attempt: attempt._id,
          category: "INCIDENT",
          cloudinary: uploaded,
          analysis: { events: events.map((e) => e.type), faces: analysis.faces.count },
          capturedAt: new Date(),
        });
      } catch {
        /* evidence is best-effort */
      }
    }

    await session.save();
    if (policyResult?.terminated) {
      attempt.terminationReason = "Proctoring: exceeded allowed violations";
      await finalizeAttempt(attempt, "TERMINATED");
    }
    return ok({ status: "OK", faces: analysis.faces.count, policyResult });
  }

  // ── Stored evidence ────────────────────────────────────
  if (type === "PRE_EXAM_IDENTITY" && aiEnabled()) {
    const analysis = await analyzeFrame(buf, mime, true);
    if (analysis) {
      if (analysis.faces.count !== 1) {
        return fail(
          analysis.faces.count === 0
            ? "No face detected. Face the camera in good light and try again."
            : "More than one face detected. Only you should be in view.",
          422
        );
      }
      if (analysis.identity.status === "OK" && analysis.identity.embedding?.length) {
        session.identityEmbedding = analysis.identity.embedding;
      }
    }
  }

  const uploaded = await uploadImage(buf, {
    folder: `exam-portal/proctoring/${attempt._id}`,
    mimeType: mime,
  });

  const category =
    type === "PRE_EXAM_IDENTITY" ? "IDENTITY" : type === "INCIDENT_SNAPSHOT" ? "INCIDENT" : "SNAPSHOT";

  await ProctoringEvidence.create({
    session: session._id,
    attempt: attempt._id,
    category,
    cloudinary: uploaded,
    capturedAt: new Date(),
  });

  if (type === "PRE_EXAM_IDENTITY") {
    session.identityBaseline = uploaded;
  }
  await session.save();

  return ok({ status: "OK", category, url: type === "PRE_EXAM_IDENTITY" ? uploaded.url : undefined });
});
