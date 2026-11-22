import { Schema, model, models, type Model, type Types } from "mongoose";

/** One row per contact (mobile/email). Once verifiedAt is set the contact is "already verified" forever. */
export interface IContactVerification {
  _id: Types.ObjectId;
  type: "MOBILE" | "EMAIL";
  contact: string; // normalised
  codeHash?: string | null;
  expiresAt?: Date | null;
  attempts: number; // wrong guesses on the current code
  sentCount: number; // sends in the current hour window
  windowStart?: Date | null;
  lastSentAt?: Date | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ContactVerificationSchema = new Schema<IContactVerification>(
  {
    type: { type: String, enum: ["MOBILE", "EMAIL"], required: true },
    contact: { type: String, required: true, trim: true, maxlength: 255 },
    codeHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    windowStart: { type: Date, default: null },
    lastSentAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
ContactVerificationSchema.index({ type: 1, contact: 1 }, { unique: true });

export const ContactVerification: Model<IContactVerification> =
  (models.ContactVerification as Model<IContactVerification>) ||
  model<IContactVerification>("ContactVerification", ContactVerificationSchema);
