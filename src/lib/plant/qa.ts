/**
 * Question answering over retrieved botanical information.
 *
 * Two modes:
 *  1. "retrieval" (always available): the question is matched to the retrieved
 *     facts and the answer is the retrieved text of a citable source. If nothing
 *     matches, the answer says so explicitly.
 *  2. "llm" (optional, enabled only through environment variables): an
 *     OpenAI-compatible endpoint rewrites the retrieved facts into a friendly
 *     explanation, strictly limited to the provided context.
 *
 * API keys are read on the server and never exposed to the browser.
 */

import { BotanicalInfo, RetrievalFact, SourceRef } from "./botanical";

export interface QaAnswer {
  answer: string;
  mode: "retrieval" | "llm" | "unavailable";
  grounded: boolean;
  usedFacts: string[];
  sources: SourceRef[];
  notice: string;
}

interface Intent {
  keys: string[];
  keywords: { ar: string[]; en: string[] };
}

const INTENTS: Intent[] = [
  {
    keys: ["taxonomy"],
    keywords: {
      ar: ["تصنيف", "فصيلة", "عائلة", "جنس", "نوع", "علمي", "اسم علمي"],
      en: ["taxonomy", "taxonomic", "family", "genus", "species", "scientific name", "classified"],
    },
  },
  {
    keys: ["distribution"],
    keywords: {
      ar: ["انتشار", "موطن", "أين يزرع", "مناطق", "بيئة", "بلد المنشأ"],
      en: ["distribution", "habitat", "native", "where does it grow", "regions"],
    },
  },
  {
    keys: ["habitat"],
    keywords: {
      ar: ["موطن", "مناخ", "بيئة النمو"],
      en: ["habitat", "climate", "growing conditions"],
    },
  },
  {
    keys: ["commonNames", "cropArticle"],
    keywords: {
      ar: ["اسم", "أسماء", "يسمى", "شائع"],
      en: ["name", "called", "common name"],
    },
  },
  {
    keys: ["description"],
    keywords: {
      ar: ["وصف", "شكل", "شكل النبات", "معلومات عنه"],
      en: ["describe", "description", "what is", "looks like"],
    },
  },
  {
    keys: ["uses"],
    keywords: {
      ar: ["استخدام", "استخدامات", "فائدة", "فوائد", "يؤكل", "غذاء"],
      en: ["uses", "used for", "benefit", "food", "edible"],
    },
  },
  {
    keys: ["disease"],
    keywords: {
      ar: ["مرض", "المرض", "أعراض", "اعراض", "إصابة", "سبب", "مسبب", "فطر", "بكتيريا", "فيروس", "حشرة"],
      en: ["disease", "symptom", "cause", "pathogen", "fungus", "bacteria", "virus", "pest"],
    },
  },
];

const CARE_KEYWORDS = {
  ar: ["وقاية", "علاج", "عناية", "مكافحة", "مبيد", "رش", "سقي", "ري", "أعتني", "اعتني", "وقائي", "ادارة"],
  en: ["prevent", "prevention", "treat", "treatment", "care", "control", "pesticide", "spray", "water", "manage"],
};

function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function pickFacts(botanical: BotanicalInfo, keys: string[]): RetrievalFact[] {
  return botanical.facts.filter((item) => keys.includes(item.key));
}

const UNAVAILABLE_MESSAGE = {
  ar: "لا تتوفر لديّ معلومات موثوقة للإجابة على هذا السؤال ضمن المصادر التي تم جلبها من GBIF وويكيبيديا. لا أخترع معلومات علمية أو طبية. يمكنك السؤال عن: التصنيف العلمي، الانتشار الجغرافي، الأسماء الشائعة، وصف النبات، أو المرض المتوقع.",
  en: "I do not have reliable retrieved information for this question from the GBIF and Wikipedia sources used. I will not invent scientific or medical facts. You can ask about: taxonomy, geographic distribution, common names, plant description, or the predicted disease.",
};

