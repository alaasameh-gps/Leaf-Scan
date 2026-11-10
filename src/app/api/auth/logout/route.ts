import { NextResponse } from "next/server";
import { stringifySetCookie } from "cookie";

export async function POST() {
  const cookie = stringifySetCookie({
    name: "token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return NextResponse.json({ success: true }, { headers: { "Set-Cookie": cookie } });
}
