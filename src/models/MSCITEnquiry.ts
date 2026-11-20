import { Schema, model, models, type Model, type Types } from "mongoose";
import { MSCIT_ENQUIRY_STATUSES, type MscitEnquiryStatus } from "@/lib/constants";

export interface IFollowUp {
  note: string;
  by?: Types.ObjectId | null;
  at: Date;
}

export interface IMSCITEnquiry {
  _id: Types.ObjectId;
  student?: Types.ObjectId | null;
  name: string;
  contact: string;
  class: number;
  school?: string | null;
  interested: boolean;
  status: MscitEnquiryStatus;
  assignedAdvisor?: Types.ObjectId | null;
  followUps: IFollowUp[];
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    note: { type: String, required: true, maxlength: 2000 },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const MSCITEnquirySchema = new Schema<IMSCITEnquiry>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    contact: { type: String, required: true, trim: true, maxlength: 255 },
    class: { type: Number, required: true, min: 5, max: 12 },
    school: { type: String, trim: true, maxlength: 200, default: null },
    interested: { type: Boolean, default: true },
    status: { type: String, enum: MSCIT_ENQUIRY_STATUSES, default: "NEW", index: true },
    assignedAdvisor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    followUps: { type: [FollowUpSchema], default: [] },
  },
  { timestamps: true }
);

export const MSCITEnquiry: Model<IMSCITEnquiry> =
  (models.MSCITEnquiry as Model<IMSCITEnquiry>) ||
  model<IMSCITEnquiry>("MSCITEnquiry", MSCITEnquirySchema);
