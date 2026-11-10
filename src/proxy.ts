import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "./lib/rateLimiter";

function getRemoteKey(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || (req as any).ip || "local";
}

function checkCsrf(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (!origin && !referer) return false;
  if (process.env.NODE_ENV !== "production") return true; // ease in dev
  const host = req.nextUrl.origin;
  if (origin && origin === host) return true;
  if (referer && referer.startsWith(host)) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limit APIs and auth endpoints. Each category gets its own bucket so
  // ordinary page/API traffic can never exhaust the stricter credential bucket.
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    const ip = getRemoteKey(req);
    const isCredential = pathname.includes("/api/auth/login") || pathname.includes("/api/auth/register");
    const isRead = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";

    if (isCredential) {
      const rl = rateLimit(`${ip}:auth`, 6, 15 * 60 * 1000);
      if (!rl.allowed) return new NextResponse("Too Many Requests", { status: 429 });
    } else if (!isRead) {
      const rl = rateLimit(`${ip}:api`, 60, 15 * 60 * 1000);
      if (!rl.allowed) return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  // CSRF checks for state-changing requests
  if (!checkCsrf(req)) {
    return new NextResponse("CSRF check failed", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/auth/:path*"],
};
