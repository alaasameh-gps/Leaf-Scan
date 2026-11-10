"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, History, Languages, Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import CameraCapture from "./CameraCapture";
import PlantResults from "./PlantResults";
import PlantChat from "./PlantChat";
import PlantChatWidget from "./PlantChatWidget";
import {
  analyzeImage,
  fetchHistory,
  STRINGS,
  type AnalysisResponse,
  type AnalyzeError,
  type HistoryItem,
  type Lang,
} from "../../lib/plant/client";

const MAX_CLIENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_CLIENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];

type Status = "idle" | "ready" | "analyzing" | "done" | "error";

export default function PlantAnalyzer() {
  const [lang, setLang] = useState<Lang>("ar");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<{ message: string; code?: string; status?: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyAuthRequired, setHistoryAuthRequired] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const t = STRINGS[lang];

  const loadHistory = useCallback(async () => {
    try {
      const result = await fetchHistory();
      setHistory(result.items);
      setHistoryAuthRequired(result.authRequired);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const acceptFile = (selected: File, url: string) => {
    setError(null);
    setAnalysis(null);
    setFile(selected);
    setPreviewUrl(url);
    setShowCamera(false);
    setStatus("ready");
  };

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!ALLOWED_CLIENT_TYPES.includes(selected.type)) {
      setError({
        message:
          lang === "ar"
            ? "النوع غير مدعوم. الصيغ المسموحة: JPEG, PNG, WebP, BMP."
            : "Unsupported type. Allowed formats: JPEG, PNG, WebP, BMP.",
        status: 415,
      });
      setStatus("error");
      return;
    }
    if (selected.size > MAX_CLIENT_BYTES) {
      setError({
        message:
          lang === "ar" ? "حجم الملف يتجاوز 8 ميجابايت." : "The file is larger than 8 MB.",
        status: 413,
      });
      setStatus("error");
      return;
    }
    acceptFile(selected, URL.createObjectURL(selected));
  };

  const runAnalysis = async () => {
    if (!file) return;
    setStatus("analyzing");
    setError(null);
    try {
      const data = await analyzeImage(file, file.name);
      setAnalysis(data);
      setStatus("done");
      void loadHistory();
    } catch (err) {
      const failure = err as AnalyzeError;
      setError({ message: failure.message, code: failure.code, status: failure.status });
      setStatus("error");
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const response = await fetch(`/api/plant/history?id=${id}`, { method: "DELETE" });
      if (response.ok) setHistory((items) => items.filter((item) => item.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
          <p className="mt-2 max-w-3xl text-gray-600 leading-relaxed">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Languages size={16} /> {lang === "ar" ? "English" : "العربية"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {lang === "ar" ? "1) اختر صورة" : "1) Choose an image"}
          </h2>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
            >
              <Upload size={18} /> {previewUrl ? t.replace : t.upload}
            </button>
            <button
              type="button"
              onClick={() => setShowCamera((value) => !value)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              {showCamera ? t.stopCamera : t.camera}
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                <X size={18} /> {t.replace}
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            capture="environment"
            onChange={onSelectFile}
            className="sr-only"
            aria-label={t.upload}
          />

          {showCamera && (
            <div className="mt-4">
              <CameraCapture
                lang={lang}
                onCapture={(captured, url) => acceptFile(captured, url)}
              />
            </div>
          )}

          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">{t.preview}</p>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={t.preview}
                className="w-full max-h-96 rounded-xl object-contain bg-gray-50 border border-gray-200"
              />
            ) : (
              <p className="text-sm text-gray-500">{t.idle}</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={!file || status === "analyzing"}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-white font-bold hover:bg-green-700 disabled:opacity-60"
            >
              {status === "analyzing" ? <Loader2 size={18} className="animate-spin" /> : null}
              {status === "analyzing" ? t.analyzing : t.analyze}
            </button>
            {status === "error" && file && (
              <button
                type="button"
                onClick={runAnalysis}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={16} /> {t.retry}
              </button>
            )}
          </div>

          {status === "analyzing" && (
            <p aria-live="polite" className="mt-3 text-sm text-indigo-700">
              {lang === "ar"
                ? "يتم رفع الصورة وتحليلها بواسطة نموذج التعلم العميق ثم جلب المعلومات النباتية..."
                : "Uploading, running deep-learning inference and retrieving botanical information..."}
            </p>
          )}

          {error && (
            <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle size={18} /> {t.error}
                {error.status ? ` (${error.status})` : ""}
              </p>
              <p className="mt-1">{error.message}</p>
              {error.code === "INFERENCE_UNAVAILABLE" && (
                <p className="mt-2 text-xs" dir="ltr">
                  py -3.12 -m uvicorn ml.service.app:app --host 127.0.0.1 --port 8000
                </p>
              )}
            </div>
          )}
        </section>

        <div>
          {analysis ? (
            <PlantResults analysis={analysis} lang={lang} />
          ) : (
            <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
              <p className="font-medium text-gray-800 mb-2">
                {lang === "ar" ? "2) اقرأ النتائج" : "2) Read the results"}
              </p>
              <p>
                {lang === "ar"
                  ? "بعد التحليل ستظهر هنا الفئة المتوقعة، التوقعات البديلة، درجة الثقة، والمعلومات النباتية الموثقة مع روابط المصادر."
                  : "After analysis this panel shows the predicted category, alternative predictions, the confidence score and sourced botanical information with links."}
              </p>
            </section>
          )}
          <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed">
            {t.limitations}
          </p>
        </div>
      </div>

      {analysis?.classId && analysis.botanical && !analysis.botanical.isBackground && (
        <PlantChat classId={analysis.classId} lang={lang} />
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <History size={18} /> {t.historyTitle}
        </h2>
        {historyAuthRequired ? (
          <p className="text-sm text-gray-600">
            {t.historyLogin}{" "}
            <a className="text-indigo-700 underline" href="/login">
              {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
            </a>
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">{t.historyEmpty}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-900" dir="ltr">
                    {item.displayName ?? item.classId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")} —{" "}
                    <span dir="ltr">{(item.confidence * 100).toFixed(1)}%</span>
                    {!item.confident && ` (${lang === "ar" ? "ثقة منخفضة" : "low confidence"})`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteHistoryItem(item.id)}
                  className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                  aria-label={lang === "ar" ? "حذف" : "Delete"}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PlantChatWidget classId={analysis?.classId ?? null} />
    </div>
  );
}
