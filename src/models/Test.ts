import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  DIFFICULTIES,
  PROCTORING_MODES,
  REVIEW_STATUSES,
  STREAMS,
  TEST_STATUSES,
  EXACT_QUESTIONS_PER_ATTEMPT,
  type Difficulty,
  type ProctoringMode,
  type ReviewStatus,
  type Stream,
  type TestStatus,
} from "@/lib/constants";

export interface ICategoryRule {
  category: string; // SYLLABUS | AI_LITERACY | IT_LITERACY
  min: number;
  max: number;
}

export interface ITest {
  _id: Types.ObjectId;
  center: Types.ObjectId;
  createdBy: Types.ObjectId;
  name: string;
  description?: string | null;
  instructions?: string | null;
  rules?: string | null;
  specialConditions?: string | null;
  targetClass: number; // 5..12
  targetStream?: Stream | null;
  totalQuestions: number; // served per attempt (default 25)
  duration: number; // minutes
  passingMarks: number;
  passingPercentage: number;
  difficulty: Difficulty;
  negativeMarking: { enabled: boolean; value: number };
  marksPerQuestion: number;
  proctoring: {
    mode: ProctoringMode;
    requireMic: boolean;
    requireFullscreen: boolean;
    maxTabSwitches: number;
  };
  /** Category distribution ranges; must be satisfiable to exactly totalQuestions. */
  distribution: ICategoryRule[];
  // Review/approval workflow
  reviewStatus: ReviewStatus;
  submittedAt?: Date | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  // Scheduling/publication
  status: TestStatus;
  schedule: {
    examDate?: Date | null;
    startTime?: Date | null;
    endTime?: Date | null;
    enrollmentDeadline?: Date | null;
    eligibleClasses: number[];
    eligibleStreams: Stream[];
    capacity?: number | null;
  };
  assignedCenters: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CategoryRuleSchema = new Schema<ICategoryRule>(
  {
    category: { type: String, required: true },
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const TestSchema = new Schema<ITest>(
  {
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    instructions: { type: String, trim: true, maxlength: 5000, default: null },
    rules: { type: String, trim: true, maxlength: 5000, default: null },
    specialConditions: { type: String, trim: true, maxlength: 2000, default: null },
    targetClass: { type: Number, required: true, min: 5, max: 12, index: true },
    targetStream: { type: String, enum: STREAMS, default: null },
    totalQuestions: { type: Number, default: EXACT_QUESTIONS_PER_ATTEMPT, min: 1, max: 200 },
    duration: { type: Number, required: true, min: 1, max: 480 },
    passingMarks: { type: Number, default: 0, min: 0 },
    passingPercentage: { type: Number, default: 40, min: 0, max: 100 },
    difficulty: { type: String, enum: DIFFICULTIES, default: "MEDIUM" },
    negativeMarking: {
      enabled: { type: Boolean, default: false },
      value: { type: Number, default: 0, min: 0 },
    },
    marksPerQuestion: { type: Number, default: 1, min: 0 },
    proctoring: {
      mode: { type: String, enum: PROCTORING_MODES, default: "DISABLED" },
      requireMic: { type: Boolean, default: false },
      requireFullscreen: { type: Boolean, default: true },
      maxTabSwitches: { type: Number, default: 3, min: 0 },
    },
    distribution: { type: [CategoryRuleSchema], default: [] },
    reviewStatus: { type: String, enum: REVIEW_STATUSES, default: "DRAFT", index: true },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 2000, default: null },
    status: { type: String, enum: TEST_STATUSES, default: "UNPUBLISHED", index: true },
    schedule: {
      examDate: { type: Date, default: null },
      startTime: { type: Date, default: null },
      endTime: { type: Date, default: null },
      enrollmentDeadline: { type: Date, default: null },
      eligibleClasses: { type: [Number], default: [] },
      eligibleStreams: { type: [String], enum: STREAMS, default: [] },
      capacity: { type: Number, default: null },
    },
    assignedCenters: { type: [Schema.Types.ObjectId], ref: "ALCCenter", default: [] },
  },
  { timestamps: true }
);

TestSchema.index({ center: 1, reviewStatus: 1 });
TestSchema.index({ status: 1, "schedule.examDate": 1 });

export const Test: Model<ITest> =
  (models.Test as Model<ITest>) || model<ITest>("Test", TestSchema);
