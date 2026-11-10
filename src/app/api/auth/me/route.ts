import { NextResponse } from "next/server";
import { getUserFromToken } from "../../../../lib/auth";

export async function GET(req: Request) {
  try {
    // Next.js provides cookies differently; we will read cookie header
    const cookie = (req as any).headers.get("cookie") || "";
    const match = cookie.match(/token=([^;]+)/);
    const token = match ? match[1] : null;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ success: false, data: null });
    return NextResponse.json({ success: true, data: { user } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || "Server error" }, { status: 500 });
  }
}
