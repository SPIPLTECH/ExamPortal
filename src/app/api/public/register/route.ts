import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { School } from "@/models/School";
import { ALCCenter } from "@/models/ALCCenter";
import { Test, type ITest } from "@/models/Test";
import { TermsVersion } from "@/models/TermsVersion";
import { MSCITEnquiry } from "@/models/MSCITEnquiry";
import { studentRegisterSchema } from "@/lib/validations";
import { normalizeMobile, normalizeEmail } from "@/lib/contact";
import { hashPassword } from "@/lib/password";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { eligibleTestFilter, examLive } from "@/lib/student";
import { sendStudentCredentials } from "@/lib/emails";
import { emailConfigured } from "@/lib/mailer";
import { createEntryToken } from "@/lib/entry-token";
import { rateLimit } from "@/lib/rate-limit";
import { fail, ok, flattenZod, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import type { IStudentProfile } from "@/models/StudentProfile";

/**
 * Student self-registration. No OTP / verification: the student gives an email OR a
 * mobile number (either one is enough, both are fine), picks a School (which decides the
 * center) and sets a username + password. The MS-CIT percentage and the photo are optional.
 * Everything that can run in parallel does, and the credentials email is fire-and-forget,
 * so the response is as fast as the database allows.
 */
export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req) ?? "unknown";
  if (!rateLimit(`register:${ip}`, 30, 60_000)) {
    return fail("Too many attempts. Please wait a minute and try again.", 429);
  }

  const form = await req.formData();
  const mscitRaw = form.get("mscitCompleted");
  const raw = {
    name: form.get("name"),
    email: form.get("email") || "",
    mobile: form.get("mobile") || "",
    class: form.get("class"),
    stream: form.get("stream") || null,
    schoolId: form.get("schoolId"),
    username: form.get("username"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
    acceptTerms: form.get("acceptTerms") === "true",
    mscitCompleted: mscitRaw === null ? undefined : mscitRaw === "yes",
    mscitPercentage: form.get("mscitPercentage"),
    mscitInterested: form.get("mscitInterested") === "yes",
  };
  const parsed = studentRegisterSchema.safeParse(raw);
  if (!parsed.success) return fail("Validation failed", 422, { issues: flattenZod(parsed.error) });
  const d = parsed.data;

  const email = d.email ? normalizeEmail(d.email) : null;
  const mobile = d.mobile ? normalizeMobile(d.mobile) : null;
  const stream = d.class >= 11 ? d.stream ?? null : null;
  const mscitCompleted = !!d.mscitCompleted;
  const wantsMscit = !mscitCompleted && !!d.mscitInterested;

  // Optional photo: validate before touching the DB.
  const photoFile = form.get("photo");
  let photoBuf: Buffer | null = null;
  let photoType = "";
  if (photoFile instanceof File && photoFile.size > 0) {
    if (photoFile.size > 5 * 1024 * 1024) return fail("Photo must be under 5 MB", 422, { issues: { photo: "Photo must be under 5 MB" } });
    if (!["image/jpeg", "image/png", "image/webp"].includes(photoFile.type)) {
      return fail("Photo must be a JPG, PNG or WEBP image", 422, { issues: { photo: "Photo must be a JPG, PNG or WEBP image" } });
    }
    photoBuf = Buffer.from(await photoFile.arrayBuffer());
    photoType = photoFile.type;
  }

  await connectDB();

  // One round trip for everything we need to check / read.
  const contactOr = [...(email ? [{ email }] : []), ...(mobile ? [{ mobile }] : [])];
  const [school, usernameTaken, contactOwner, activeTerms] = await Promise.all([
    School.findOne({ _id: d.schoolId, isActive: true }).select("name center").lean(),
    User.exists({ username: d.username }),
    User.findOne({ $or: contactOr }).select("email mobile").lean(),
    TermsVersion.findOne({ active: true }).sort({ publishedAt: -1 }).select("version").lean(),
  ]);
  if (!school) return fail("Please select a valid school.", 400);
  if (usernameTaken) return fail("That username is already taken.", 409, { issues: { username: "That username is already taken." } });
  if (contactOwner) {
    const which = email && contactOwner.email === email ? "email address" : "mobile number";
    return fail(`An account already exists with this ${which}. Please log in instead.`, 409);
  }
  const center = await ALCCenter.findOne({ _id: school.center, isActive: true }).select("_id").lean();
  if (!center) return fail("This school's center is not active.", 400);

  // No exam published for this school's center (and class) → say so clearly, before anything is created.
  const tests = await Test.find({
    ...eligibleTestFilter({ center: center._id, class: d.class, stream } as unknown as IStudentProfile),
    status: { $ne: "COMPLETED" },
  })
    .sort({ createdAt: -1 })
    .select("schedule")
    .lean<ITest[]>();
  if (tests.length === 0) {
    return fail("No exams are available for this school right now. Please try again later.", 404);
  }

  // Password hash + (optional) photo upload run together.
  const [passwordHash, photo] = await Promise.all([
    hashPassword(d.password),
    photoBuf
      ? (env.cloudinary.configured
          ? uploadImage(photoBuf, { folder: "exam-portal/students", mimeType: photoType }).catch(() => null)
          : Promise.resolve({ url: `data:${photoType};base64,${photoBuf.toString("base64")}`, publicId: "inline" }))
      : Promise.resolve(null),
  ]);

  let user;
  try {
    user = await User.create({
      name: d.name,
      username: d.username,
      email,
      mobile,
      passwordHash,
      role: "STUDENT",
      image: photo,
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      return fail("An account already exists with these details. Please log in instead.", 409);
    }
    throw e;
  }

  const className = `Class ${d.class}${stream ? ` (${stream.charAt(0) + stream.slice(1).toLowerCase()})` : ""}`;

  // Profile, the MS-CIT enquiry (center + admin both read it) and the live-exam lookup together.
  await Promise.all([
    StudentProfile.create({
      user: user._id,
      class: d.class,
      stream,
      school: school._id,
      schoolName: school.name,
      photo,
      center: center._id,
      centerStatus: "VERIFIED",
      mscit: {
        completed: mscitCompleted,
        percentage: mscitCompleted ? d.mscitPercentage ?? null : null,
        interested: wantsMscit,
      },
      termsAcceptedAt: new Date(),
      termsVersion: activeTerms?.version ?? "v1",
    }),
    wantsMscit
      ? MSCITEnquiry.findOneAndUpdate(
          { student: user._id },
          {
            student: user._id,
            center: center._id,
            name: d.name,
            contact: mobile || email || "",
            mobile,
            email,
            class: d.class,
            school: school.name,
            interested: true,
          },
          { upsert: true, setDefaultsOnInsert: true }
        )
      : Promise.resolve(null),
  ]);
  const liveTest = tests.find((t) => examLive(t));

  // Fire-and-forget: never make the student wait for SMTP or the audit write.
  const willEmail = !!email && emailConfigured();
  if (willEmail) {
    void sendStudentCredentials({
      name: d.name, to: email!, username: d.username, password: d.password,
      loginUrl: `${env.APP_URL}/login`, className,
    }).catch((err) => console.error("[register] credentials email failed", err));
  }
  void audit({
    actorId: user._id.toString(), actorRole: "STUDENT", action: "STUDENT_REGISTERED",
    entityType: "User", entityId: user._id.toString(),
    metadata: { class: d.class, center: String(center._id), school: String(school._id) }, ip,
  });

  return ok({
    userId: user._id.toString(),
    token: createEntryToken(user._id.toString()),
    username: d.username,
    className,
    emailed: willEmail,
    testId: liveTest ? String(liveTest._id) : null,
  }, 201);
});
