import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RadioStation } from "../types";
import { hasCoordinates } from "../services/radio-browser";

export type MapStylePreset = "standard" | "muted" | "monochrome" | "night";

interface StationFeatureProperties {
  stationuuid: string;
  name: string;
  selected: boolean;
}

const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: "osm-raster",
      type: "raster",
      source: "openstreetmap",
      paint: {
        "raster-saturation": 0,
        "raster-contrast": 0,
        "raster-brightness-min": 0,
        "raster-brightness-max": 1
      }
    }
  ]
};

const STYLE_PRESETS: Record<MapStylePreset, {
  saturation: number;
  contrast: number;
  brightnessMin: number;
  brightnessMax: number;
}> = {
  standard: { saturation: 0, contrast: 0, brightnessMin: 0, brightnessMax: 1 },
  muted: { saturation: -0.55, contrast: -0.12, brightnessMin: 0.12, brightnessMax: 0.82 },
  monochrome: { saturation: -1, contrast: 0.12, brightnessMin: 0.08, brightnessMax: 0.92 },
  night: { saturation: -0.8, contrast: 0.08, brightnessMin: 0.02, brightnessMax: 0.38 }
};

export class StationMap {
  private readonly map: MapLibreMap;
  private readonly onSelect: (station: RadioStation) => void;
  private stationById = new Map<string, RadioStation>();
  private stations: RadioStation[] = [];
  private stylePreset: MapStylePreset = "night";
  private sourceReady = false;

  constructor(element: HTMLElement, onSelect: (station: RadioStation) => void) {
    this.onSelect = onSelect;
    this.map = new maplibregl.Map({
      container: element,
      style: BASE_STYLE,
      center: [8, 23],
      zoom: 2,
      minZoom: 2,
      maxZoom: 12,
      attributionControl: true,
      renderWorldCopies: true
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    this.map.on("load", () => {
      this.map.addSource("stations", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });

      this.map.addLayer({
        id: "station-points",
        type: "circle",
        source: "stations",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "selected"], false], 7, 4],
          "circle-color": ["case", ["boolean", ["get", "selected"], false], "#ffffff", "#e5a52d"],
          "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 2, 1],
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.96,
          "circle-blur": 0.12
        }
      });

      this.map.on("click", "station-points", (event) => {
        const feature = event.features?.[0];
        const stationId = feature?.properties?.stationuuid;
        if (typeof stationId !== "string") return;
        const station = this.stationById.get(stationId);
        if (station) this.onSelect(station);
      });

      this.map.on("mouseenter", "station-points", () => {
        this.map.getCanvas().style.cursor = "pointer";
      });
      this.map.on("mouseleave", "station-points", () => {
        this.map.getCanvas().style.cursor = "";
      });

      this.sourceReady = true;
      this.updateStations();
      this.setStylePreset(this.stylePreset);
    });

  }

  render(stations: RadioStation[], selectedId: string | null): number {
    this.stations = stations;
    this.stationById.clear();

    for (const station of stations) {
      if (hasCoordinates(station)) {
        this.stationById.set(station.stationuuid, station);
      }
    }

    this.selectedId = selectedId;
    this.updateStations();
    return this.stationById.size;
  }

  private selectedId: string | null = null;

  private updateStations(): void {
    if (!this.sourceReady) return;

    const source = this.map.getSource("stations") as GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: this.stations
        .filter(hasCoordinates)
        .map((station) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [station.geo_long as number, station.geo_lat as number]
          },
          properties: {
            stationuuid: station.stationuuid,
            name: station.name,
            selected: station.stationuuid === this.selectedId
          } satisfies StationFeatureProperties
        }))
    });
  }

  setStylePreset(preset: MapStylePreset): void {
    this.stylePreset = preset;
    const style = STYLE_PRESETS[preset];
    if (!this.map.getLayer("osm-raster")) return;

    this.map.setPaintProperty("osm-raster", "raster-saturation", style.saturation);
    this.map.setPaintProperty("osm-raster", "raster-contrast", style.contrast);
    this.map.setPaintProperty("osm-raster", "raster-brightness-min", style.brightnessMin);
    this.map.setPaintProperty("osm-raster", "raster-brightness-max", style.brightnessMax);
  }

  focus(station: RadioStation): void {
    if (!hasCoordinates(station)) return;
    this.map.easeTo({
      center: [station.geo_long as number, station.geo_lat as number],
      zoom: Math.max(this.map.getZoom(), 5),
      duration: 550,
      essential: true
    });
  }

  invalidateSize(): void {
    window.setTimeout(() => this.map.resize(), 80);
  }

  getStationCount(): number {
    return this.stationById.size;
  }
}
