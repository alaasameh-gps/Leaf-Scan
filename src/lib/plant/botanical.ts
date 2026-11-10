/**
 * Botanical information layer.
 *
 * Turns a predicted dataset label into sourced botanical information:
 *   - taxonomy and native distribution come from GBIF (documented OpenAPI),
 *   - descriptive text comes from citable Wikipedia summaries,
 *   - POWO is offered as an outbound manual lookup because it has no public API,
 *   - general care guidance is generic integrated-pest-management advice.
 *
 * Nothing here is asserted from memory: every factual field is either retrieved
 * live or explicitly reported as unavailable.
 */

import { CONDITION_TYPE_LABEL, PlantClassInfo, getClassInfo, generalCareGuidance } from "./classes";
import { cached } from "./http";
import {
  GbifDistribution,
  GbifMatch,
  gbifSpeciesUrl,
  getDescriptions,
  getDistributions,
  getOccurrenceCount,
  getVernacularNames,
  matchTaxon,
} from "./gbif";
import { WikiArticle, findArticle, powoSearchUrl } from "./wikipedia";

export interface SourceRef {
  label: string;
  url: string;
  via: "GBIF" | "Wikipedia" | "Kew POWO" | "Dataset";
}

export interface RetrievalFact {
  key: string;
  label: { ar: string; en: string };
  text: string;
  source: SourceRef | null;
}

export interface BotanicalInfo {
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
  description: { text: string; source: SourceRef | null } | null;
  distribution: { summary: string | null; regions: string[]; occurrenceRecords: number | null } | null;
  cropArticle: WikiArticle | null;
  disease: { name: string; article: WikiArticle | null } | null;
  care: { general: string[]; note: { ar: string; en: string } };
  sources: SourceRef[];
  unavailable: string[];
  facts: RetrievalFact[];
}

const USE_KEYWORDS = [
  "used as",
  "used for",
  "cultivated for",
  "edible",
  "food",
  "medicine",
  "medicinal",
  "crop",
  "livestock",
  "timber",
];

const DISTRIBUTION_KEYWORDS = ["native", "around the world", "distributed", "origin", "cultivated in", "grown in"];

function sentencesMatching(text: string, keywords: string[], limit: number): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30 && sentence.length < 400);
  const matched = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });
  return matched.slice(0, limit);
}

function fact(
  key: string,
  label: { ar: string; en: string },
  text: string,
  source: SourceRef | null,
): RetrievalFact {
  return { key, label, text, source };
}

async function resolveTaxonomy(info: PlantClassInfo): Promise<{ match: GbifMatch | null; source: SourceRef | null }> {
  const candidates = [info.scientificName, info.fallbackGenus].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const match = await matchTaxon(candidate);
      if (match) {
        return {
          match,
          source: { label: `GBIF - ${match.scientificName ?? candidate}`, url: gbifSpeciesUrl(match.usageKey), via: "GBIF" },
        };
      }
    } catch {
      continue;
    }
  }
  return { match: null, source: null };
}