export async function answerQuestion(
  question: string,
  lang: "ar" | "en",
  botanical: BotanicalInfo,
): Promise<QaAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      answer: UNAVAILABLE_MESSAGE[lang],
      mode: "unavailable",
      grounded: false,
      usedFacts: [],
      sources: [],
      notice: noticeText(lang),
    };
  }

  const isCareQuestion = includesAny(trimmed, CARE_KEYWORDS.ar) || includesAny(trimmed, CARE_KEYWORDS.en);
  const matchedIntents = INTENTS.filter(
    (intent) => includesAny(trimmed, intent.keywords.ar) || includesAny(trimmed, intent.keywords.en),
  );
  let keys = matchedIntents.flatMap((intent) => intent.keys);
  if (isCareQuestion) keys.push("disease");
  if (keys.length === 0) keys = ["cropArticle", "disease"];

  const facts = pickFacts(botanical, Array.from(new Set(keys)));
  const sources = Array.from(
    new Map(facts.filter((item) => item.source).map((item) => [item.source!.url, item.source!])).values(),
  );

  if (facts.length === 0 && !isCareQuestion) {
    return {
      answer: UNAVAILABLE_MESSAGE[lang],
      mode: "unavailable",
      grounded: false,
      usedFacts: [],
      sources: botanical.sources.slice(0, 4),
      notice: noticeText(lang),
    };
  }

  const llmAnswer = await tryLlm(trimmed, lang, botanical, facts, isCareQuestion);
  if (llmAnswer) {
    return {
      answer: llmAnswer,
      mode: "llm",
      grounded: true,
      usedFacts: facts.map((item) => item.key),
      sources,
      notice: noticeText(lang),
    };
  }

  const parts: string[] = [];
  for (const item of facts) {
    parts.push(item.text);
    if (item.source) parts.push(`(${item.source.label})`);
  }
  if (isCareQuestion) {
    parts.push(botanical.care.general.map((line) => `- ${line}`).join("\n"));
    parts.push(botanical.care.note[lang]);
  } else {
    parts.push(botanical.care.note[lang]);
  }

  return {
    answer: parts.filter(Boolean).join("\n\n"),
    mode: "retrieval",
    grounded: true,
    usedFacts: facts.map((item) => item.key),
    sources,
    notice: noticeText(lang),
  };
}

function noticeText(lang: "ar" | "en"): string {
  return lang === "ar"
    ? "الإجابات مبنية على النص المسترجع من المصادر المذكورة، وليست تشخيصًا أو نصيحة علاجية."
    : "Answers are composed from the retrieved text of the cited sources; they are not a diagnosis or treatment advice.";
}

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function llmConfig(): LlmConfig | null {
  const apiKey = process.env.PLANT_LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.PLANT_LLM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/+$/,
      "",
    ),
    model: process.env.PLANT_LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

async function tryLlm(
  question: string,
  lang: "ar" | "en",
  botanical: BotanicalInfo,
  facts: RetrievalFact[],
  isCareQuestion: boolean,
): Promise<string | null> {
  const config = llmConfig();
  if (!config) return null;

  const context = facts
    .map((item) => `[${item.key}] ${item.text}${item.source ? ` (source: ${item.source.label} - ${item.source.url})` : ""}`)
    .join("\n");
  const careContext = isCareQuestion
    ? `\nGENERAL CARE PRACTICES (not a prescription): ${botanical.care.general.join(" ")}`
    : "";
  const predicted = `${botanical.crop.english ?? "unknown"} / ${botanical.condition.english ?? "unknown"}`;

  const system =
    "You answer ONLY using the CONTEXT provided. If the context does not contain the answer, reply exactly with " +
    "NOT_AVAILABLE. Never invent scientific names, medical uses, toxicity or pesticide/treatment advice. " +
    "Keep the answer short and beginner friendly. Cite source labels inline in parentheses.";
  const user =
    `Predicted dataset category: ${predicted}\n` +
    `Answer language: ${lang === "ar" ? "Arabic" : "English"}\n` +
    `Question: ${question}\n\nCONTEXT:\n${context}${careContext}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content || content.includes("NOT_AVAILABLE")) return null;
    return content;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function llmEnabled(): boolean {
  return llmConfig() !== null;
}
