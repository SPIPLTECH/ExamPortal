/** Shared domain enums/constants used across models, validation and UI. */

export const ROLES = ["SUPER_ADMIN", "ALC_CENTER", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const STUDENT_CLASSES = [5, 6, 7, 8, 9, 10, 11, 12] as const;
export type StudentClass = (typeof STUDENT_CLASSES)[number];

export const STREAMS = ["SCIENCE", "COMMERCE", "ARTS"] as const;
export type Stream = (typeof STREAMS)[number];

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Question categories that drive the class-wise distribution engine. */
export const CATEGORIES = ["SYLLABUS", "AI_LITERACY", "IT_LITERACY"] as const;
export type Category = (typeof CATEGORIES)[number];

export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/** Test lifecycle: review (approval) status, independent of scheduling status. */
export const REVIEW_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Test scheduling/publication status (only meaningful once APPROVED). */
export const TEST_STATUSES = [
  "UNPUBLISHED",
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

export const PROCTORING_MODES = ["MANDATORY", "OPTIONAL", "DISABLED"] as const;
export type ProctoringMode = (typeof PROCTORING_MODES)[number];

export const ATTEMPT_STATUSES = [
  "IN_PROGRESS",
  "SUBMITTED",
  "TIMED_OUT",
  "TERMINATED",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** Per-question UI state in the exam palette. */
export const RESPONSE_STATUSES = [
  "UNATTEMPTED",
  "ATTEMPTED",
  "MARKED",
  "ANSWERED_MARKED",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const ENROLLMENT_STATUSES = ["ENROLLED", "CANCELLED", "COMPLETED"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const MSCIT_ENQUIRY_STATUSES = [
  "NEW",
  "CONTACTED",
  "CONVERTED",
  "CLOSED",
] as const;
export type MscitEnquiryStatus = (typeof MSCIT_ENQUIRY_STATUSES)[number];

/** Student <-> center association state. */
export const STUDENT_CENTER_STATUSES = [
  "UNASSIGNED",
  "PENDING",
  "VERIFIED",
] as const;
export type StudentCenterStatus = (typeof STUDENT_CENTER_STATUSES)[number];

export const EXACT_QUESTIONS_PER_ATTEMPT = 25;

/**
 * Default category distribution per class band.
 * min/max are per-category question counts; the engine selects exactly 25
 * while satisfying every band. `syllabusFillsRemainder` means the SYLLABUS
 * category takes whatever is left after AI/IT minimums are met (classes 8-12).
 */
export type CategoryRange = { min: number; max: number };
export type ClassBandRule = {
  syllabus: CategoryRange;
  aiLiteracy?: CategoryRange;
  itLiteracy?: CategoryRange;
  requiresStream?: boolean;
};

export function defaultRuleForClass(cls: number): ClassBandRule {
  if (cls >= 5 && cls <= 7) {
    return { syllabus: { min: 25, max: 25 } };
  }
  if (cls >= 8 && cls <= 10) {
    return {
      syllabus: { min: 8, max: 10 },
      aiLiteracy: { min: 7, max: 8 },
      itLiteracy: { min: 7, max: 8 },
    };
  }
  // 11-12
  return {
    syllabus: { min: 9, max: 11 },
    aiLiteracy: { min: 7, max: 8 },
    itLiteracy: { min: 7, max: 8 },
    requiresStream: true,
  };
}
