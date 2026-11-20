import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IProctoringEvidence {
  _id: Types.ObjectId;
  session: Types.ObjectId;
  attempt: Types.ObjectId;
  category: string; // e.g. SNAPSHOT, IDENTITY, FLAG
  cloudinary: { url: string; publicId: string };
  analysis?: Record<string, unknown> | null;
  capturedAt: Date;
  retentionUntil?: Date | null;
  createdAt: Date;
}

const ProctoringEvidenceSchema = new Schema<IProctoringEvidence>(
  {
    session: { type: Schema.Types.ObjectId, ref: "ProctoringSession", required: true, index: true },
    attempt: { type: Schema.Types.ObjectId, ref: "ExamAttempt", required: true, index: true },
    category: { type: String, default: "SNAPSHOT" },
    cloudinary: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
    },
    analysis: { type: Schema.Types.Mixed, default: null },
    capturedAt: { type: Date, default: () => new Date() },
    retentionUntil: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ProctoringEvidence: Model<IProctoringEvidence> =
  (models.ProctoringEvidence as Model<IProctoringEvidence>) ||
  model<IProctoringEvidence>("ProctoringEvidence", ProctoringEvidenceSchema);
