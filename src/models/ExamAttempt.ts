import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  ATTEMPT_STATUSES,
  OPTION_KEYS,
  PROCTORING_MODES,
  type AttemptStatus,
  type OptionKey,
  type ProctoringMode,
} from "@/lib/constants";

/**
 * A frozen question as served to one student. Options are pre-shuffled and
 * stored WITHOUT revealing which is correct to the client; `correctOption`
 * lives here server-side only and is projected out of any client response.
 */
export interface IFrozenOption {
  key: OptionKey; // display key after shuffle
  text: string;
  imageUrl?: string | null;
}
export interface IFrozenQuestion {
  question: Types.ObjectId;
  order: number;
  category: string;
  text: string;
  imageUrl?: string | null;
  options: IFrozenOption[];
  correctOption: OptionKey; // SERVER ONLY — never sent to student
  marks: number;
  negativeMarks: number;
}

export interface IExamAttempt {
  _id: Types.ObjectId;
  test: Types.ObjectId;
  student: Types.ObjectId;
  enrollment: Types.ObjectId;
  center: Types.ObjectId;
  status: AttemptStatus;
  questions: IFrozenQuestion[];
  proctoringMode: ProctoringMode; // locked at start
  startedAt: Date;
  deadlineAt: Date;
  submittedAt?: Date | null;
  terminationReason?: string | null;
  /** Verified live selfie taken before the exam (shown in the exam room, to the center and admin). */
  selfieUrl?: string | null;
  durationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const FrozenOptionSchema = new Schema<IFrozenOption>(
  {
    key: { type: String, enum: OPTION_KEYS, required: true },
    text: { type: String, required: true },
    imageUrl: { type: String, default: null },
  },
  { _id: false }
);

const FrozenQuestionSchema = new Schema<IFrozenQuestion>(
  {
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    order: { type: Number, required: true },
    category: { type: String, required: true },
    text: { type: String, required: true },
    imageUrl: { type: String, default: null },
    options: { type: [FrozenOptionSchema], required: true },
    correctOption: { type: String, enum: OPTION_KEYS, required: true },
    marks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 0 },
  },
  { _id: false }
);

const ExamAttemptSchema = new Schema<IExamAttempt>(
  {
    test: { type: Schema.Types.ObjectId, ref: "Test", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    enrollment: { type: Schema.Types.ObjectId, ref: "TestEnrollment", required: true },
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", required: true },
    status: { type: String, enum: ATTEMPT_STATUSES, default: "IN_PROGRESS", index: true },
    questions: { type: [FrozenQuestionSchema], required: true },
    proctoringMode: { type: String, enum: PROCTORING_MODES, default: "DISABLED" },
    startedAt: { type: Date, default: () => new Date() },
    deadlineAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    terminationReason: { type: String, default: null },
    selfieUrl: { type: String, default: null },
    durationMinutes: { type: Number, required: true },
  },
  { timestamps: true }
);

// One in-progress attempt per student+test (enforced in service layer on create).
ExamAttemptSchema.index({ test: 1, student: 1, status: 1 });

export const ExamAttempt: Model<IExamAttempt> =
  (models.ExamAttempt as Model<IExamAttempt>) ||
  model<IExamAttempt>("ExamAttempt", ExamAttemptSchema);
