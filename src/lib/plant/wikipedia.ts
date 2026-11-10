/**
 * Wikipedia reference client (server-side only).
 *
 * Used to retrieve public, citable summaries for a crop or disease so the app
 * never has to invent symptoms or treatments. Failed lookups return null and the
 * UI then states that reliable information was not available.
 */

import { cached, fetchJson } from "./http";

const TTL = 1000 * 60 * 60 * 24;
const HEADERS = { "User-Agent": "e_learning-plant-analyzer/1.0 (educational project)" };

export interface WikiArticle {
  title: string;
  extract: string;
  url: string;
  language: string;
  thumbnail: string | null;
}

type WikiLang = "en" | "ar";

async function searchTitle(term: string, lang: WikiLang): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}` +
    `&srlimit=1&format=json&origin=*`;
  const payload = await fetchJson<{ query?: { search?: Array<{ title?: string }> } }>(url, { headers: HEADERS });
  const title = payload.query?.search?.[0]?.title;
  return title && title.trim().length > 0 ? title : null;
}

async function summary(title: string, lang: WikiLang): Promise<WikiArticle | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const payload = await fetchJson<{
    title?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
  }>(url, { headers: HEADERS });
  const extract = (payload.extract ?? "").trim();
  if (!extract) return null;
  return {
    title: payload.title ?? title,
    extract,
    url: payload.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    language: lang,
    thumbnail: payload.thumbnail?.source ?? null,
  };
}

export async function findArticle(term: string, lang: WikiLang = "en"): Promise<WikiArticle | null> {
  return cached(`wiki:${lang}:${term}`, TTL, async () => {
    try {
      const title = await searchTitle(term, lang);
      if (!title) return null;
      return await summary(title, lang);
    } catch {
      return null;
    }
  });
}

/** Kew POWO has no public JSON API (it returns 403 to automated clients); we link out instead. */
export function powoSearchUrl(scientificName: string): string {
  return `https://powo.science.kew.org/results?q=${encodeURIComponent(scientificName)}`;
}
