import type { RadioStation, ResolvedStationStream } from "../types";

const API_ROOT = "https://all.api.radio-browser.info";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_ROOT}/json/${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Radio Browser returned HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

function normalizeStation(station: RadioStation): RadioStation {
  return {
    ...station,
    geo_lat: station.geo_lat === null || station.geo_lat === undefined ? null : Number(station.geo_lat),
    geo_long: station.geo_long === null || station.geo_long === undefined ? null : Number(station.geo_long),
    bitrate: Number(station.bitrate) || 0,
    clickcount: Number(station.clickcount) || 0,
    votes: Number(station.votes) || 0,
    lastcheckok: Number(station.lastcheckok) || 0
  };
}

export async function getPopularStations(limit = 160, signal?: AbortSignal): Promise<RadioStation[]> {
  const rows = await getJson<RadioStation[]>(
    `stations/topclick?limit=${limit}&hidebroken=true`,
    signal
  );
  return rows.map(normalizeStation);
}

export async function searchStations(query: string, limit = 100, signal?: AbortSignal): Promise<RadioStation[]> {
  const params = new URLSearchParams({
    name: query.trim(),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
    limit: String(limit)
  });
  const rows = await getJson<RadioStation[]>(`stations/search?${params.toString()}`, signal);
  return rows.map(normalizeStation);
}

export async function getStationsByUuid(uuids: string[]): Promise<RadioStation[]> {
  if (uuids.length === 0) return [];
  const params = new URLSearchParams({ uuids: uuids.join(",") });
  const rows = await getJson<RadioStation[]>(`stations/byuuid?${params.toString()}`);
  return rows.map(normalizeStation);
}

export async function resolveStationStream(station: RadioStation): Promise<string> {
  try {
    // This endpoint also records a station click, as requested by Radio Browser.
    const result = await getJson<ResolvedStationStream>(`url/${encodeURIComponent(station.stationuuid)}`);
    if (result.url && isHttpUrl(result.url)) return result.url;
  } catch {
    // Keep playback available when the click-counter endpoint is temporarily unavailable.
  }

  const fallback = station.url_resolved || station.url;
  if (fallback && isHttpUrl(fallback)) return fallback;
  throw new Error("This station does not have a usable stream URL.");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function hasCoordinates(station: RadioStation): boolean {
  return (
    typeof station.geo_lat === "number" &&
    Number.isFinite(station.geo_lat) &&
    station.geo_lat >= -90 &&
    station.geo_lat <= 90 &&
    typeof station.geo_long === "number" &&
    Number.isFinite(station.geo_long) &&
    station.geo_long >= -180 &&
    station.geo_long <= 180
  );
}
