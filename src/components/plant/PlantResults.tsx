"use client";
import React from "react";
import { AlertTriangle, BookOpen, FlaskConical, Leaf, MapPin, ShieldCheck } from "lucide-react";
import type { AnalysisResponse, ApiBotanical, Lang } from "../../lib/plant/client";
import { STRINGS } from "../../lib/plant/client";

interface Props {
  analysis: AnalysisResponse;
  lang: Lang;
}

const CONFIDENCE_LABEL = {
  ar: { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" },
  en: { high: "high", medium: "medium", low: "low" },
};

function confidenceBand(value: number, lang: Lang): string {
  const labels = CONFIDENCE_LABEL[lang];
  if (value >= 0.75) return labels.high;
  if (value >= 0.45) return labels.medium;
  return labels.low;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function SourceList({ botanical, lang }: { botanical: ApiBotanical; lang: Lang }) {
  if (botanical.sources.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="font-bold text-gray-900 mb-2">{STRINGS[lang].sources}</h3>
      <ul className="space-y-1 text-sm">
        {botanical.sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-700 underline break-all"
            >
              {source.label}
            </a>{" "}
            <span className="text-gray-500">({source.via})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaxonomyTable({ botanical, lang }: { botanical: ApiBotanical; lang: Lang }) {
  const taxonomy = botanical.taxonomy;
  if (!taxonomy) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        {STRINGS[lang].unavailable}: {lang === "ar" ? "لم يتم العثور على تصنيف في GBIF." : "No GBIF match was found."}
      </p>
    );
  }
  const rows: Array<[string, string | null]> = [
    [lang === "ar" ? "الاسم المقبول" : "Accepted name", taxonomy.acceptedName],
    [lang === "ar" ? "المرتبة" : "Rank", taxonomy.rank],
    [lang === "ar" ? "الحالة" : "Status", taxonomy.status],
    [lang === "ar" ? "المملكة" : "Kingdom", taxonomy.kingdom],
    [lang === "ar" ? "الشعبة" : "Phylum", taxonomy.phylum],
    [lang === "ar" ? "الطائفة" : "Class", taxonomy.class],
    [lang === "ar" ? "الرتبة" : "Order", taxonomy.order],
    [lang === "ar" ? "الفصيلة" : "Family", taxonomy.family],
    [lang === "ar" ? "الجنس" : "Genus", taxonomy.genus],
    [lang === "ar" ? "النوع" : "Species", taxonomy.species],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="odd:bg-gray-50">
              <th scope="row" className="text-right px-3 py-2 font-medium text-gray-600 w-40">
                {label}
              </th>
              <td dir="ltr" className="px-3 py-2 text-gray-900">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {taxonomy.gbifUrl && (
        <p className="mt-2 text-xs text-gray-500">
          {lang === "ar" ? "المصدر: GBIF" : "Source: GBIF"} —{" "}
          <a dir="ltr" className="text-indigo-700 underline" href={taxonomy.gbifUrl} target="_blank" rel="noopener noreferrer">
            {taxonomy.gbifUrl}
          </a>
          {taxonomy.matchType ? ` (${taxonomy.matchType}, ${taxonomy.confidence ?? 0}%)` : ""}
        </p>
      )}
    </div>
  );
}

export default function PlantResults({ analysis, lang }: Props) {
  const t = STRINGS[lang];
  const top = analysis.predictions[0];
  const botanical = analysis.botanical;
  const confidence = top?.score ?? analysis.confidence;
  const band = confidenceBand(confidence, lang);

  return (
    <div className="space-y-6">
      <section aria-labelledby="prediction-heading" className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 id="prediction-heading" className="text-xl font-bold text-gray-900 mb-4">
          {t.results}
        </h2>

        {top ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">{t.topPrediction}</p>
              <p className="text-lg font-bold text-gray-900" dir="ltr">
                {top.display_name}
              </p>
              {botanical && (
                <p className="text-sm text-gray-600 mt-1">
                  {lang === "ar"
                    ? `${botanical.crop.arabic ?? ""} — ${botanical.condition.arabic ?? ""}`
                    : `${botanical.crop.english ?? ""} — ${botanical.condition.english ?? ""}`}
                </p>
              )}
              <p className="mt-2 text-sm font-medium text-gray-800">
                {t.confidence}: <span dir="ltr">{percent(confidence)}</span>{" "}
                <span className="text-gray-500">
                  ({lang === "ar" ? "ثقة" : "confidence"} {band})
                </span>
              </p>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200" role="img" aria-label={`${t.confidence} ${percent(confidence)}`}>
                <div
                  className={`h-full ${confidence >= 0.75 ? "bg-green-500" : confidence >= 0.45 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, Math.max(2, confidence * 100))}%` }}
                />
              </div>
              {!analysis.confident && (
                <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  {lang === "ar"
                    ? "الثقة منخفضة: النتيجة غير موثوقة وقد تكون الصورة خارج الفئات المدعومة."
                    : "Low confidence: the result is not reliable and the image may be outside the supported categories."}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">{t.alternatives}</p>
              <ul className="space-y-2">
                {analysis.predictions.slice(1).map((item) => (
                  <li key={item.class_name}>
                    <div className="flex items-center justify-between text-sm">
                      <span dir="ltr" className="text-gray-800">
                        {item.display_name}
                      </span>
                      <span dir="ltr" className="text-gray-500">
                        {percent(item.score)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full bg-indigo-400" style={{ width: `${Math.min(100, item.score * 100)}%` }} />
                    </div>
                  </li>
                ))}
                {analysis.predictions.length < 2 && (
                  <li className="text-sm text-gray-500">{t.unavailable}</li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">{t.unavailable}</p>
        )}

        {analysis.warnings.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-2 font-medium text-amber-900">
              <AlertTriangle size={18} /> {t.warnings}
            </p>
            <ul className="mt-2 list-disc ps-5 text-sm text-amber-900 space-y-1">
              {analysis.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {analysis.modelInfo && (
          <p className="mt-3 text-xs text-gray-500" dir="ltr">
            model: {analysis.modelInfo.arch} | classes: {analysis.modelInfo.num_classes} |
            {analysis.modelMetrics?.f1_macro !== undefined
              ? ` val_macro_f1: ${Number(analysis.modelMetrics.f1_macro).toFixed(3)} |`
              : ""}{" "}
            trained_on: {analysis.modelInfo.trained_on?.train_images ?? "?"} images
          </p>
        )}
      </section>

      {botanical && !botanical.isBackground && (
        <section aria-labelledby="botanical-heading" className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 id="botanical-heading" className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Leaf size={20} /> {t.botanical}
          </h2>

          <div className="grid gap-6">
            <div>
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FlaskConical size={18} /> {t.taxonomy}
              </h3>
              <TaxonomyTable botanical={botanical} lang={lang} />
            </div>

            {(botanical.commonNames.english.length > 0 || botanical.commonNames.arabic.length > 0) && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2">{t.commonNames}</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {botanical.commonNames.english.length > 0 && (
                    <li dir="ltr">EN: {botanical.commonNames.english.join(", ")}</li>
                  )}
                  {botanical.commonNames.arabic.length > 0 && <li>AR: {botanical.commonNames.arabic.join("، ")}</li>}
                </ul>
              </div>
            )}

            {botanical.description && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2">{t.description}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{botanical.description.text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {lang === "ar" ? "المصدر" : "Source"}:{" "}
                  {botanical.description.source && (
                    <a
                      className="underline text-indigo-700 break-all"
                      href={botanical.description.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {botanical.description.source.label}
                    </a>
                  )}
                </p>
              </div>
            )}

            {botanical.distribution && (botanical.distribution.regions.length > 0 || botanical.distribution.occurrenceRecords) && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <MapPin size={18} /> {t.distribution}
                </h3>
                {botanical.distribution.summary && (
                  <p className="text-sm text-gray-700" dir="ltr">
                    {botanical.distribution.summary}
                  </p>
                )}
                {botanical.distribution.occurrenceRecords !== null && (
                  <p className="text-sm text-gray-700">
                    {lang === "ar" ? "عدد سجلات الرصد في GBIF" : "GBIF occurrence records"}:{" "}
                    <span dir="ltr">{botanical.distribution.occurrenceRecords.toLocaleString()}</span>
                  </p>
                )}
                {botanical.distribution.regions.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1" dir="ltr">
                    {botanical.distribution.regions.join(" • ")}
                  </p>
                )}
              </div>
            )}

            {botanical.cropArticle && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <BookOpen size={18} /> {lang === "ar" ? "نبذة عن النبات" : "About the plant"}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{botanical.cropArticle.extract}</p>
                <a
                  className="text-xs underline text-indigo-700 break-all"
                  href={botanical.cropArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {botanical.cropArticle.url}
                </a>
              </div>
            )}

            {botanical.disease && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2">{t.diseaseInfo}</h3>
                <p className="text-sm text-gray-700">
                  {lang === "ar" ? "الفئة المتوقعة" : "Predicted category"}:{" "}
                  {lang === "ar" ? botanical.condition.arabic : botanical.condition.english}{" "}
                  ({botanical.condition.typeLabel[lang]})
                </p>
                {botanical.disease.article ? (
                  <>
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed" dir="ltr">
                      <strong>{botanical.disease.article.title}:</strong> {botanical.disease.article.extract}
                    </p>
                    <a
                      className="text-xs underline text-indigo-700 break-all"
                      href={botanical.disease.article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {botanical.disease.article.url}
                    </a>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">{t.unavailable}</p>
                )}
              </div>
            )}

            {botanical.care.general.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <ShieldCheck size={18} /> {t.care}
                </h3>
                <ul className="list-disc ps-5 text-sm text-gray-700 space-y-1">
                  {botanical.care.general.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-gray-500">{botanical.care.note[lang]}</p>
              </div>
            )}

            {botanical.unavailable.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-700">{t.unavailable}</p>
                <ul className="mt-1 list-disc ps-5 text-xs text-gray-600 space-y-1">
                  {botanical.unavailable.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <SourceList botanical={botanical} lang={lang} />
          </div>
        </section>
      )}

      {analysis.botanicalError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{analysis.botanicalError}</p>
      )}
    </div>
  );
}
