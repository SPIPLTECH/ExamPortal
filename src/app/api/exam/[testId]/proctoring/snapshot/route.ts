import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ProctoringSession } from "@/models/ProctoringSession";
import { ProctoringEvidence } from "@/models/ProctoringEvidence";
import { requireStudentContext } from "@/lib/student";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { ok, fail, handleRoute } from "@/lib/api";

const MAX_BYTES = 3 * 1024 * 1024;
const VALID_TYPES = ["PRE_EXAM_IDENTITY", "PERIODIC_SNAPSHOT", "INCIDENT_SNAPSHOT"];

/**
 * Store a webcam frame as evidence (identity baseline or periodic/incident
 * snapshot). We only persist what we actually capture — no fabricated analysis.
 * If AI_SERVICE_URL is configured, face analysis could be attached here.
 */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  if (!env.cloudinary.configured) return fail("Evidence storage is not configured", 503);

  const form = await req.formData();
  const type = String(form.get("type") ?? "");
  const file = form.get("frame");
  if (!VALID_TYPES.includes(type)) return fail("Invalid snapshot type", 400);
  if (!file || !(file instanceof File)) return fail("No frame uploaded", 400);
  if (file.size > MAX_BYTES) return fail("Frame too large", 400);

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id }).select("status center");
  if (!attempt) return fail("No active attempt", 404);
  if (attempt.status !== "IN_PROGRESS") {
    return fail("Attempt already ended", 409, { code: "ATTEMPT_ENDED" });
  }

  const session = await ProctoringSession.findOne({ attempt: attempt._id });
  if (!session) return fail("No proctoring session", 404);

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadImage(buf, {
    folder: `exam-portal/proctoring/${attempt._id}`,
    mimeType: file.type || "image/jpeg",
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
    await session.save();
  }

  return ok({ status: "OK", category, url: type === "PRE_EXAM_IDENTITY" ? uploaded.url : undefined });
});
