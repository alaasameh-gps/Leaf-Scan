import { NextResponse } from "next/server";
import { rateLimit } from "../../../../lib/rateLimiter";
import { getBotanicalInfoCached } from "../../../../lib/plant/botanical";
import { getClassInfo } from "../../../../lib/plant/classes";
import { answerQuestion, llmEnabled } from "../../../../lib/plant/qa";
import { clientIp } from "../../../../lib/plant/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 500;

export async function POST(req: Request) {
  const limit = rateLimit(`plant:ask:${clientIp(req)}`, 40, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: "Too many questions. Please wait and try again." }, { status: 429 });
  }

  let body: { question?: string; classId?: string; lang?: string } | null = null;
  try {
    body = (await req.json()) as { question?: string; classId?: string; lang?: string };
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const question = (body?.question ?? "").trim();
  const classId = body?.classId ?? "";
  const lang = body?.lang === "en" ? "en" : "ar";

  if (!question) {
    return NextResponse.json({ success: false, message: "A non-empty 'question' is required." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { success: false, message: `Questions must be at most ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (!getClassInfo(classId)) {
    return NextResponse.json(
      { success: false, message: "Unknown classId. Use GET /api/plant/classes to list supported ids." },
      { status: 400 },
    );
  }

  try {
    const botanical = await getBotanicalInfoCached(classId, lang);
    const answer = await answerQuestion(question, lang, botanical);
    return NextResponse.json({
      success: true,
      data: {
        ...answer,
        llmEnabled: llmEnabled(),
        classId,
        augmentation: {
          note:
            lang === "ar"
              ? "اجعل سؤالك محددًا: التصنيف، الانتشار، الأسماء الشائعة، وصف النبات، أو المرض المتوقع."
              : "Try a specific question about: taxonomy, distribution, common names, description, or the predicted disease.",
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Could not answer the question: ${(error as Error).message}` },
      { status: 502 },
    );
  }
}
