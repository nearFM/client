import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RadioStation } from "../types";
import { hasCoordinates } from "../services/radio-browser";

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
        "raster-saturation": -1,
        "raster-contrast": 0.12,
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.42
      }
    }
  ]
};

export class StationMap {
  private readonly map: MapLibreMap;
  private readonly onSelect: (station: RadioStation) => void;
  private stationById = new Map<string, RadioStation>();
  private stations: RadioStation[] = [];
  private sourceReady = false;
  private readonly resizeObserver: ResizeObserver;

  constructor(element: HTMLElement, onSelect: (station: RadioStation) => void) {
    this.onSelect = onSelect;
    this.resizeObserver = new ResizeObserver(() => this.map.resize());
    this.resizeObserver.observe(element);
    this.map = new maplibregl.Map({
      container: element,
      style: BASE_STYLE,
      center: [8, 23],
      zoom: 2,
      minZoom: 2,
      maxZoom: 12,
      attributionControl: {},
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
          "circle-color": ["case", ["boolean", ["get", "selected"], false], "#ffffff", "#888888"],
          "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 2, 1],
          "circle-stroke-color": "#111111",
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
      this.map.resize();
      this.updateStations();
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
    this.map.resize();
  }

  getStationCount(): number {
    return this.stationById.size;
  }
}
