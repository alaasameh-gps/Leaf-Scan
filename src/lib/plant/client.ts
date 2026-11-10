export type Lang = "ar" | "en";

export interface ApiPrediction {
  class_name: string;
  display_name: string;
  crop: string | null;
  condition: string | null;
  is_healthy: boolean;
  is_background: boolean;
  score: number;
  rank: number;
}

export interface ApiSource {
  label: string;
  url: string;
  via: string;
}

export interface ApiBotanical {
  classId: string;
  isBackground: boolean;
  crop: { english: string | null; arabic: string | null };
  condition: { english: string | null; arabic: string | null; type: string; typeLabel: { ar: string; en: string } };
  taxonomy: {
    queriedName: string | null;
    acceptedName: string | null;
    rank: string | null;
    status: string | null;
    kingdom: string | null;
    phylum: string | null;
    class: string | null;
    order: string | null;
    family: string | null;
    genus: string | null;
    species: string | null;
    gbifKey: number | null;
    gbifUrl: string | null;
    matchType: string | null;
    confidence: number | null;
  } | null;
  commonNames: { english: string[]; arabic: string[] };
  description: { text: string; source: ApiSource | null } | null;
  distribution: { summary: string | null; regions: string[]; occurrenceRecords: number | null } | null;
  cropArticle: { title: string; extract: string; url: string } | null;
  disease: { name: string; article: { title: string; extract: string; url: string } | null } | null;
  care: { general: string[]; note: { ar: string; en: string } };
  sources: ApiSource[];
  unavailable: string[];
}

export interface AnalysisResponse {
  classId: string | null;
  displayName: string | null;
  confidence: number;
  confident: boolean;
  predictions: ApiPrediction[];
  warnings: string[];
  modelInfo: { arch?: string; num_classes?: number; trained_on?: Record<string, number> } | null;
  modelMetrics: Record<string, number> | null;
  botanical: ApiBotanical | null;
  botanicalError: string | null;
  analyzedAt: string;
}

export interface QaResponse {
  answer: string;
  mode: "retrieval" | "llm" | "unavailable";
  grounded: boolean;
  usedFacts: string[];
  sources: ApiSource[];
  notice: string;
  llmEnabled: boolean;
}

export interface HistoryItem {
  id: string;
  classId: string;
  displayName: string | null;
  cropAr: string | null;
  cropEn: string | null;
  conditionAr: string | null;
  conditionEn: string | null;
  confidence: number;
  confident: boolean;
  createdAt: string;
}

export interface AnalyzeError {
  message: string;
  code?: string;
  status: number;
}

export async function analyzeImage(file: Blob, fileName = "upload.jpg"): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("image", file, fileName);
  const response = await fetch("/api/plant/analyze", { method: "POST", body: form });
  const payload = (await response.json().catch(() => null)) as
    | { success: boolean; data?: AnalysisResponse; message?: string; code?: string }
    | null;
  if (!response.ok || !payload?.success || !payload.data) {
    const error: AnalyzeError = {
      message: payload?.message ?? `Analysis failed with status ${response.status}`,
      code: payload?.code,
      status: response.status,
    };
    throw error;
  }
  return payload.data;
}

export async function askQuestion(classId: string, question: string, lang: Lang): Promise<QaResponse> {
  const response = await fetch("/api/plant/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classId, question, lang }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { success: boolean; data?: QaResponse; message?: string }
    | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.message ?? "Could not get an answer.");
  }
  return payload.data;
}

