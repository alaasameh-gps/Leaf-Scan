import { NextResponse } from "next/server";
import { rateLimit } from "../../../../lib/rateLimiter";
import { getBotanicalInfoCached, searchBotanical } from "../../../../lib/plant/botanical";
import { getClassInfo } from "../../../../lib/plant/classes";
import { clientIp } from "../../../../lib/plant/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = rateLimit(`plant:botanical:${clientIp(req)}`, 60, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
  }

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const query = url.searchParams.get("q");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "ar";

  try {
    if (classId) {
      if (!getClassInfo(classId)) {
        return NextResponse.json(
          { success: false, message: "Unknown classId. Use GET /api/plant/classes to list supported ids." },
          { status: 404 },
        );
      }
      const data = await getBotanicalInfoCached(classId, lang);
      return NextResponse.json({ success: true, data });
    }

    if (query && query.trim().length >= 2) {
      const data = await searchBotanical(query.trim());
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { success: false, message: "Provide either ?classId=<dataset class> or ?q=<plant or disease name>." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Reference lookup failed: ${(error as Error).message}` },
      { status: 502 },
    );
  }
}
