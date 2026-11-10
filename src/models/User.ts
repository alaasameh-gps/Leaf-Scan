import mongoose, { Schema, Document, Model } from "mongoose";

export type Role = "student" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: Role;
  avatar?: string;
  status: "active" | "disabled";
  createdAt: Date;
}

const UserSchema: Schema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    avatar: { type: String },
    status: { type: String, enum: ["active", "disabled"], default: "active" }
  },
  {
    timestamps: true
  }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
