import { z } from "zod";
import { connectDB } from "@/lib/db";
import { MSCITEnquiry } from "@/models/MSCITEnquiry";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { MSCIT_ENQUIRY_STATUSES } from "@/lib/constants";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

const schema = z.object({
  status: z.enum(MSCIT_ENQUIRY_STATUSES).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  await connectDB();
  const enquiry = await MSCITEnquiry.findById(id);
  if (!enquiry) return fail("Enquiry not found", 404);

  if (parsed.data.status) enquiry.status = parsed.data.status;
  if (parsed.data.note) {
    enquiry.followUps.push({ note: parsed.data.note, by: session.user.id as never, at: new Date() });
  }
  await enquiry.save();

  await audit({
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: "ENQUIRY_UPDATED",
    entityType: "MSCITEnquiry",
    entityId: id,
    ip: clientIp(req),
  });

  return ok({ id, status: enquiry.status });
});
