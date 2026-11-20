import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { TestEnrollment } from "@/models/TestEnrollment";
import {
  requireStudentContext,
  eligibleTestFilter,
  enrollmentOpen,
} from "@/lib/student";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { PROCTORING_MODES } from "@/lib/constants";

const enrollSchema = z.object({
  proctoringChoice: z.enum(PROCTORING_MODES).nullable().optional(),
});

export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  const parsed = await parseBody(req, enrollSchema);
  if (parsed.error) return parsed.error;

  await connectDB();

  // Re-check eligibility server-side (never trust the client's list).
  const eligible = await Test.findOne({ _id: id, ...eligibleTestFilter(ctx.profile) });
  if (!eligible) return fail("You are not eligible to enroll in this test", 403);
  if (!enrollmentOpen(eligible)) return fail("Enrollment is closed for this test", 409);

  if (eligible.schedule?.capacity) {
    const count = await TestEnrollment.countDocuments({ test: id, status: "ENROLLED" });
    if (count >= eligible.schedule.capacity) return fail("This test is full", 409);
  }

  // For optional proctoring, record the student's locked-in choice.
  let proctoringChoice: string | null = null;
  if (eligible.proctoring.mode === "OPTIONAL") {
    proctoringChoice = parsed.data.proctoringChoice ?? "DISABLED";
  }

  try {
    await TestEnrollment.create({
      test: id,
      student: ctx.user.id,
      center: eligible.center,
      status: "ENROLLED",
      proctoringChoice,
    });
  } catch (e) {
    // Duplicate key → already enrolled.
    if ((e as { code?: number }).code === 11000) {
      return fail("You are already enrolled in this test", 409);
    }
    throw e;
  }

  await audit({
    actorId: ctx.user.id,
    actorRole: "STUDENT",
    action: "TEST_ENROLLED",
    entityType: "Test",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ enrolled: true }, 201);
});
