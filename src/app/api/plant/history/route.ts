import { NextResponse } from "next/server";
import { getUserFromToken } from "../../../../lib/auth";
import dbConnect from "../../../../lib/dbConnect";
import PlantAnalysis from "../../../../models/PlantAnalysis";
import { getClassInfo } from "../../../../lib/plant/classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractToken(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

function decorate(entry: {
  _id: unknown;
  classId: string;
  displayName?: string;
  confidence: number;
  confident: boolean;
  createdAt: Date;
}) {
  const info = getClassInfo(entry.classId);
  return {
    id: String(entry._id),
    classId: entry.classId,
    displayName: entry.displayName ?? null,
    cropAr: info?.cropAr ?? null,
    cropEn: info?.cropEn ?? null,
    conditionAr: info?.conditionAr ?? null,
    conditionEn: info?.conditionEn ?? null,
    confidence: entry.confidence,
    confident: entry.confident,
    createdAt: entry.createdAt,
  };
}

export async function GET(req: Request) {
  const user = await getUserFromToken(extractToken(req));
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Sign in to see your identification history.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }
  try {
    await dbConnect();
    const entries = await PlantAnalysis.find({ user: (user as { _id: unknown })._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return NextResponse.json({ success: true, data: { items: entries.map((entry) => decorate(entry as never)) } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Could not read history: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const user = await getUserFromToken(extractToken(req));
  if (!user) {
    return NextResponse.json({ success: false, message: "Sign in to manage your history." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, message: "Missing 'id' query parameter." }, { status: 400 });
  }
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return NextResponse.json({ success: false, message: "Invalid history id." }, { status: 400 });
  }
  try {
    await dbConnect();
    const deleted = await PlantAnalysis.findOneAndDelete({
      _id: id,
      user: (user as { _id: unknown })._id,
    });
    if (!deleted) {
      return NextResponse.json({ success: false, message: "History entry not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Could not delete history entry: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
