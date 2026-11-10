import dbConnect from "../lib/dbConnect";
import User, { IUser } from "../models/User";
import bcrypt from "bcrypt";

export async function createUser(data: { name: string; email: string; password: string }): Promise<Partial<IUser>> {
  await dbConnect();
  const hashed = await bcrypt.hash(data.password, 10);
  const user = await User.create({ name: data.name, email: data.email, password: hashed });
  const u = user.toObject();
  delete (u as any).password;
  return u;
}

export async function findUserByEmail(email: string) {
  await dbConnect();
  return User.findOne({ email });
}

export async function findUserById(id: string) {
  await dbConnect();
  return User.findById(id).select("-password");
}
