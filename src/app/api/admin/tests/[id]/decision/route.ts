import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { reviewDecisionSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

const DECISION_TO_STATUS = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;

export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  const parsed = await parseBody(req, reviewDecisionSchema);
  if (parsed.error) return parsed.error;
  const { decision, reason } = parsed.data;

  await connectDB();
  const test = await Test.findById(id);
  if (!test) return fail("Test not found", 404);
  if (test.reviewStatus !== "SUBMITTED") {
    return fail(`Only submitted tests can be reviewed (this one is ${test.reviewStatus})`, 409);
  }

  test.reviewStatus = DECISION_TO_STATUS[decision];
  test.reviewedBy = session.user.id as unknown as typeof test.reviewedBy;
  test.reviewedAt = new Date();
  test.rejectionReason = decision === "APPROVED" ? null : reason ?? null;
  await test.save();

  // Notify the ALC center login(s) for this center.
  const centerUsers = await User.find({ center: test.center, role: "ALC_CENTER" }).select("_id");
  const verb =
    decision === "APPROVED" ? "approved" : decision === "REJECTED" ? "rejected" : "sent back for changes";
  await Notification.insertMany(
    centerUsers.map((u) => ({
      user: u._id,
      type: decision === "APPROVED" ? "SUCCESS" : "WARNING",
      title: `Test "${test.name}" ${verb}`,
      body: decision === "APPROVED" ? "You can now schedule this test." : reason ?? undefined,
      link: "/alc/tests",
    }))
  );

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: `TEST_${decision}`,
    entityType: "Test",
    entityId: id,
    metadata: { reason: reason ?? null },
    ip: clientIp(req),
  });

  return ok({ id, reviewStatus: test.reviewStatus });
});
