import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ITermsVersion {
  _id: Types.ObjectId;
  version: string;
  content: string;
  active: boolean;
  publishedAt: Date;
  createdAt: Date;
}



const TermsVersionSchema = new Schema<ITermsVersion>(
  {
    version: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true },
    active: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TermsVersion: Model<ITermsVersion> =
  (models.TermsVersion as Model<ITermsVersion>) ||
  model<ITermsVersion>("TermsVersion", TermsVersionSchema);
