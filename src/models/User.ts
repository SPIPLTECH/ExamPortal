import { Schema, model, models, type Model, type Types } from "mongoose";
import { ROLES, type Role } from "@/lib/constants";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email?: string | null;
  mobile?: string | null;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  image?: { url: string; publicId: string } | null;
  /** For ALC_CENTER login users: the center they administer. */
  center?: Types.ObjectId | null;
  lastLoginAt?: Date | null;
  loginAttempts: number;
  lockedUntil?: Date | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // At least one of email/mobile is required (enforced in validation layer).
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 255,
      default: null,
    },
    mobile: { type: String, trim: true, maxlength: 20, default: null },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    image: {
      type: new Schema(
        { url: String, publicId: String },
        { _id: false }
      ),
      default: null,
    },
    center: { type: Schema.Types.ObjectId, ref: "ALCCenter", default: null, index: true },
    lastLoginAt: { type: Date, default: null },
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Unique only among real (string) values, so multiple accounts may have a
// null email or null mobile. A plain `sparse` index does NOT work here because
// the field is explicitly stored as null (sparse only skips absent fields).
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);
UserSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { mobile: { $type: "string" } } }
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
