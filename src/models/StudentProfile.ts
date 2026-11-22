import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  STREAMS,
  STUDENT_CENTER_STATUSES,
  type Stream,
  type StudentCenterStatus,
} from "@/lib/constants";

export interface IStudentProfile {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  class: number; // 5..12
  stream?: Stream | null; // only for 11/12
  schoolName: string;
  /** Photo uploaded at registration (kept separately from the exam-time selfie). */
  photo?: { url: string; publicId: string } | null;
  center?: Types.ObjectId | null;
  centerStatus: StudentCenterStatus;
  mscit: {
    completed: boolean;
    percentage?: number | null;
    interested: boolean;
  };
  termsAcceptedAt?: Date | null;
  termsVersion?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudentProfileSchema = new Schema<IStudentProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    class: { type: Number, required: true, min: 5, max: 12, index: true },
    stream: { type: String, enum: STREAMS, default: null, index: true },
    schoolName: { type: String, required: true, trim: true, maxlength: 200 },
    photo: { type: new Schema({ url: String, publicId: String }, { _id: false }), default: null },
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", default: null, index: true },
    centerStatus: {
      type: String,
      enum: STUDENT_CENTER_STATUSES,
      default: "UNASSIGNED",
      index: true,
    },
    mscit: {
      completed: { type: Boolean, default: false },
      percentage: { type: Number, default: null, min: 0, max: 100 },
      interested: { type: Boolean, default: false },
    },
    termsAcceptedAt: { type: Date, default: null },
    termsVersion: { type: String, default: null },
  },
  { timestamps: true }
);

export const StudentProfile: Model<IStudentProfile> =
  (models.StudentProfile as Model<IStudentProfile>) ||
  model<IStudentProfile>("StudentProfile", StudentProfileSchema);
