import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  CATEGORIES,
  DIFFICULTIES,
  OPTION_KEYS,
  STREAMS,
  type Category,
  type Difficulty,
  type OptionKey,
  type Stream,
} from "@/lib/constants";

export interface IQuestionOption {
  key: OptionKey;
  text: string;
  imageUrl?: string | null;
}

export interface IQuestion {
  _id: Types.ObjectId;
  center: Types.ObjectId; // owning ALC center (tenant)
  /** When set, this question belongs to a specific test's pool (not the shared bank). */
  test?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  text: string;
  options: IQuestionOption[];
  correctOption: OptionKey;
  difficulty: Difficulty;
  class: number; // 5..12
  classGroup?: string | null;
  category: Category;
  stream?: Stream | null;
  explanation?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<IQuestionOption>(
  {
    key: { type: String, enum: OPTION_KEYS, required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    imageUrl: { type: String, default: null, maxlength: 2000 },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", required: true, index: true },
    test: { type: Schema.Types.ObjectId, ref: "Test", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    options: {
      type: [OptionSchema],
      validate: {
        validator: (v: IQuestionOption[]) => v.length >= 2 && v.length <= OPTION_KEYS.length,
        message: "A question needs between 2 and 6 options.",
      },
    },
    correctOption: { type: String, enum: OPTION_KEYS, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, default: "MEDIUM", index: true },
    class: { type: Number, required: true, min: 5, max: 12, index: true },
    classGroup: { type: String, trim: true, maxlength: 100, default: null },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    stream: { type: String, enum: STREAMS, default: null, index: true },
    explanation: { type: String, trim: true, maxlength: 5000, default: null },
    imageUrl: { type: String, default: null, maxlength: 2000 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Primary access pattern for the distribution engine: eligible pool by tenant.
QuestionSchema.index({ center: 1, class: 1, category: 1, stream: 1, isActive: 1 });

// Ensure correctOption refers to an existing option key.
QuestionSchema.pre("validate", function (next) {
  const keys = this.options?.map((o) => o.key) ?? [];
  if (new Set(keys).size !== keys.length) {
    return next(new Error("Option keys must be unique."));
  }
  if (this.correctOption && !keys.includes(this.correctOption)) {
    return next(new Error("correctOption must match one of the option keys."));
  }
  next();
});

export const Question: Model<IQuestion> =
  (models.Question as Model<IQuestion>) ||
  model<IQuestion>("Question", QuestionSchema);
