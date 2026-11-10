/**
 * GBIF biodiversity API client (server-side only).
 *
 * GBIF exposes a documented, key-free OpenAPI at
 * https://techdocs.gbif.org/en/openapi/v1/species and requires a descriptive
 * User-Agent. Failure of any call degrades gracefully to `null`/empty data so a
 * third-party outage can never crash the app.
 */

import { cached, fetchJson } from "./http";

const API = "https://api.gbif.org/v1";
const TTL = 1000 * 60 * 60 * 24;
const HEADERS = { "User-Agent": "e_learning-plant-analyzer/1.0 (educational project)" };

export interface GbifMatch {
  usageKey: number;
  scientificName: string | null;
  canonicalName: string | null;
  rank: string | null;
  status: string | null;
  confidence: number;
  matchType: string;
  kingdom: string | null;
  phylum: string | null;
  class: string | null;
  order: string | null;
  family: string | null;
  genus: string | null;
  species: string | null;
}

function normalizeMatch(raw: Record<string, unknown>): GbifMatch | null {
  if (!raw || typeof raw.usageKey !== "number") return null;
  if (raw.matchType === "NONE") return null;
  return {
    usageKey: raw.usageKey as number,
    scientificName: (raw.scientificName as string) ?? null,
    canonicalName: (raw.canonicalName as string) ?? null,
    rank: (raw.rank as string) ?? null,
    status: (raw.status as string) ?? null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    matchType: (raw.matchType as string) ?? "NONE",
    kingdom: (raw.kingdom as string) ?? null,
    phylum: (raw.phylum as string) ?? null,
    class: (raw["class"] as string) ?? null,
    order: (raw.order as string) ?? null,
    family: (raw.family as string) ?? null,
    genus: (raw.genus as string) ?? null,
    species: (raw.species as string) ?? null,
  };
}

async function matchRaw(name: string, rank?: string): Promise<GbifMatch | null> {
  const url = `${API}/species/match?name=${encodeURIComponent(name)}&kingdom=Plantae${
    rank ? `&rank=${rank}` : ""
  }`;
  const raw = await fetchJson<Record<string, unknown>>(url, { headers: HEADERS });
  return normalizeMatch(raw);
}

export async function matchTaxon(name: string): Promise<GbifMatch | null> {
  return cached(`gbif:match:${name}`, TTL, async () => {
    const direct = await matchRaw(name);
    if (direct && direct.matchType !== "NONE") return direct;
    return null;
  });
}

export interface GbifVernacularNames {
  english: string[];
  arabic: string[];
}

export async function getVernacularNames(usageKey: number): Promise<GbifVernacularNames> {
  return cached(`gbif:vernacular:${usageKey}`, TTL, async () => {
    const empty: GbifVernacularNames = { english: [], arabic: [] };
    try {
      const payload = await fetchJson<{ results?: Array<{ vernacularName?: string; language?: string }> }>(
        `${API}/species/${usageKey}/vernacularNames?limit=100`,
        { headers: HEADERS },
      );
      const english = new Set<string>();
      const arabic = new Set<string>();
      for (const item of payload.results ?? []) {
        const name = (item.vernacularName ?? "").trim();
        if (!name) continue;
        if (item.language === "eng") english.add(name);
        if (item.language === "ara") arabic.add(name);
      }
      return { english: [...english].slice(0, 6), arabic: [...arabic].slice(0, 6) };
    } catch {
      return empty;
    }
  });
}

export interface GbifDescription {
  description: string;
  language: string | null;
  source: string | null;
}

export async function getDescriptions(usageKey: number): Promise<GbifDescription[]> {
  return cached(`gbif:descriptions:${usageKey}`, TTL, async () => {
    try {
      const payload = await fetchJson<{
        results?: Array<{ description?: string; language?: string; source?: string }>;
      }>(`${API}/species/${usageKey}/descriptions?limit=20`, { headers: HEADERS });
      return (payload.results ?? [])
        .map((item) => ({
          description: (item.description ?? "").trim(),
          language: item.language ?? null,
          source: item.source ?? null,
        }))
        .filter((item) => item.description.length > 0)
        .sort((a, b) => Number(b.language === "eng") - Number(a.language === "eng"))
        .slice(0, 5);
    } catch {
      return [];
    }
  });
}

export interface GbifDistribution {
  locality: string | null;
  country: string | null;
  establishmentMeans: string | null;
  status: string | null;
}

export async function getDistributions(usageKey: number): Promise<GbifDistribution[]> {
  return cached(`gbif:distributions:${usageKey}`, TTL, async () => {
    try {
      const payload = await fetchJson<{
        results?: Array<Record<string, unknown>>;
      }>(`${API}/species/${usageKey}/distributions?limit=50`, { headers: HEADERS });
      return (payload.results ?? []).map((item) => ({
        locality: (item.locality as string) ?? null,
        country: (item.country as string) ?? null,
        establishmentMeans: (item.establishmentMeans as string) ?? null,
        status: (item.status as string) ?? null,
      }));
    } catch {
      return [];
    }
  });
}

export async function getOccurrenceCount(usageKey: number): Promise<number | null> {
  return cached(`gbif:occurrences:${usageKey}`, TTL, async () => {
    try {
      const payload = await fetchJson<{ count?: number }>(
        `${API}/occurrence/search?taxonKey=${usageKey}&limit=0`,
        { headers: HEADERS },
      );
      return typeof payload.count === "number" ? payload.count : null;
    } catch {
      return null;
    }
  });
}

export function gbifSpeciesUrl(usageKey: number): string {
  return `https://www.gbif.org/species/${usageKey}`;
}
