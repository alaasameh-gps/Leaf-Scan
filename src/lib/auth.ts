import { verifyToken } from "./jwt";
import dbConnect from "./dbConnect";
import User from "../models/User";

export async function getUserFromToken(token?: string | null) {
  if (!token) return null;
  try {
    const payload: any = verifyToken(token as string);
    if (!payload?.userId) return null;
    await dbConnect();
    const user = await User.findById(payload.userId).select("-password").lean();
    return user;
  } catch (err) {
    return null;
  }
}
