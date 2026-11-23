import { connectDB } from "@/lib/db";
import { School } from "@/models/School";
import { ALCCenter } from "@/models/ALCCenter";
import { ok, handleRoute } from "@/lib/api";

/** Public list of active schools (from active centers) for the registration dropdown. */
export const GET = handleRoute(async () => {
  await connectDB();
  const activeCenters = await ALCCenter.find({ isActive: true }, { _id: 1 }).lean();
  const centerIds = activeCenters.map((c) => c._id);
  const schools = await School.find({ isActive: true, center: { $in: centerIds } })
    .sort({ name: 1 })
    .lean();

  return ok({
    items: schools.map((s) => ({ id: String(s._id), name: s.name })),
  });
});
