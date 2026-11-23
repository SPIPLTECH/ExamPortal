import { Schema, model, models, type Model, type Types } from "mongoose";
import { QUESTION_DB_MODES, type QuestionDbMode } from "@/lib/constants";

export interface IALCCenter {
  _id: Types.ObjectId;
  name: string;
  code: string; // unique human-friendly center code (internal reference only)
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  /** Center owner contact details (collected at provisioning). */
  owner?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  /** Master proctoring switch for the center; tests cannot proctor when false. */
  proctoringEnabled: boolean;
  /** Which question library this center may compose tests from. */
  questionDbMode: QuestionDbMode;
  isActive: boolean;
  capacity?: number | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ALCCenterSchema = new Schema<IALCCenter>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
      unique: true,
      index: true,
    },
    email: { type: String, trim: true, lowercase: true, maxlength: 255, default: null },
    phone: { type: String, trim: true, maxlength: 20, default: null },
    address: { type: String, trim: true, maxlength: 500, default: null },
    city: { type: String, trim: true, maxlength: 100, default: null },
    state: { type: String, trim: true, maxlength: 100, default: null },
    owner: {
      type: new Schema(
        {
          name: { type: String, trim: true, maxlength: 120, default: null },
          email: { type: String, trim: true, lowercase: true, maxlength: 255, default: null },
          phone: { type: String, trim: true, maxlength: 20, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    proctoringEnabled: { type: Boolean, default: true },
    questionDbMode: { type: String, enum: QUESTION_DB_MODES, default: "BOTH" },
    isActive: { type: Boolean, default: true, index: true },
    capacity: { type: Number, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const ALCCenter: Model<IALCCenter> =
  (models.ALCCenter as Model<IALCCenter>) ||
  model<IALCCenter>("ALCCenter", ALCCenterSchema);
