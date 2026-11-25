import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { ALCCenter } from "@/models/ALCCenter";
import { Test, type ITest } from "@/models/Test";
import { TestEnrollment } from "@/models/TestEnrollment";
import { ExamAttempt } from "@/models/ExamAttempt";
import { TermsVersion } from "@/models/TermsVersion";
import { examEntrySchema } from "@/lib/validations";
import { MSCITEnquiry } from "@/models/MSCITEnquiry";
import { normalizeMobile, normalizeEmail } from "@/lib/contact";
import { hashPassword } from "@/lib/password";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { normalizeExamCode } from "@/lib/exam-code";
import { createEntryToken } from "@/lib/entry-token";
import { eligibleTestFilter, examLive } from "@/lib/student";
import { rateLimit } from "@/lib/rate-limit";
import { fail, ok, flattenZod, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import type { IStudentProfile } from "@/models/StudentProfile";

/**
 * Single public endpoint for the whole student journey: validates the exam
 * code, finds the live test for the student's class, creates (or reuses) the
 * student record + enrollment, and returns a one-time token that the browser
 * exchanges for a session before opening the exam. No passwords, no accounts.
 */
export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req) ?? "unknown";
  if (!rateLimit(`enter:${ip}`, 20, 60_000)) {
    return fail("Too many attempts. Please wait a minute and try again.", 429);
  }

  const form = await req.formData();
  const raw = {
    name: form.get("name"),
    email: form.get("email") || "",
    mobile: form.get("mobile") || "",
    class: form.get("class"),
    stream: form.get("stream") || null,
    schoolName: form.get("schoolName"),
    examCode: form.get("examCode"),
    acceptTerms: form.get("acceptTerms") === "true",
    mscitCompleted: form.get("mscitCompleted") === null ? undefined : form.get("mscitCompleted") === "yes",
    mscitPercentage: form.get("mscitPercentage"),
    mscitInterested: form.get("mscitInterested") === "yes",
  };
  const parsed = examEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Validation failed", 422, { issues: flattenZod(parsed.error) });
  }
  const d = parsed.data;
  const email = d.email ? normalizeEmail(d.email) : null;
  const mobile = d.mobile ? normalizeMobile(d.mobile) : null;
  const stream = d.class >= 11 ? d.stream ?? null : null;

  await connectDB();

  // 1) Exam code → center
  const center = await ALCCenter.findOne({ code: normalizeExamCode(d.examCode), isActive: true });
  if (!center) return fail("Invalid exam code. Please check the code given by your center.", 400);

  // 2) Published test of that center for the chosen class
  const tests = await Test.find({
    ...eligibleTestFilter({ center: center._id, class: d.class, stream } as unknown as IStudentProfile),
    status: { $ne: "COMPLETED" },
  })
    .sort({ createdAt: -1 })
    .lean<ITest[]>();
  if (tests.length === 0) {
    return fail(`No exam is published for Class ${d.class} at this center yet.`, 404);
  }

  // 3) Find existing student (same email / mobile) or create one. No verification needed.
  const contactOr = [...(email ? [{ email }] : []), ...(mobile ? [{ mobile }] : [])];
  let user = await User.findOne({ $or: contactOr });
  if (user && user.role !== "STUDENT") {
    return fail("This contact is already registered with another account type.", 409);
  }

  // Resume / duplicate handling for a student who already has an attempt.
  let test: ITest | undefined;
  if (user) {
    const existing = await ExamAttempt.findOne({
      student: user._id,
      test: { $in: tests.map((t) => t._id) },
    });
    if (existing) {
      if (existing.status !== "IN_PROGRESS") {
        return fail("You have already attempted this exam. Retakes are not allowed.", 409);
      }
      const sameName = user.name.trim().toLowerCase() === d.name.trim().toLowerCase();
      if (!sameName) {
        return fail("An exam is already in progress with this contact under a different name.", 409);
      }
      test = tests.find((t) => String(t._id) === String(existing.test));
    }
  }
  if (!test) {
    test = tests.find((t) => examLive(t));
    if (!test) {
      const upcoming = tests.find((t) => t.schedule?.startTime && new Date() < new Date(t.schedule.startTime));
      return fail(
        upcoming
          ? `Your exam opens on ${new Date(upcoming.schedule.startTime!).toLocaleString("en-IN")}.`
          : "The exam window has closed.",
        403
      );
    }
  }

  // OPTIONAL proctoring: the student must pick before we create anything.
  const choiceRaw = String(form.get("proctoringChoice") ?? "");
  const choice = choiceRaw === "MANDATORY" || choiceRaw === "DISABLED" ? choiceRaw : null;
  const hasAttempt = user ? !!(await ExamAttempt.exists({ student: user._id, test: test._id })) : false;
  if (test.proctoring?.mode === "OPTIONAL" && !choice && !hasAttempt) {
    return ok({ needsChoice: true, testName: test.name });
  }

  // Registration photo (optional) → Cloudinary, or inline fallback.
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

  const activeTerms = await TermsVersion.findOne({ active: true }).sort({ publishedAt: -1 });

  if (!user) {
    user = await User.create({
      name: d.name,
      email,
      mobile,
      // Nobody can log in with this: students enter only through the exam-entry token.
      passwordHash: await hashPassword(randomUUID() + randomUUID()),
      role: "STUDENT",
      image: photo, // replaced by the live selfie when the exam starts
    });
  } else {
    let dirty = false;
    if (!user.image && photo) { user.image = photo; dirty = true; }
    // Fill in a contact the account does not have yet (only if nobody else owns it).
    if (!user.email && email && !(await User.exists({ email }))) { user.email = email; dirty = true; }
    if (!user.mobile && mobile && !(await User.exists({ mobile }))) { user.mobile = mobile; dirty = true; }
    if (dirty) await user.save();
  }

  await StudentProfile.findOneAndUpdate(
    { user: user._id },
    {
      user: user._id,
      class: d.class,
      stream,
      schoolName: d.schoolName,
      ...(photo ? { photo } : {}),
      mscit: {
        completed: !!d.mscitCompleted,
        percentage: d.mscitCompleted ? d.mscitPercentage ?? null : null,
        interested: !d.mscitCompleted && !!d.mscitInterested,
      },
      center: center._id,
      centerStatus: "VERIFIED", // valid exam code == issued by this center
      termsAcceptedAt: new Date(),
      termsVersion: activeTerms?.version ?? "v1",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // MS-CIT interest → enquiry visible to this ALC center AND the admin (course advisor calls back).
  if (!d.mscitCompleted && d.mscitInterested) {
    await MSCITEnquiry.findOneAndUpdate(
      { student: user._id },
      {
        student: user._id,
        center: center._id,
        name: d.name,
        contact: mobile || email || "",
        mobile,
        email,
        class: d.class,
        school: d.schoolName,
        interested: true,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  await TestEnrollment.findOneAndUpdate(
    { test: test._id, student: user._id },
    {
      test: test._id,
      student: user._id,
      center: center._id,
      status: "ENROLLED",
      ...(test.proctoring?.mode === "OPTIONAL" && choice ? { proctoringChoice: choice } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await audit({
    actorId: user._id.toString(),
    actorRole: "STUDENT",
    action: "STUDENT_ENTERED_EXAM",
    entityType: "Test",
    entityId: String(test._id),
    metadata: { class: d.class, center: String(center._id) },
    ip,
  });

  return ok({
    userId: user._id.toString(),
    token: createEntryToken(user._id.toString()),
    testId: String(test._id),
  });
});