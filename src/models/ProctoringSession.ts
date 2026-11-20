import { Schema, model, models, type Model, type Types } from "mongoose";
import { PROCTORING_MODES, type ProctoringMode } from "@/lib/constants";

export interface IProctoringSession {
  _id: Types.ObjectId;
  attempt: Types.ObjectId;
  student: Types.ObjectId;
  test: Types.ObjectId;
  center: Types.ObjectId;
  mode: ProctoringMode;
  status: "PENDING" | "ACTIVE" | "ENDED" | "TERMINATED";
  consentAt?: Date | null;
  consentVersion?: string | null;
  identityBaseline?: { url: string; publicId: string } | null;
  warnings: number;
  maxWarnings: number;
  isFlagged: boolean;
  latestWarningMessage?: string | null;
  counters: {
    tabSwitches: number;
    fullscreenExits: number;
    visibilityHidden: number;
    faceMissing: number;
    multipleFaces: number;
    voiceFlags: number;
  };
  /** Running AI rule state (consecutive-frame streaks, cooldowns). */
  aiState?: Record<string, number> | null;
  /** 128-d face feature of the pre-exam photo. Never sent to clients. */
  identityEmbedding?: number[];
  startedAt?: Date | null;
  endedAt?: Date | null;
  terminationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProctoringSessionSchema = new Schema<IProctoringSession>(
  {
    attempt: {
      type: Schema.Types.ObjectId,
      ref: "ExamAttempt",
      required: true,
      unique: true,
      index: true,
    },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    test: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", required: true },
    mode: { type: String, enum: PROCTORING_MODES, required: true },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "ENDED", "TERMINATED"],
      default: "PENDING",
      index: true,
    },
    consentAt: { type: Date, default: null },
    consentVersion: { type: String, default: null },
    identityBaseline: {
      type: new Schema({ url: String, publicId: String }, { _id: false }),
      default: null,
    },
    warnings: { type: Number, default: 0 },
    maxWarnings: { type: Number, default: 3 },
    isFlagged: { type: Boolean, default: false },
    latestWarningMessage: { type: String, default: null },
    counters: {
      tabSwitches: { type: Number, default: 0 },
      fullscreenExits: { type: Number, default: 0 },
      visibilityHidden: { type: Number, default: 0 },
      faceMissing: { type: Number, default: 0 },
      multipleFaces: { type: Number, default: 0 },
      voiceFlags: { type: Number, default: 0 },
    },
    aiState: { type: Schema.Types.Mixed, default: null },
    identityEmbedding: { type: [Number], default: undefined, select: false },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    terminationReason: { type: String, default: null },
  },
  { timestamps: true }
);

export const ProctoringSession: Model<IProctoringSession> =
  (models.ProctoringSession as Model<IProctoringSession>) ||
  model<IProctoringSession>("ProctoringSession", ProctoringSessionSchema);
