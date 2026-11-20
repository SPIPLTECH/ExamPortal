import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  ENROLLMENT_STATUSES,
  PROCTORING_MODES,
  type EnrollmentStatus,
  type ProctoringMode,
} from "@/lib/constants";

export interface ITestEnrollment {
  _id: Types.ObjectId;
  test: Types.ObjectId;
  student: Types.ObjectId; // User id
  center: Types.ObjectId;
  status: EnrollmentStatus;
  /** For OPTIONAL proctoring: the student's choice at enrollment. */
  proctoringChoice?: ProctoringMode | null;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TestEnrollmentSchema = new Schema<ITestEnrollment>(
  {
    test: { type: Schema.Types.ObjectId, ref: "Test", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", required: true, index: true },
    status: { type: String, enum: ENROLLMENT_STATUSES, default: "ENROLLED", index: true },
    proctoringChoice: { type: String, enum: PROCTORING_MODES, default: null },
    enrolledAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Prevent duplicate active enrollments of the same student in the same test.
TestEnrollmentSchema.index({ test: 1, student: 1 }, { unique: true });

export const TestEnrollment: Model<ITestEnrollment> =
  (models.TestEnrollment as Model<ITestEnrollment>) ||
  model<ITestEnrollment>("TestEnrollment", TestEnrollmentSchema);
