import { NextResponse } from "next/server";
import { rateLimit } from "../../../../lib/rateLimiter";
import { getUserFromToken } from "../../../../lib/auth";
import dbConnect from "../../../../lib/dbConnect";
import PlantAnalysis from "../../../../models/PlantAnalysis";
import { InferenceServiceError, predictImage } from "../../../../lib/plant/inference";
import { getBotanicalInfoCached } from "../../../../lib/plant/botanical";
import { clientIp, parseDataUrl, safeFileName, validateImageBuffer } from "../../../../lib/plant/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function extractToken(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

async function readImage(req: Request): Promise<{ buffer: Buffer; declaredType: string | null; fileName: string }> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      throw Object.assign(new Error("No 'image' file was provided in the form data."), { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return { buffer, declaredType: file.type || null, fileName: safeFileName(file.name || "upload") };
  }

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { image?: string } | null;
    if (!body?.image || typeof body.image !== "string") {
      throw Object.assign(new Error("JSON body must contain an 'image' data URL."), { status: 400 });
    }
    const parsed = parseDataUrl(body.image);
    if (!parsed) {
      throw Object.assign(new Error("The 'image' field must be a base64 data URL."), { status: 400 });
    }
    return { buffer: parsed.buffer, declaredType: parsed.mime, fileName: "upload" };
  }

  throw Object.assign(
    new Error("Send the image as multipart/form-data (field 'image') or JSON with a base64 data URL."),
    { status: 415 },
  );
}

export async function POST(req: Request) {
  const key = `plant:analyze:${clientIp(req)}`;
  const limit = rateLimit(key, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, message: "Too many analyses from this client. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  let image: { buffer: Buffer; declaredType: string | null; fileName: string };
  try {
    image = await readImage(req);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json({ success: false, message: (error as Error).message }, { status });
  }

  const validation = validateImageBuffer(image.buffer, image.declaredType);
  if (!validation.ok) {
    return NextResponse.json({ success: false, message: validation.reason }, { status: validation.status ?? 400 });
  }

  let result;
  try {
    result = await predictImage(image.buffer.toString("base64"), 3);
  } catch (error) {
    if (error instanceof InferenceServiceError) {
      return NextResponse.json({ success: false, message: error.message, code: "INFERENCE_UNAVAILABLE" }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, message: "Unexpected error while running inference.", code: "INFERENCE_ERROR" },
      { status: 500 },
    );
  }

  const classId = result.top?.class_name ?? null;
  let botanical = null;
  let botanicalError: string | null = null;
  if (classId) {
    try {
      botanical = await getBotanicalInfoCached(classId, "ar");
    } catch (error) {
      botanicalError = `Botanical information could not be retrieved: ${(error as Error).message}`;
    }
  }

  const analysis = {
    classId,
    displayName: result.top?.display_name ?? null,
    confidence: result.confidence,
    confident: result.confident,
    predictions: result.predictions,
    warnings: result.warnings,
    modelInfo: result.model_info,
    modelMetrics: result.model_metrics,
    botanical,
    botanicalError,
    analyzedAt: new Date().toISOString(),
  };

  try {
    const user = await getUserFromToken(extractToken(req));
    if (user && classId) {
      await dbConnect();
      await PlantAnalysis.create({
        user: (user as { _id: unknown })._id,
        classId,
        displayName: result.top?.display_name ?? undefined,
        confidence: result.confidence,
        confident: result.confident,
        alternatives: result.predictions.slice(1).map((item) => ({ classId: item.class_name, score: item.score })),
        warnings: result.warnings,
      });
    }
  } catch {
    // History persistence is best-effort; it must never fail an analysis.
  }

  return NextResponse.json({ success: true, data: analysis });
}
