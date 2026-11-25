import { connectDB } from "@/lib/db";
import { MSCITEnquiry } from "@/models/MSCITEnquiry";
import { requireAlcContext } from "@/lib/alc";
import { ok, handleRoute } from "@/lib/api";

/** MS-CIT enquiries (interested students) of this ALC center. */
export const GET = handleRoute(async () => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  await connectDB();
  const items = await MSCITEnquiry.find({ center: ctx.centerId }).sort({ createdAt: -1 }).limit(2000).lean();
  return ok({
    items: items.map((e) => ({
      _id: String(e._id),
      name: e.name,
      mobile: e.mobile ?? null,
      email: e.email ?? null,
      contact: e.contact,
      class: e.class,
      school: e.school,
      status: e.status,
      createdAt: e.createdAt,
    })),
  });
});
