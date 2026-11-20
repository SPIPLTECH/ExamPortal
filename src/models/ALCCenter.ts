import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IALCCenter {
  _id: Types.ObjectId;
  name: string;
  code: string; // unique human-friendly center code, also used as invitation code
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
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
    isActive: { type: Boolean, default: true, index: true },
    capacity: { type: Number, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const ALCCenter: Model<IALCCenter> =
  (models.ALCCenter as Model<IALCCenter>) ||
  model<IALCCenter>("ALCCenter", ALCCenterSchema);
