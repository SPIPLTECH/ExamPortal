import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ISchool {
  _id: Types.ObjectId;
  center: Types.ObjectId; // owning center (tenant)
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema = new Schema<ISchool>(
  {
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    address: { type: String, trim: true, maxlength: 500, default: null },
    phone: { type: String, trim: true, maxlength: 20, default: null },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// A center cannot have two schools with the same name.
SchoolSchema.index({ center: 1, name: 1 }, { unique: true });

export const School: Model<ISchool> =
  (models.School as Model<ISchool>) || model<ISchool>("School", SchoolSchema);
