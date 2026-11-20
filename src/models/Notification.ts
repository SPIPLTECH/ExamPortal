import { Schema, model, models, type Model, type Types } from "mongoose";

export interface INotification {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, default: "INFO" },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: null, maxlength: 2000 },
    link: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ||
  model<INotification>("Notification", NotificationSchema);