export async function buildBotanicalInfo(classId: string, lang: "ar" | "en" = "ar"): Promise<BotanicalInfo> {
  const info = getClassInfo(classId);
  const unavailable: string[] = [];

  if (!info) {
    return {
      classId,
      isBackground: false,
      crop: { english: null, arabic: null },
      condition: { english: null, arabic: null, type: "unknown", typeLabel: CONDITION_TYPE_LABEL.unknown },
      taxonomy: null,
      commonNames: { english: [], arabic: [] },
      description: null,
      distribution: null,
      cropArticle: null,
      disease: null,
      care: { general: generalCareGuidance(lang), note: careNote() },
      sources: [],
      unavailable: ["This label is not part of the 39 supported dataset categories."],
      facts: [],
    };
  }

  if (info.isBackground) {
    return {
      classId,
      isBackground: true,
      crop: { english: null, arabic: null },
      condition: { english: null, arabic: null, type: "background", typeLabel: CONDITION_TYPE_LABEL.background },
      taxonomy: null,
      commonNames: { english: [], arabic: [] },
      description: null,
      distribution: null,
      cropArticle: null,
      disease: null,
      care: { general: [], note: careNote() },
      sources: [],
      unavailable: [
        "The model classified the image as background (no leaf), so no botanical information is attached.",
      ],
      facts: [],
    };
  }

  const sources: SourceRef[] = [
    {
      label: "Dataset: Mendeley, Identification of Plant Leaf Diseases Using a 9-layer DCNN",
      url: "https://data.mendeley.com/datasets/tywbtsjrjv/1",
      via: "Dataset",
    },
  ];
  const facts: RetrievalFact[] = [];

  const [{ match, source: taxonomySource }, cropArticle, diseaseArticle] = await Promise.all([
    resolveTaxonomy(info),
    findArticle(`${info.scientificName ?? info.cropEn} plant`, "en"),
    info.diseaseSearchTerm ? findArticle(info.diseaseSearchTerm, "en") : Promise.resolve(null),
  ]);

  let taxonomy: BotanicalInfo["taxonomy"] = null;
  let commonNames = { english: [] as string[], arabic: [] as string[] };
  let description: BotanicalInfo["description"] = null;
  let distribution: BotanicalInfo["distribution"] = null;

  if (match) {
    taxonomy = {
      queriedName: info.scientificName ?? info.fallbackGenus,
      acceptedName: match.scientificName,
      rank: match.rank,
      status: match.status,
      kingdom: match.kingdom,
      phylum: match.phylum,
      class: match.class,
      order: match.order,
      family: match.family,
      genus: match.genus,
      species: match.species,
      gbifKey: match.usageKey,
      gbifUrl: gbifSpeciesUrl(match.usageKey),
      matchType: match.matchType,
      confidence: match.confidence,
    };
    if (taxonomySource) sources.push(taxonomySource);
    facts.push(
      fact(
        "taxonomy",
        { ar: "التصنيف العلمي", en: "Taxonomic classification" },
        `Accepted name: ${match.scientificName ?? "unknown"}; family: ${match.family ?? "unknown"}; genus: ${
          match.genus ?? "unknown"
        }; order: ${match.order ?? "unknown"}; rank: ${match.rank ?? "unknown"}; status: ${match.status ?? "unknown"}.`,
        taxonomySource,
      ),
    );

    const [vernacular, descriptions, distributions, occurrenceCount] = await Promise.all([
      getVernacularNames(match.usageKey),
      getDescriptions(match.usageKey),
      getDistributions(match.usageKey),
      getOccurrenceCount(match.usageKey),
    ]);
    commonNames = vernacular;

    const primaryDescription = descriptions[0];
    if (primaryDescription) {
      // GBIF's `source` is often a human label, not a URL. Only use it as a link
      // when it really is one; otherwise fall back to the GBIF species page.
      const sourceLabel = (primaryDescription.source ?? "").trim();
      const sourceUrl = /^https?:\/\//i.test(sourceLabel)
        ? sourceLabel
        : (taxonomySource?.url ?? gbifSpeciesUrl(match.usageKey));
      description = {
        text: primaryDescription.description,
        source: { label: sourceLabel || taxonomySource?.label || `GBIF - ${match.scientificName ?? "match"}`, url: sourceUrl, via: "GBIF" },
      };
      facts.push(
        fact("description", { ar: "وصف نباتي", en: "Botanical description" }, primaryDescription.description, description.source),
      );
    }

    const regions = Array.from(
      new Set(
        distributions
          .map((item: GbifDistribution) => item.locality || item.country)
          .filter((value): value is string => Boolean(value))
          // GBIF sometimes packs a whole free-text list into a single locality;
          // those are not place names, so keep only short, name-like values.
          .map((value: string) => value.trim())
          .filter((value: string) => value.length > 0 && value.length <= 60),
      ),
    ).slice(0, 15);
    const nativeCount = distributions.filter((item) => item.establishmentMeans === "NATIVE").length;
    if (regions.length || occurrenceCount !== null) {
      distribution = {
        summary:
          regions.length > 0
            ? `GBIF lists ${distributions.length} distribution record(s)${
                nativeCount > 0 ? `, ${nativeCount} recorded as native` : ""
              }.`
            : null,
        regions,
        occurrenceRecords: occurrenceCount,
      };
      facts.push(
        fact(
          "distribution",
          { ar: "الانتشار الجغرافي", en: "Geographic distribution" },
          `${distribution.summary ?? ""} ${regions.length ? `Regions: ${regions.join(", ")}.` : ""} ${
            occurrenceCount !== null ? `GBIF occurrence records: ${occurrenceCount}.` : ""
          }`.trim(),
          taxonomySource,
        ),
      );
    }
    if (commonNames.english.length || commonNames.arabic.length) {
      facts.push(
        fact(
          "commonNames",
          { ar: "الأسماء الشائعة", en: "Common names" },
          `English: ${commonNames.english.join(", ") || "n/a"}; Arabic: ${commonNames.arabic.join(", ") || "n/a"}.`,
          taxonomySource,
        ),
      );
    }
  } else {
    unavailable.push(
      "The plant name could not be matched in GBIF, so taxonomy and distribution are not shown.",
    );
  }

  if (cropArticle) {
    sources.push({ label: `Wikipedia - ${cropArticle.title}`, url: cropArticle.url, via: "Wikipedia" });
    const uses = sentencesMatching(cropArticle.extract, USE_KEYWORDS, 2);
    const habitat = sentencesMatching(cropArticle.extract, DISTRIBUTION_KEYWORDS, 2);
    facts.push(
      fact(
        "cropArticle",
        { ar: "نبذة من ويكيبيديا", en: "Wikipedia summary" },
        cropArticle.extract,
        { label: `Wikipedia - ${cropArticle.title}`, url: cropArticle.url, via: "Wikipedia" },
      ),
    );
    if (uses.length) {
      facts.push(
        fact("uses", { ar: "استخدامات مذكورة", en: "Reported uses" }, uses.join(" "), {
          label: `Wikipedia - ${cropArticle.title}`,
          url: cropArticle.url,
          via: "Wikipedia",
        }),
      );
    }
    if (habitat.length) {
      facts.push(
        fact("habitat", { ar: "الموطن والانتشار", en: "Habitat and distribution" }, habitat.join(" "), {
          label: `Wikipedia - ${cropArticle.title}`,
          url: cropArticle.url,
          via: "Wikipedia",
        }),
      );
    }
  } else {
    unavailable.push("No Wikipedia summary was found for the crop.");
  }

  let disease: BotanicalInfo["disease"] = null;
  if (info.diseaseSearchTerm) {
    if (diseaseArticle) {
      sources.push({ label: `Wikipedia - ${diseaseArticle.title}`, url: diseaseArticle.url, via: "Wikipedia" });
      facts.push(
        fact(
          "disease",
          { ar: "معلومات عن المرض", en: "Disease information" },
          `${diseaseArticle.title}: ${diseaseArticle.extract}`,
          { label: `Wikipedia - ${diseaseArticle.title}`, url: diseaseArticle.url, via: "Wikipedia" },
        ),
      );
    } else {
      unavailable.push("No citable article was found for this disease category.");
    }
    disease = { name: info.conditionEn ?? classId, article: diseaseArticle };
  }

  if (info.scientificName) {
    sources.push({
      label: `Kew POWO - search ${info.scientificName}`,
      url: powoSearchUrl(info.scientificName),
      via: "Kew POWO",
    });
  }

  return {
    classId,
    isBackground: false,
    crop: { english: info.cropEn, arabic: info.cropAr },
    condition: {
      english: info.conditionEn,
      arabic: info.conditionAr,
      type: info.conditionType,
      typeLabel: CONDITION_TYPE_LABEL[info.conditionType],
    },
    taxonomy,
    commonNames,
    description,
    distribution,
    cropArticle,
    disease,
    care: {
      general: generalCareGuidance(lang),
      note: careNote(),
    },
    sources,
    unavailable,
    facts,
  };
}

