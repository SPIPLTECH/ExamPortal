import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ISystemSetting {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  updatedAt: Date;
  createdAt: Date;
}

const SystemSettingSchema = new Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SystemSetting: Model<ISystemSetting> =
  (models.SystemSetting as Model<ISystemSetting>) ||
  model<ISystemSetting>("SystemSetting", SystemSettingSchema);
