import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RadioStation } from "../types";
import { hasCoordinates } from "../services/radio-browser";

export class StationMap {
  private readonly map: L.Map;
  private readonly markers: L.LayerGroup;
  private readonly onSelect: (station: RadioStation) => void;
  private stationById = new Map<string, RadioStation>();

  constructor(element: HTMLElement, onSelect: (station: RadioStation) => void) {
    this.onSelect = onSelect;
    this.map = L.map(element, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 12
    }).setView([23, 8], 2);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(this.map);

    L.control.zoom({ position: "bottomright" }).addTo(this.map);
    this.markers = L.layerGroup().addTo(this.map);
  }

  render(stations: RadioStation[], selectedId: string | null): number {
    this.markers.clearLayers();
    this.stationById.clear();

    let count = 0;
    for (const station of stations) {
      if (!hasCoordinates(station)) continue;

      count += 1;
      this.stationById.set(station.stationuuid, station);
      const selected = station.stationuuid === selectedId;
      const icon = L.divIcon({
        className: "station-pin-host",
        html: `<span class="station-pin${selected ? " is-selected" : ""}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = L.marker([station.geo_lat as number, station.geo_long as number], {
        icon,
        title: station.name,
        alt: station.name,
        riseOnHover: true,
        keyboard: true
      });

      marker.on("click", () => {
        this.onSelect(station);
      });
      marker.addTo(this.markers);
    }

    return count;
  }

  focus(station: RadioStation): void {
    if (!hasCoordinates(station)) return;
    this.map.setView([station.geo_lat as number, station.geo_long as number], Math.max(this.map.getZoom(), 5), {
      animate: true,
      duration: 0.55
    });
  }

  invalidateSize(): void {
    window.setTimeout(() => this.map.invalidateSize({ pan: false }), 80);
  }

  getStationCount(): number {
    return this.stationById.size;
  }
}