function careNote(): { ar: string; en: string } {
  return {
    ar: "هذه إرشادات عامة للممارسات الزراعية الجيدة وليست وصفة علاج. لا تعتمد على تنبؤ الذكاء الاصطناعي في قرارات العلاج، واستشر جهة إرشاد زراعي معتمدة.",
    en: "These are general good-practice tips, not a treatment prescription. Do not base treatment decisions on an AI prediction; consult a certified agricultural extension service.",
  };
}

export interface BotanicalSearchResult {
  query: string;
  taxonomy: BotanicalInfo["taxonomy"];
  commonNames: { english: string[]; arabic: string[] };
  article: WikiArticle | null;
  sources: SourceRef[];
  unavailable: string[];
}

/** Cached wrapper: several routes need the same class info within a short period. */
export async function getBotanicalInfoCached(classId: string, lang: "ar" | "en" = "ar"): Promise<BotanicalInfo> {
  return cached(`botanical:${classId}:${lang}`, 1000 * 60 * 60, () => buildBotanicalInfo(classId, lang));
}

/** Name search used by the "plant / disease search" endpoint. */
export async function searchBotanical(query: string): Promise<BotanicalSearchResult> {
  const trimmed = query.trim();
  const sources: SourceRef[] = [];
  const unavailable: string[] = [];

  const [match, article] = await Promise.all([
    matchTaxon(trimmed).catch(() => null),
    findArticle(trimmed, "en").catch(() => null),
  ]);

  let commonNames = { english: [] as string[], arabic: [] as string[] };
  let taxonomy: BotanicalInfo["taxonomy"] = null;

  if (match) {
    taxonomy = {
      queriedName: trimmed,
      acceptedName: match.scientificName,
      rank: match.rank,
      status: match.status,
      kingdom: match.kingdom,
      phylum: match.phylum,
      class: match.class,
      order: match.order,
      family: match.family,
      genus: match.genus,
      species: match.species,
      gbifKey: match.usageKey,
      gbifUrl: gbifSpeciesUrl(match.usageKey),
      matchType: match.matchType,
      confidence: match.confidence,
    };
    sources.push({
      label: `GBIF - ${match.scientificName ?? trimmed}`,
      url: gbifSpeciesUrl(match.usageKey),
      via: "GBIF",
    });
    try {
      commonNames = await getVernacularNames(match.usageKey);
    } catch {
      commonNames = { english: [], arabic: [] };
    }
  } else {
    unavailable.push("No plant taxon matched this name in GBIF.");
  }

  if (article) {
    sources.push({ label: `Wikipedia - ${article.title}`, url: article.url, via: "Wikipedia" });
  } else {
    unavailable.push("No Wikipedia article matched this query.");
  }

  sources.push({ label: `Kew POWO - search ${trimmed}`, url: powoSearchUrl(trimmed), via: "Kew POWO" });

  return { query: trimmed, taxonomy, commonNames, article, sources, unavailable };
}
