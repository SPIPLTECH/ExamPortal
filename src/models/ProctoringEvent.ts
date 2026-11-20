import { Schema, model, models, type Model, type Types } from "mongoose";

/** Event types ported from the existing proctoring system's browser monitoring. */
export const PROCTORING_EVENT_TYPES = [
  "TAB_SWITCH",
  "WINDOW_BLUR",
  "VISIBILITY_HIDDEN",
  "FULLSCREEN_EXIT",
  "FACE_MISSING",
  "MULTIPLE_FACES",
  "VOICE_DETECTED",
  "CAMERA_BLOCKED",
  "COPY_PASTE",
  "DEVTOOLS_OPEN",
  "WARNING_ISSUED",
  "AUTO_TERMINATED",
  "CONSENT_GIVEN",
  "IDENTITY_CAPTURED",
] as const;
export type ProctoringEventType = (typeof PROCTORING_EVENT_TYPES)[number];

export type EventSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface IProctoringEvent {
  _id: Types.ObjectId;
  session: Types.ObjectId;
  attempt: Types.ObjectId;
  /** Raw event type from the browser monitor (free-form; see PROCTORING_EVENT_TYPES for the common set). */
  type: string;
  severity: EventSeverity;
  seq: number; // client-assigned sequence for de-duplication
  metadata?: Record<string, unknown> | null;
  clientTime?: Date | null;
  serverTime: Date;
  createdAt: Date;
}

const ProctoringEventSchema = new Schema<IProctoringEvent>(
  {
    session: { type: Schema.Types.ObjectId, ref: "ProctoringSession", required: true, index: true },
    attempt: { type: Schema.Types.ObjectId, ref: "ExamAttempt", required: true, index: true },
    type: { type: String, required: true },
    severity: {
      type: String,
      enum: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "INFO",
      index: true,
    },
    seq: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: null },
    clientTime: { type: Date, default: null },
    serverTime: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// De-duplicate client retries by (session, seq) when seq > 0.
ProctoringEventSchema.index(
  { session: 1, seq: 1 },
  { unique: true, partialFilterExpression: { seq: { $gt: 0 } } }
);

export const ProctoringEvent: Model<IProctoringEvent> =
  (models.ProctoringEvent as Model<IProctoringEvent>) ||
  model<IProctoringEvent>("ProctoringEvent", ProctoringEventSchema);
