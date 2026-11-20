import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  OPTION_KEYS,
  RESPONSE_STATUSES,
  type OptionKey,
  type ResponseStatus,
} from "@/lib/constants";

export interface IExamResponse {
  _id: Types.ObjectId;
  attempt: Types.ObjectId;
  question: Types.ObjectId;
  student: Types.ObjectId;
  selectedOption?: OptionKey | null;
  status: ResponseStatus;
  updatedAt: Date;
  createdAt: Date;
}

const ExamResponseSchema = new Schema<IExamResponse>(
  {
    attempt: { type: Schema.Types.ObjectId, ref: "ExamAttempt", required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    selectedOption: { type: String, enum: OPTION_KEYS, default: null },
    status: { type: String, enum: RESPONSE_STATUSES, default: "UNATTEMPTED" },
  },
  { timestamps: true }
);

// One response row per (attempt, question).
ExamResponseSchema.index({ attempt: 1, question: 1 }, { unique: true });

export const ExamResponse: Model<IExamResponse> =
  (models.ExamResponse as Model<IExamResponse>) ||
  model<IExamResponse>("ExamResponse", ExamResponseSchema);
