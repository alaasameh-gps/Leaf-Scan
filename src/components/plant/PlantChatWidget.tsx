"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Languages, Loader2, MessageCircle, Send, X } from "lucide-react";
import { askQuestion, type Lang, STRINGS } from "../../lib/plant/client";

interface ClassRow {
  id: string;
  cropEn: string | null;
  cropAr: string | null;
  conditionEn: string | null;
  conditionAr: string | null;
}

interface Props {
  /** Optional preselected class (e.g. last analysis). */
  classId?: string | null;
}

interface Exchange {
  role: "user" | "bot";
  text: string;
  sources?: Array<{ label: string; url: string }>;
}

const AR = {
  open: "اسأل المساعد النباتي",
  close: "إغلاق",
  title: "المساعد النباتي",
  subtitle: "اسأل عن المحصول أو المرض المختار",
  pickClass: "اختر المحصول/المرض",
  pickPlaceholder: "ابحث بالاسم...",
  noMatch: "لا توجد نتائج مطابقة",
  send: "إرسال",
  inputPlaceholder: "اكتب سؤالك هنا...",
  loading: "جاري التفكير...",
  needClass: "اختر أولاً المحصول أو المرض المرتبط بسؤالك.",
  clear: "مسح المحادثة",
};

const EN = {
  open: "Ask the plant assistant",
  close: "Close",
  title: "Plant assistant",
  subtitle: "Ask about the selected crop or disease",
  pickClass: "Select crop / disease",
  pickPlaceholder: "Search by name...",
  noMatch: "No matching results",
  send: "Send",
  inputPlaceholder: "Type your question...",
  loading: "Thinking...",
  needClass: "Select the crop or disease related to your question first.",
  clear: "Clear chat",
};

export default function PlantChatWidget({ classId: initialClassId }: Props) {
  const [lang, setLang] = useState<Lang>("ar");
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string | null>(initialClassId ?? null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const t = lang === "ar" ? AR : EN;
  const suggestions = STRINGS[lang].suggestions.slice(0, 3);

  useEffect(() => {
    if (!open || classes.length > 0) return;
    let cancelled = false;
    fetch("/api/plant/classes", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled || !payload?.data?.classes) return;
        const rows: ClassRow[] = payload.data.classes
          .filter((item: { isBackground: boolean }) => !item.isBackground)
          .map((item: ClassRow) => item);
        setClasses(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, classes.length]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading, open]);

  const label = (row: ClassRow) =>
    lang === "ar"
      ? [row.cropAr, row.conditionAr].filter(Boolean).join(" - ")
      : [row.cropEn, row.conditionEn].filter(Boolean).join(" - ");

  const filtered = classes.filter((row) => label(row).toLowerCase().includes(search.trim().toLowerCase()));

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    if (!classId) {
      setError(t.needClass);
      setPickerOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    try {
      const response = await askQuestion(classId, trimmed, lang);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: response.answer, sources: response.sources.map((s) => ({ label: s.label, url: s.url })) },
      ]);
      setQuestion("");
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t.close : t.open}
        className="fixed bottom-5 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl shadow-green-900/25 transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div className="fixed bottom-24 left-5 z-50 flex w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-2 border-b border-gray-100 bg-green-50 px-4 py-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <MessageCircle size={16} /> {t.title}
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500">{t.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
            >
              <Languages size={12} /> {lang === "ar" ? "EN" : "عربي"}
            </button>
          </header>

          <div className="relative border-b border-gray-100 px-3 py-2">
            <button
              type="button"
              onClick={() => setPickerOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              <span className="truncate">
                <span className="text-gray-400">{t.pickClass}: </span>
                {classId && classes.length > 0
                  ? label(classes.find((row) => row.id === classId) ?? ({ id: classId } as ClassRow))
                  : "—"}
              </span>
              <ChevronDown size={14} className={pickerOpen ? "rotate-180 transition" : "transition"} />
            </button>
            {pickerOpen && (
              <div className="absolute inset-x-3 top-full z-10 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.pickPlaceholder}
                  className="w-full border-b border-gray-100 px-3 py-2 text-xs outline-none"
                  autoFocus
                />
                <div className="max-h-44 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400">{t.noMatch}</p>
                  ) : (
                    filtered.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setClassId(row.id);
                          setPickerOpen(false);
                          setSearch("");
                          setError(null);
                        }}
                        className={
                          "block w-full px-3 py-2 text-right text-xs hover:bg-green-50 " +
                          (row.id === classId ? "bg-green-50 font-semibold text-green-800" : "text-gray-700")
                        }
                      >
                        {label(row)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3" style={{ maxHeight: 320 }}>
            {messages.length === 0 && !loading && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void submit(suggestion)}
                    disabled={loading}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed " +
                    (message.role === "user"
                      ? "bg-green-600 text-white"
                      : "border border-gray-200 bg-gray-50 text-gray-800")
                  }
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.sources.map((source, sourceIndex) => (
                        <a
                          key={sourceIndex}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-white px-1.5 py-0.5 text-[10px] text-indigo-700 underline"
                        >
                          {source.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  <Loader2 size={12} className="animate-spin" /> {t.loading}
                </div>
              </div>
            )}
          </div>

          {error && <p className="px-3 pb-1 text-[11px] text-red-600">{error}</p>}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(question);
            }}
            className="flex items-center gap-2 border-t border-gray-100 px-3 py-2"
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.inputPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-green-400"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label={t.send}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="border-t border-gray-100 py-1.5 text-[11px] text-gray-400 hover:text-gray-600"
            >
              {t.clear}
            </button>
          )}
        </div>
      )}
    </>
  );
}
