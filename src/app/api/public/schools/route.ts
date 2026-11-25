import { connectDB } from "@/lib/db";
import { School } from "@/models/School";
import { ALCCenter } from "@/models/ALCCenter";
import { ok, handleRoute } from "@/lib/api";

// Every visitor of the home page loads this list: keep it in memory for a few seconds.
let cached: { at: number; items: { id: string; name: string }[] } | null = null;
const TTL_MS = 15_000;

/** Public list of active schools (from active centers) for the registration dropdown. */
export const GET = handleRoute(async () => {
  if (cached && Date.now() - cached.at < TTL_MS) return ok({ items: cached.items });
  await connectDB();
  const activeCenters = await ALCCenter.find({ isActive: true }, { _id: 1 }).lean();
  const schools = await School.find({ isActive: true, center: { $in: activeCenters.map((c) => c._id) } })
    .select("name")
    .sort({ name: 1 })
    .lean();
  const items = schools.map((s) => ({ id: String(s._id), name: s.name }));
  cached = { at: Date.now(), items };
  return ok({ items });
});
