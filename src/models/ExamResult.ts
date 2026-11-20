import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ICategoryBreakdown {
  category: string;
  total: number;
  correct: number;
  wrong: number;
  unattempted: number;
}

export interface IExamResult {
  _id: Types.ObjectId;
  attempt: Types.ObjectId;
  test: Types.ObjectId;
  student: Types.ObjectId;
  center: Types.ObjectId;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  categoryBreakdown: ICategoryBreakdown[];
  released: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryBreakdownSchema = new Schema<ICategoryBreakdown>(
  {
    category: String,
    total: Number,
    correct: Number,
    wrong: Number,
    unattempted: Number,
  },
  { _id: false }
);

const ExamResultSchema = new Schema<IExamResult>(
  {
    attempt: {
      type: Schema.Types.ObjectId,
      ref: "ExamAttempt",
      required: true,
      unique: true,
      index: true,
    },
    test: { type: Schema.Types.ObjectId, ref: "Test", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", required: true, index: true },
    score: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    unattemptedCount: { type: Number, default: 0 },
    categoryBreakdown: { type: [CategoryBreakdownSchema], default: [] },
    released: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ExamResult: Model<IExamResult> =
  (models.ExamResult as Model<IExamResult>) ||
  model<IExamResult>("ExamResult", ExamResultSchema);
