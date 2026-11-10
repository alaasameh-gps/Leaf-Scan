"use client";
import React, { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { askQuestion, type Lang, STRINGS } from "../../lib/plant/client";

interface Props {
  classId: string;
  lang: Lang;
}

interface Exchange {
  question: string;
  answer: string;
  mode: string;
  notice: string;
  sources: Array<{ label: string; url: string; via: string }>;
}

export default function PlantChat({ classId, lang }: Props) {
  const t = STRINGS[lang];
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await askQuestion(classId, trimmed, lang);
      setExchanges((previous) => [
        ...previous,
        {
          question: trimmed,
          answer: response.answer,
          mode: response.mode,
          notice: response.notice,
          sources: response.sources,
        },
      ]);
      setQuestion("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="qa-heading" className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 id="qa-heading" className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
        <MessageCircle size={20} /> {t.askTitle}
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        {lang === "ar"
          ? "يتم توليد الإجابات من نصوص مسترجعة من المصادر المذكورة. عند تعطيل مساعد الذكاء الاصطناعي الاختياري تُعاد النصوص المسترجعة كما هي."
          : "Answers are composed from the retrieved source texts. With the optional AI assistant disabled, the retrieved texts are returned verbatim."}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {t.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => submit(suggestion)}
            disabled={loading}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(question);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <label className="sr-only" htmlFor="plant-question">
          {t.askTitle}
        </label>
        <input
          id="plant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t.askPlaceholder}
          maxLength={500}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Send size={16} /> {loading ? t.asking : t.ask}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {exchanges.length > 0 && (
        <ul className="mt-4 space-y-4" aria-live="polite">
          {exchanges.map((exchange, index) => (
            <li key={`${exchange.question}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="font-medium text-gray-900">{exchange.question}</p>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{exchange.answer}</p>
              <p className="mt-2 text-xs text-gray-500">
                {lang === "ar" ? "الوضع" : "Mode"}: <span dir="ltr">{exchange.mode}</span> — {exchange.notice}
              </p>
              {exchange.sources.length > 0 && (
                <ul className="mt-2 text-xs">
                  {exchange.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        className="text-indigo-700 underline break-all"
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
