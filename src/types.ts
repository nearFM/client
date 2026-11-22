export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  state: string;
  language: string;
  codec: string;
  bitrate: number;
  votes: number;
  clickcount: number;
  lastcheckok: number;
  geo_lat: number | null;
  geo_long: number | null;
}

export interface ResolvedStationStream {
  ok?: boolean | string;
  stationuuid?: string;
  name?: string;
  url?: string;
}

export type AppView = "discover" | "stations" | "favorites";
