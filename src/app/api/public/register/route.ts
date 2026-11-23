import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { School } from "@/models/School";
import { ALCCenter } from "@/models/ALCCenter";
import { Test, type ITest } from "@/models/Test";
import { TermsVersion } from "@/models/TermsVersion";
import { MSCITEnquiry } from "@/models/MSCITEnquiry";
import { ContactVerification } from "@/models/ContactVerification";
import { studentRegisterSchema } from "@/lib/validations";
import { normalizeMobile, normalizeEmail, isValidMobile, isValidEmail } from "@/lib/contact";
import { verifyProof } from "@/lib/verification-proof";
import { hashPassword } from "@/lib/password";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { eligibleTestFilter, examLive } from "@/lib/student";
import { sendStudentCredentials } from "@/lib/emails";
import { rateLimit } from "@/lib/rate-limit";
import { fail, ok, flattenZod, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import type { IStudentProfile } from "@/models/StudentProfile";

/**
 * Student self-registration: the student picks a School (which determines the
 * center), sets their own username/password, verifies one contact by OTP, and
 * gets an account. Credentials are emailed instantly. The client then offers
 * "start now" (sign in + open the exam) or "later".
 */
export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req) ?? "unknown";
  if (!rateLimit(`register:${ip}`, 20, 60_000)) {
    return fail("Too many attempts. Please wait a minute and try again.", 429);
  }

  const form = await req.formData();
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
    mscitCompleted: form.get("mscitCompleted") === null ? undefined : form.get("mscitCompleted") === "yes",
    mscitPercentage: form.get("mscitPercentage") ? Number(form.get("mscitPercentage")) : null,
    mscitInterested: form.get("mscitInterested") === "yes",
  };
  const parsed = studentRegisterSchema.safeParse(raw);
  if (!parsed.success) return fail("Validation failed", 422, { issues: flattenZod(parsed.error) });
  const d = parsed.data;

  let email = d.email ? normalizeEmail(d.email) : null;
  let mobile = d.mobile ? normalizeMobile(d.mobile) : null;
  const stream = d.class >= 11 ? d.stream ?? null : null;

  await connectDB();

  // 1) Verify the one mandatory contact (OTP proof + verification record).
  const vType = String(form.get("verifiedType") ?? "") === "EMAIL" ? "EMAIL" : "MOBILE";
  const proof = String(form.get("verifyProof") ?? "");
  const vContact = vType === "EMAIL" ? email : mobile;
  const vValid = vType === "EMAIL" ? !!email && isValidEmail(email) : !!mobile && isValidMobile(mobile);
  if (!vContact || !vValid || !verifyProof(vType, vContact, proof) ||
      !(await ContactVerification.exists({ type: vType, contact: vContact, verifiedAt: { $ne: null } }))) {
    return fail("Please verify your mobile number or email address first.", 403);
  }

  // 2) School → center
  const school = await School.findOne({ _id: d.schoolId, isActive: true });
  if (!school) return fail("Please select a valid school.", 400);
  const center = await ALCCenter.findOne({ _id: school.center, isActive: true });
  if (!center) return fail("This school's center is not active.", 400);

  // 3) Uniqueness: username and the verified contact must be free.
  if (await User.exists({ username: d.username })) {
    return fail("That username is already taken.", 409, { issues: { username: "That username is already taken." } });
  }
  if (await User.exists(vType === "EMAIL" ? { email } : { mobile })) {
    return fail("An account already exists for this contact. Please log in instead.", 409);
  }
  // Keep the unverified alternate only if nobody else owns it.
  if (email && vType !== "EMAIL" && (await User.exists({ email }))) email = null;
  if (mobile && vType !== "MOBILE" && (await User.exists({ mobile }))) mobile = null;

  // 4) Photo (required) → Cloudinary (or inline fallback in dev).
  const photoFile = form.get("photo");
  let photo: { url: string; publicId: string } | null = null;
  if (photoFile && photoFile instanceof File && photoFile.size > 0) {
    if (photoFile.size > 5 * 1024 * 1024) return fail("Photo must be under 5 MB", 422);
    if (!["image/jpeg", "image/png", "image/webp"].includes(photoFile.type)) return fail("Photo must be a JPG, PNG or WEBP image", 422);
    const buf = Buffer.from(await photoFile.arrayBuffer());
    photo = env.cloudinary.configured
      ? await uploadImage(buf, { folder: "exam-portal/students", mimeType: photoFile.type })
      : { url: `data:${photoFile.type};base64,${buf.toString("base64")}`, publicId: "inline" };
  }
  if (!photo) return fail("Please upload your photo.", 422, { issues: { photo: "Please upload your photo." } });

  // 5) Create the account.
  const activeTerms = await TermsVersion.findOne({ active: true }).sort({ publishedAt: -1 });
  const user = await User.create({
    name: d.name,
    username: d.username,
    email,
    mobile,
    passwordHash: await hashPassword(d.password),
    role: "STUDENT",
    image: photo,
  });

  await StudentProfile.create({
    user: user._id,
    class: d.class,
    stream,
    school: school._id,
    schoolName: school.name,
    photo,
    center: center._id,
    centerStatus: "VERIFIED",
    mscit: {
      completed: !!d.mscitCompleted,
      percentage: d.mscitCompleted ? d.mscitPercentage ?? null : null,
      interested: d.class >= 8 && !d.mscitCompleted && !!d.mscitInterested,
    },
    termsAcceptedAt: new Date(),
    termsVersion: activeTerms?.version ?? "v1",
  });

  if (d.class >= 8 && !d.mscitCompleted && d.mscitInterested) {
    await MSCITEnquiry.findOneAndUpdate(
      { student: user._id },
      { student: user._id, center: center._id, name: d.name, contact: mobile || email || "", mobile, email, class: d.class, school: school.name, interested: true },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  // 6) Email the credentials (best-effort).
  const className = `Class ${d.class}${stream ? ` (${stream.charAt(0) + stream.slice(1).toLowerCase()})` : ""}`;
  const emailed = email
    ? await sendStudentCredentials({ name: d.name, to: email, username: d.username, password: d.password, loginUrl: `${env.APP_URL}/login`, className }).catch(() => false)
    : false;

  // 7) Is there a live exam the student can start right now?
  const tests = await Test.find({
    ...eligibleTestFilter({ center: center._id, class: d.class, stream } as unknown as IStudentProfile),
    status: { $ne: "COMPLETED" },
  }).sort({ createdAt: -1 }).lean<ITest[]>();
  const liveTest = tests.find((t) => examLive(t));

  await audit({
    actorId: user._id.toString(), actorRole: "STUDENT", action: "STUDENT_REGISTERED",
    entityType: "User", entityId: user._id.toString(),
    metadata: { class: d.class, center: String(center._id), school: String(school._id) }, ip,
  });

  return ok({
    userId: user._id.toString(),
    username: d.username,
    className,
    emailed,
    testId: liveTest ? String(liveTest._id) : null,
  }, 201);
});
