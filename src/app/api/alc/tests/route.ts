import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { testSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";


async function centerAllowsProctoring(centerId: string) {
  const { ALCCenter } = await import("@/models/ALCCenter");
  const c = await ALCCenter.findById(centerId).select("proctoringEnabled").lean();
  return c?.proctoringEnabled !== false;
}

export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get("reviewStatus");
  const filter: Record<string, unknown> = { center: ctx.centerId };
  if (status) filter.reviewStatus = status;

  await connectDB();
  const items = await Test.find(filter).sort({ createdAt: -1 }).lean();
  return ok({ items });
});

export const POST = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const parsed = await parseBody(req, testSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  if (!(await centerAllowsProctoring(ctx.centerId))) d.proctoring = { ...d.proctoring, mode: "DISABLED" };
  const test = await Test.create({
    ...d,
    targetStream: d.targetClass >= 11 ? d.targetStream ?? null : null,
    center: ctx.centerId,
    createdBy: ctx.user.id,
    reviewStatus: "DRAFT",
    status: "UNPUBLISHED",
  });

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_CREATED",
    entityType: "Test",
    entityId: test._id.toString(),
    ip: clientIp(req),
  });

  return ok({ id: test._id.toString() }, 201);
});
