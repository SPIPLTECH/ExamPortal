import { z } from "zod";
import {
  CATEGORIES,
  DIFFICULTIES,
  OPTION_KEYS,
  PROCTORING_MODES,
  STREAMS,
  STUDENT_CLASSES,
} from "./constants";

// ─── Primitives ──────────────────────────────────────────────────────
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid ID format");

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .trim()
  .toLowerCase()
  .max(255);

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s]{7,20}$/, "Invalid mobile number");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be under 100 characters")
  .regex(/^[a-zA-Z\s'.-]+$/, "Name contains invalid characters");

// ─── Auth ────────────────────────────────────────────────────────────
/** Login accepts an email OR a mobile number in a single identifier field. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or mobile").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

// ─── Student registration (class-aware) ──────────────────────────────
export const studentRegisterSchema = z
  .object({
    name: nameSchema,
    email: emailSchema.optional().or(z.literal("")),
    mobile: mobileSchema.optional().or(z.literal("")),
    class: z.coerce.number().int().refine((c) => (STUDENT_CLASSES as readonly number[]).includes(c), {
      message: "Select a valid class (5-12)",
    }),
    stream: z.enum(STREAMS).optional().nullable(),
    schoolName: z.string().trim().min(2, "School name is required").max(200),
    centerCode: z.string().trim().min(1, "Please select your ALC center").max(32),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the Terms and Conditions" }),
    }),
    // MS-CIT workflow (classes 8-12)
    mscitCompleted: z.boolean().optional(),
    mscitPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
    mscitInterested: z.boolean().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((d) => (d.email && d.email !== "") || (d.mobile && d.mobile !== ""), {
    message: "Provide an email or a mobile number",
    path: ["email"],
  })
  .refine((d) => d.class < 11 || !!d.stream, {
    message: "Stream is required for classes 11 and 12",
    path: ["stream"],
  });

// ─── ALC Center ──────────────────────────────────────────────────────
export const createCenterSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/, "Code: letters, numbers, - or _ only"),
  email: emailSchema.optional().or(z.literal("")),
  phone: mobileSchema.optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  // Credentials for the center's login account:
  adminName: z.string().trim().min(2).max(100),
  adminEmail: emailSchema,
  adminPassword: passwordSchema,
});

export const updateCenterSchema = createCenterSchema
  .partial()
  .omit({ adminPassword: true });

// ─── Question ────────────────────────────────────────────────────────
export const questionSchema = z.object({
  text: z.string().trim().min(5, "Question too short").max(5000),
  options: z
    .array(
      z.object({
        key: z.enum(OPTION_KEYS),
        text: z.string().trim().min(1, "Option text required").max(1000),
        imageUrl: z.string().url().max(2000).optional().nullable(),
      })
    )
    .min(2, "At least 2 options")
    .max(OPTION_KEYS.length),
  correctOption: z.enum(OPTION_KEYS),
  difficulty: z.enum(DIFFICULTIES).default("MEDIUM"),
  class: z.coerce.number().int().min(5).max(12),
  classGroup: z.string().trim().max(100).optional().nullable(),
  category: z.enum(CATEGORIES),
  stream: z.enum(STREAMS).optional().nullable(),
  explanation: z.string().trim().max(5000).optional().nullable(),
  imageUrl: z.string().url().max(2000).optional().nullable(),
}).refine((q) => q.options.some((o) => o.key === q.correctOption), {
  message: "Correct option must be one of the provided options",
  path: ["correctOption"],
});

// ─── Test ────────────────────────────────────────────────────────────
export const categoryRuleSchema = z.object({
  category: z.enum(CATEGORIES),
  min: z.coerce.number().int().min(0).max(200),
  max: z.coerce.number().int().min(0).max(200),
});

export const testSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    instructions: z.string().trim().max(5000).optional().nullable(),
    rules: z.string().trim().max(5000).optional().nullable(),
    specialConditions: z.string().trim().max(2000).optional().nullable(),
    targetClass: z.coerce.number().int().min(5).max(12),
    targetStream: z.enum(STREAMS).optional().nullable(),
    totalQuestions: z.coerce.number().int().min(1).max(200).default(25),
    duration: z.coerce.number().int().min(1).max(480),
    passingMarks: z.coerce.number().int().min(0).default(0),
    passingPercentage: z.coerce.number().min(0).max(100).default(40),
    difficulty: z.enum(DIFFICULTIES).default("MEDIUM"),
    marksPerQuestion: z.coerce.number().min(0).max(100).default(1),
    negativeMarking: z
      .object({
        enabled: z.boolean().default(false),
        value: z.coerce.number().min(0).max(100).default(0),
      })
      .default({ enabled: false, value: 0 }),
    proctoring: z
      .object({
        mode: z.enum(PROCTORING_MODES).default("DISABLED"),
        requireMic: z.boolean().default(false),
        requireFullscreen: z.boolean().default(true),
        maxTabSwitches: z.coerce.number().int().min(0).max(100).default(3),
      })
      .default({ mode: "DISABLED", requireMic: false, requireFullscreen: true, maxTabSwitches: 3 }),
    distribution: z.array(categoryRuleSchema).default([]),
  })
  .refine((d) => d.distribution.every((r) => r.min <= r.max), {
    message: "Each category min must be <= max",
    path: ["distribution"],
  });

export const scheduleTestSchema = z.object({
  examDate: z.string().datetime().optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  enrollmentDeadline: z.string().datetime().optional().nullable(),
  eligibleClasses: z.array(z.coerce.number().int().min(5).max(12)).default([]),
  eligibleStreams: z.array(z.enum(STREAMS)).default([]),
  capacity: z.coerce.number().int().min(0).optional().nullable(),
  assignedCenters: z.array(objectIdSchema).default([]),
});

export const reviewDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
    reason: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((d) => d.decision === "APPROVED" || (d.reason && d.reason.length > 0), {
    message: "A reason is required when rejecting or requesting changes",
    path: ["reason"],
  });

// ─── Exam ────────────────────────────────────────────────────────────
export const saveAnswerSchema = z.object({
  questionId: objectIdSchema,
  selectedOption: z.enum(OPTION_KEYS).nullable(),
  markedForReview: z.boolean().default(false),
});

// ─── Pagination ──────────────────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});
