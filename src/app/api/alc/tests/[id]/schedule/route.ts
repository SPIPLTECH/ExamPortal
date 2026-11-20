import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { requireAlcContext } from "@/lib/alc";
import { scheduleTestSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

/** Schedule/publish an APPROVED test (set window + eligibility). */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  const parsed = await parseBody(req, scheduleTestSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  const start = new Date(d.startTime);
  const end = new Date(d.endTime);
  if (end <= start) return fail("End time must be after start time", 422);

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);
  if (test.reviewStatus !== "APPROVED") {
    return fail("Only approved tests can be scheduled", 409);
  }

  test.schedule = {
    examDate: d.examDate ? new Date(d.examDate) : start,
    startTime: start,
    endTime: end,
    enrollmentDeadline: d.enrollmentDeadline ? new Date(d.enrollmentDeadline) : start,
    eligibleClasses: (d.eligibleClasses ?? []).length ? d.eligibleClasses! : [test.targetClass],
    eligibleStreams: (d.eligibleStreams ?? []).length
      ? d.eligibleStreams!
      : test.targetStream
        ? [test.targetStream]
        : [],
    capacity: d.capacity ?? null,
  };
  test.assignedCenters = (d.assignedCenters ?? []).length
    ? (d.assignedCenters as unknown as typeof test.assignedCenters)
    : [];
  test.status = "SCHEDULED";
  await test.save();

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_SCHEDULED",
    entityType: "Test",
    entityId: id,
    metadata: { start: start.toISOString(), end: end.toISOString() },
    ip: clientIp(req),
  });

  return ok({ id, status: "SCHEDULED" });
});
