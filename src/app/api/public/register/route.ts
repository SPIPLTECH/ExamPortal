import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { ALCCenter } from "@/models/ALCCenter";
import { MSCITEnquiry } from "@/models/MSCITEnquiry";
import { TermsVersion } from "@/models/TermsVersion";
import { studentRegisterSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { uploadImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { fail, ok, flattenZod, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

function toBool(v: FormDataEntryValue | null): boolean {
  return v === "true" || v === "on" || v === "1";
}

export const POST = handleRoute(async (req: Request) => {
  const form = await req.formData();

  const raw = {
    name: form.get("name"),
    email: form.get("email") || "",
    mobile: form.get("mobile") || "",
    class: form.get("class"),
    stream: form.get("stream") || null,
    schoolName: form.get("schoolName"),
    centerCode: form.get("centerCode") || "",
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
    acceptTerms: toBool(form.get("acceptTerms")),
    mscitCompleted: toBool(form.get("mscitCompleted")),
    mscitPercentage: form.get("mscitPercentage") ? Number(form.get("mscitPercentage")) : null,
    mscitInterested: toBool(form.get("mscitInterested")),
  };

  const parsed = studentRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Validation failed", 422, { issues: flattenZod(parsed.error) });
  }
  const d = parsed.data;

  await connectDB();

  const email = d.email && d.email !== "" ? d.email : null;
  const mobile = d.mobile && d.mobile !== "" ? d.mobile : null;

  // Duplicate prevention
  if (email && (await User.exists({ email }))) {
    return fail("An account with this email already exists", 409);
  }
  if (mobile && (await User.exists({ mobile }))) {
    return fail("An account with this mobile already exists", 409);
  }

  // Resolve center by code (optional). Invalid code is a soft error.
  let centerId: string | null = null;
  let centerStatus: "UNASSIGNED" | "PENDING" = "UNASSIGNED";
  const code = (d.centerCode || "").toString().trim().toUpperCase();
  if (code) {
    const center = await ALCCenter.findOne({ code, isActive: true });
    if (!center) return fail("Invalid center code", 400);
    centerId = center._id.toString();
    centerStatus = "PENDING"; // center must verify the student
  }

  // Optional profile photo → Cloudinary
  let image: { url: string; publicId: string } | null = null;
  const photo = form.get("photo");
  if (photo && photo instanceof File && photo.size > 0) {
    if (!env.cloudinary.configured) {
      return fail("Image uploads are not configured on the server", 503);
    }
    const buf = Buffer.from(await photo.arrayBuffer());
    image = await uploadImage(buf, {
      folder: "exam-portal/students",
      mimeType: photo.type,
    });
  }

  const activeTerms = await TermsVersion.findOne({ active: true }).sort({ publishedAt: -1 });

  const passwordHash = await hashPassword(d.password);
  const user = await User.create({
    name: d.name,
    email,
    mobile,
    passwordHash,
    role: "STUDENT",
    image,
  });

  await StudentProfile.create({
    user: user._id,
    class: d.class,
    stream: d.class >= 11 ? d.stream ?? null : null,
    schoolName: d.schoolName,
    center: centerId,
    centerStatus,
    mscit: {
      completed: !!d.mscitCompleted,
      percentage: d.mscitCompleted ? d.mscitPercentage ?? null : null,
      interested: !d.mscitCompleted && !!d.mscitInterested,
    },
    termsAcceptedAt: new Date(),
    termsVersion: activeTerms?.version ?? "v1",
  });

  // MS-CIT enquiry for interested, not-yet-completed students (classes 8-12).
  if (d.class >= 8 && !d.mscitCompleted && d.mscitInterested) {
    await MSCITEnquiry.create({
      student: user._id,
      name: d.name,
      contact: email || mobile || "",
      class: d.class,
      school: d.schoolName,
      interested: true,
      status: "NEW",
    });
  }

  await audit({
    actorId: user._id.toString(),
    actorRole: "STUDENT",
    action: "STUDENT_REGISTERED",
    entityType: "User",
    entityId: user._id.toString(),
    metadata: { class: d.class, center: centerId },
    ip: clientIp(req),
  });

  return ok({ id: user._id.toString(), message: "Account created successfully" }, 201);
});