export async function fetchHistory(): Promise<{ items: HistoryItem[]; authRequired: boolean }> {
  const response = await fetch("/api/plant/history", { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as
    | { success: boolean; data?: { items: HistoryItem[] } }
    | null;
  if (response.status === 401) return { items: [], authRequired: true };
  if (!response.ok || !payload?.success || !payload.data) return { items: [], authRequired: false };
  return { items: payload.data.items, authRequired: false };
}

export async function searchBotanical(query: string): Promise<{
  taxonomy: ApiBotanical["taxonomy"];
  commonNames: { english: string[]; arabic: string[] };
  article: { title: string; extract: string; url: string } | null;
  sources: ApiSource[];
  unavailable: string[];
}> {
  const response = await fetch(`/api/plant/botanical?q=${encodeURIComponent(query)}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as
    | {
        success: boolean;
        data?: {
          taxonomy: ApiBotanical["taxonomy"];
          commonNames: { english: string[]; arabic: string[] };
          article: { title: string; extract: string; url: string } | null;
          sources: ApiSource[];
          unavailable: string[];
        };
        message?: string;
      }
    | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.message ?? "Search failed.");
  }
  return payload.data;
}

export const STRINGS = {
  ar: {
    title: "تحليل أمراض أوراق النبات",
    subtitle:
      "ارفع صورة ورقة نبات أو التقط صورة بالكاميرا، وسيقوم النموذج بتحديد الفئة المتوقعة من 39 فئة تدريبية، مع معلومات نباتية موثقة من GBIF وويكيبيديا.",
    upload: "رفع صورة",
    camera: "التقاط صورة",
    replace: "تغيير الصورة",
    retake: "إعادة التصوير",
    analyze: "تحليل الصورة",
    analyzing: "جارٍ تحليل الصورة...",
    idle: "لم يتم اختيار صورة بعد.",
    preview: "معاينة الصورة",
    stopCamera: "إيقاف الكاميرا",
    capture: "التقاط",
    results: "النتائج",
    topPrediction: "التوقع الأعلى",
    alternatives: "توقعات بديلة",
    confidence: "درجة ثقة النموذج",
    warnings: "تحذيرات مهمة",
    botanical: "المعلومات النباتية",
    taxonomy: "التصنيف العلمي",
    commonNames: "الأسماء الشائعة",
    description: "وصف نباتي",
    distribution: "الانتشار الجغرافي",
    diseaseInfo: "معلومات المرض",
    care: "العناية والوقاية",
    sources: "المصادر",
    unavailable: "غير متوفر",
    askTitle: "اسأل عن النبات أو المرض",
    askPlaceholder: "مثال: ما هي أعراض المرض المتوقع؟",
    ask: "اسأل",
    asking: "جارٍ تجهيز الإجابة...",
    historyTitle: "سجل التحليلات",
    historyEmpty: "لا يوجد سجل بعد.",
    historyLogin: "سجّل الدخول لحفظ سجل التحليلات.",
    retry: "إعادة المحاولة",
    error: "حدث خطأ",
    noModel: "خدمة التحليل غير متوفرة حاليًا.",
    limitations:
      "تنبيه: هذه توقعات نموذج تعلم آلي على 39 فئة من مجموعة بيانات محددة، وليست تشخيصًا مؤكدًا ولا توصية علاجية. النموذج لا يحدد كل أنواع النباتات في العالم. لا تستخدم النتائج لاتخاذ قرارات بشأن المبيدات أو العلاج دون استشارة مختص.",
    suggestions: [
      "ما هو التصنيف العلمي لهذا النبات؟",
      "ما مدى انتشاره الجغرافي؟",
      "ما هي أعراض المرض المتوقع؟",
      "كيف أعتني بالنبات وأمنع انتشار المرض؟",
    ],
  },
  en: {
    title: "Plant leaf disease analysis",
    subtitle:
      "Upload a leaf photo or take one with your camera. The model predicts one of 39 training categories and adds sourced botanical information from GBIF and Wikipedia.",
    upload: "Upload image",
    camera: "Use camera",
    replace: "Replace image",
    retake: "Retake",
    analyze: "Analyze image",
    analyzing: "Analyzing image...",
    idle: "No image selected yet.",
    preview: "Image preview",
    stopCamera: "Stop camera",
    capture: "Capture",
    results: "Results",
    topPrediction: "Top prediction",
    alternatives: "Alternative predictions",
    confidence: "Model confidence",
    warnings: "Important notes",
    botanical: "Botanical information",
    taxonomy: "Taxonomic classification",
    commonNames: "Common names",
    description: "Botanical description",
    distribution: "Geographic distribution",
    diseaseInfo: "Disease information",
    care: "Care and prevention",
    sources: "Sources",
    unavailable: "Not available",
    askTitle: "Ask about the plant or disease",
    askPlaceholder: "e.g. What are the symptoms of the predicted disease?",
    ask: "Ask",
    asking: "Preparing the answer...",
    historyTitle: "Analysis history",
    historyEmpty: "No history yet.",
    historyLogin: "Sign in to save your analysis history.",
    retry: "Retry",
    error: "Something went wrong",
    noModel: "The analysis service is currently unavailable.",
    limitations:
      "Note: these are machine-learning predictions over 39 categories from one specific dataset, not a confirmed diagnosis and not treatment advice. The model does not identify every plant species in the world. Do not use the result for pesticide or treatment decisions without expert advice.",
    suggestions: [
      "What is the scientific classification of this plant?",
      "Where is it naturally distributed?",
      "What are the symptoms of the predicted disease?",
      "How do I care for the plant and prevent spread?",
    ],
  },
} as const;
