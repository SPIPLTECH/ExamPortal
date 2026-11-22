/**
 * Seed script: creates the initial SUPER_ADMIN, an active Terms version, and
 * (optionally) a demo ALC center with a login. Safe to re-run — it upserts.
 *
 *   npm run seed
 *
 * Reads credentials from env (falls back to sensible defaults for first setup):
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectAndSyncIndexes } from "../src/lib/db";
import { User } from "../src/models/User";
import { ALCCenter } from "../src/models/ALCCenter";
import { TermsVersion } from "../src/models/TermsVersion";
import { seedExams } from "./seed-exams";

async function main() {
  await connectAndSyncIndexes();

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
  const adminName = process.env.SEED_ADMIN_NAME ?? "";

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $setOnInsert: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Super admin: ${adminEmail} (password: ${adminPassword})`);

  // Active terms
  const terms = await TermsVersion.findOne({ version: "v1" });
  if (!terms) {
    await TermsVersion.create({
      version: "v1",
      content:
        "By using this examination portal you agree to abide by all examination rules, " +
        "allow proctoring where required, and accept that violations may invalidate your attempt.",
      active: true,
      publishedAt: new Date(),
    });
    console.log("✓ Terms v1 created (active)");
  }

  // Soft Polynomials ALC center: Class 5–12 tests with all questions + images.
  // Skip with SEED_EXAMS=false.
  if (process.env.SEED_EXAMS !== "false") {
    await seedExams();
  }


  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
