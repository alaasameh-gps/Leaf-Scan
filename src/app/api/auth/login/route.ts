import { NextResponse } from "next/server";
import { loginSchema } from "../../../../validations/auth";
import dbConnect from "../../../../lib/dbConnect";
import User from "../../../../models/User";
import bcrypt from "bcrypt";
import { signToken } from "../../../../lib/jwt";
import { stringifySetCookie } from "cookie";
import { rateLimit } from "../../../../lib/rateLimiter";

export async function POST(req: Request) {
  try {
    // rate limit by IP/email
    try {
      const ip = (req as any).headers.get('x-forwarded-for') || (req as any).ip || 'anon';
      const limit = process.env.NODE_ENV === 'production' ? 6 : 60;
      const rl = rateLimit(ip + ':auth:login', limit, 15 * 60 * 1000);
      if (!rl.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
    } catch (e) { /* swallow */ }
    const body = await req.json();
    const parsed = loginSchema.parse(body);

    await dbConnect();

    const user = await User.findOne({ email: parsed.email });
    if (!user) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
    }

    if (!user.password) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
    }

    const ok = await bcrypt.compare(parsed.password, user.password);
    if (!ok) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
    }

    const token = signToken({ userId: user._id.toString(), role: user.role });

    const cookie = stringifySetCookie({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? 'strict' : 'lax',
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    const userSafe = user.toObject();
    delete userSafe.password;

    return NextResponse.json({ success: true, data: { user: userSafe } }, { headers: { "Set-Cookie": cookie } });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ success: false, message: err.errors || err.message }, { status: 422 });
    }
    return NextResponse.json({ success: false, message: err.message || "Server error" }, { status: 500 });
  }
}
