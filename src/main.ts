import "./styles.css";
import type { AppView, RadioStation } from "./types";
import type { PlayerSnapshot } from "./components/radio-player";
import { getPopularStations, getStationsByUuid, hasCoordinates, searchStations } from "./services/radio-browser";
import { StationMap } from "./components/station-map";
import { RadioPlayer } from "./components/radio-player";
import { Visualizer } from "./components/visualizer";

const icon = {
  star: '<span class="mif-star" aria-hidden="true"></span>',
  search: '<i class="icons8-search" aria-hidden="true"></i>',
  play: '<span class="mif-play" aria-hidden="true"></span>',
  pause: '<span class="mif-pause" aria-hidden="true"></span>',
  refresh: '<i class="icons8-refresh" aria-hidden="true"></i>',
  volume: '<img src="https://img.icons8.com/?size=100&id=15992&format=png&color=000000" alt="" aria-hidden="true">'
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root was not found.");

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-top">
        <a class="wordmark" href="#" aria-label="nearFM">nearFM</a>
        <nav class="primary-nav" aria-label="Library">
          <button class="nav-item is-active" type="button" data-view="discover"><span class="nav-mark"></span>Discover</button>
          <button class="nav-item" type="button" data-view="stations"><span class="nav-mark"></span>All stations</button>
          <button class="nav-item" type="button" data-view="favorites"><span class="nav-mark"></span>Favorites</button>
        </nav>
      </div>

      <section class="directory">
        <div class="directory-heading">
          <span id="content-title">Discover</span>
          <button class="icon-button" id="refresh-button" type="button" aria-label="Refresh stations" title="Refresh stations">${icon.refresh}</button>
        </div>
        <form class="search-form" id="search-form" role="search">
          <span class="search-icon">${icon.search}</span>
          <label class="sr-only" for="station-search">Search stations</label>
          <input id="station-search" name="q" type="search" placeholder="Search stations" autocomplete="off" />
        </form>
        <div class="list-meta">
          <span id="station-count">Loading stations</span>
          <span class="network-state"><i id="network-indicator"></i><span id="network-label">Connecting</span></span>
        </div>
        <label class="sr-only" id="sort-label">Sort stations</label>
        <div class="sort-dropdown" id="sort-dropdown">
          <select id="sort-select" class="sort-select-native" tabindex="-1" aria-hidden="true">
            <option value="popular">Most popular</option>
            <option value="name">Station name</option>
          </select>
          <button class="sort-trigger" id="sort-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="sort-label sort-value">
            <span id="sort-value">Most popular</span>
            <span class="sort-chevron" aria-hidden="true"></span>
          </button>
          <div class="sort-menu" id="sort-menu" role="listbox" aria-labelledby="sort-label" hidden>
            <button class="sort-option is-selected" type="button" role="option" aria-selected="true" data-sort-value="popular">Most popular</button>
            <button class="sort-option" type="button" role="option" aria-selected="false" data-sort-value="name">Station name</button>
          </div>
        </div>
        <div class="station-list" id="station-list" aria-label="Radio stations"></div>
        <div class="list-message" id="list-message">Connecting to Radio Browser…</div>
        <div class="source-line">Directory data by <a href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">Radio Browser</a></div>
      </section>

      <section class="player" aria-label="Playback controls">
        <div class="player-heading">
          <span class="live-mark" id="live-mark"></span>
          <span id="play-state">READY</span>
        </div>
        <div class="player-station">
          <div class="station-art" id="player-art"><span>FM</span></div>
          <div class="player-copy">
            <strong id="player-name">Nothing selected</strong>
            <span id="player-detail">Choose a station</span>
          </div>
        </div>
        <div class="player-controls">
          <button class="play-button" id="play-button" type="button" aria-label="Play selected station" title="Play selected station" disabled>${icon.play}</button>
          <div class="volume-control">
            <span class="volume-icon">${icon.volume}</span>
            <label class="sr-only" for="volume-slider">Volume</label>
            <input id="volume-slider" type="range" min="0" max="1" step="0.01" value="0.72" />
            <span id="volume-value">72</span>
          </div>
        </div>
        <canvas id="visualizer" aria-label="Audio frequency visualizer"></canvas>
        <span class="visualizer-status" id="visualizer-status">WAITING FOR AUDIO</span>
      </section>
    </aside>

    <main class="world-view">
      <div class="world-topline">
        <span class="world-count"><span id="map-count">0</span> stations on map</span>
      </div>
      <div class="map-stage">
        <div id="station-map" class="station-map"></div>
        <aside class="selected-station-info" id="selected-station-info" aria-live="polite" hidden>
          <span class="selected-station-country" id="selected-station-country"></span>
          <strong id="selected-station-name"></strong>
          <span id="selected-station-detail"></span>
        </aside>
        <div class="map-empty" id="map-empty" hidden>No stations with location data</div>
      </div>
    </main>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`;

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing element: " + id);
  return element as T;
};

const stationList = byId<HTMLDivElement>("station-list");
const listMessage = byId<HTMLDivElement>("list-message");
const stationMapElement = byId<HTMLDivElement>("station-map");
const searchInput = byId<HTMLInputElement>("station-search");
const sortSelect = byId<HTMLSelectElement>("sort-select");
const networkLabel = byId<HTMLSpanElement>("network-label");
const networkIndicator = byId<HTMLSpanElement>("network-indicator");
const toast = byId<HTMLDivElement>("toast");
const player = new RadioPlayer();
const visualizer = new Visualizer(byId<HTMLCanvasElement>("visualizer"));

let stations: RadioStation[] = [];
let selectedStation: RadioStation | null = null;
let activeView: AppView = "discover";
let favoriteIds = readFavorites();
let favoriteStations: RadioStation[] = [];
let requestController: AbortController | null = null;
let toastTimer = 0;

const stationMap = new StationMap(stationMapElement, (station) => selectStation(station, false));

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("nearFM:favorites:v1") ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveFavorites(): void {
  localStorage.setItem("nearFM:favorites:v1", JSON.stringify(favoriteIds));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character] ?? character;
  });
}

function safeImageUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

const imageFallback = "https://img.icons8.com/?size=100&id=PXS9WdRlqCPq&format=png&color=000000";

document.addEventListener("error", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement) || target.dataset.fallbackApplied === "true") return;

  target.dataset.fallbackApplied = "true";
  target.src = imageFallback;
}, true);

function stationInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "FM").slice(0, 2).toUpperCase();
}

function getVisibleStations(): RadioStation[] {
  const source = activeView === "favorites" ? favoriteStations : stations;
  const query = activeView === "favorites" ? searchInput.value.trim().toLowerCase() : "";
  const filtered = query
    ? source.filter((station) => station.name.toLowerCase().includes(query) || station.country.toLowerCase().includes(query))
    : [...source];
  return sortSelect.value === "name"
    ? filtered.sort((a, b) => a.name.localeCompare(b.name))
    : filtered.sort((a, b) => b.clickcount - a.clickcount);
}

function setListMessage(message: string | null, error = false): void {
  listMessage.textContent = message ?? "";
  listMessage.hidden = message === null;
  listMessage.classList.toggle("error-message", error);
}

function renderSelectedStation(): void {
  const info = byId<HTMLElement>("selected-station-info");
  if (!selectedStation) {
    info.hidden = true;
    return;
  }
  byId<HTMLElement>("selected-station-country").textContent =
    [selectedStation.country, selectedStation.state].filter(Boolean).join(" / ").toUpperCase() || "UNKNOWN LOCATION";
  byId<HTMLElement>("selected-station-name").textContent = selectedStation.name || "Unnamed station";
  byId<HTMLElement>("selected-station-detail").textContent =
    [selectedStation.codec || "Internet radio", selectedStation.bitrate ? selectedStation.bitrate + " kbps" : ""].filter(Boolean).join(" · ");
  info.hidden = false;
}

function renderStations(): void {
  const visible = getVisibleStations();
  const mapped = visible.filter(hasCoordinates).length;
  byId<HTMLSpanElement>("station-count").textContent = visible.length.toLocaleString() + " stations";
  byId<HTMLSpanElement>("map-count").textContent = mapped.toLocaleString();

  stationList.innerHTML = visible.map((station) => {
    const favorite = favoriteIds.includes(station.stationuuid);
    const selected = selectedStation?.stationuuid === station.stationuuid;
    const image = safeImageUrl(station.favicon);
    const art = image
      ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : '<span>' + escapeHtml(stationInitials(station.name)) + '</span>';
    return '<div class="station-row' + (selected ? ' is-selected' : '') + '" data-station-row="' + escapeHtml(station.stationuuid) + '">' +
      '<button class="station-select" type="button" data-select="' + escapeHtml(station.stationuuid) + '" aria-label="Tune in to ' + escapeHtml(station.name) + '">' +
      '<span class="station-row-art">' + art + '</span><span class="station-row-copy"><strong>' + escapeHtml(station.name || "Unnamed station") +
      '</strong><span>' + escapeHtml([station.country || "Unknown country", station.codec || "Internet radio"].filter(Boolean).join(" · ")) +
      '</span></span></button><button class="favorite-button' + (favorite ? ' is-favorite' : '') + '" type="button" data-favorite="' +
      escapeHtml(station.stationuuid) + '" aria-label="' + (favorite ? "Remove from" : "Add to") + ' favorites" aria-pressed="' + String(favorite) + '">' +
      icon.star + '</button></div>';
  }).join("");

  setListMessage(visible.length === 0
    ? (activeView === "favorites" ? "No saved stations." : "No stations found.")
    : null);
  byId<HTMLElement>("map-empty").hidden = mapped > 0;
  stationMap.render(visible, selectedStation?.stationuuid ?? null);
  renderSelectedStation();
}

function renderView(): void {
  const titles: Record<AppView, string> = { discover: "Discover", stations: "All stations", favorites: "Favorites" };
  byId<HTMLSpanElement>("content-title").textContent = titles[activeView];
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    const active = button.dataset.view === activeView;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderStations();
  stationMap.invalidateSize();
}

function setNetworkState(state: "connecting" | "online" | "offline", message?: string): void {
  networkIndicator.classList.toggle("is-online", state === "online");
  networkIndicator.classList.toggle("is-offline", state === "offline");
  networkLabel.textContent = message ?? ({ connecting: "Connecting", online: "Online", offline: "Offline" }[state]);
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

async function loadStations(query = ""): Promise<void> {
  requestController?.abort();
  requestController = new AbortController();
  setNetworkState("connecting");
  setListMessage("Loading stations…");
  try {
    const result = query.trim()
      ? await searchStations(query, 160, requestController.signal)
      : await getPopularStations(220, requestController.signal);
    stations = result;
    for (const station of result) {
      if (selectedStation?.stationuuid === station.stationuuid) selectedStation = station;
    }
    setNetworkState("online");
    if (activeView === "favorites") await loadFavoriteStations();
    else renderStations();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    setNetworkState("offline");
    setListMessage("Unable to load stations. Select refresh to try again.", true);
  }
}

async function loadFavoriteStations(): Promise<void> {
  if (favoriteIds.length === 0) {
    favoriteStations = [];
    renderStations();
    return;
  }
  try {
    const downloaded = await getStationsByUuid(favoriteIds);
    const order = new Map(favoriteIds.map((id, index) => [id, index]));
    favoriteStations = downloaded.sort((a, b) => (order.get(a.stationuuid) ?? 0) - (order.get(b.stationuuid) ?? 0));
    renderStations();
  } catch {
    favoriteStations = stations.filter((station) => favoriteIds.includes(station.stationuuid));
    renderStations();
    showToast("Could not refresh saved stations from the directory.");
  }
}

function selectStation(station: RadioStation, focusMap = true): void {
  selectedStation = station;
  renderStations();
  if (focusMap) stationMap.focus(station);
  renderPlayer(player.snapshot);
}

function toggleFavorite(uuid: string): void {
  const existing = favoriteIds.indexOf(uuid);
  if (existing >= 0) favoriteIds.splice(existing, 1);
  else favoriteIds.unshift(uuid);
  saveFavorites();
  if (activeView === "favorites") void loadFavoriteStations();
  else renderStations();
}

function renderPlayer(snapshot: PlayerSnapshot): void {
  const station = selectedStation ?? snapshot.station;
  byId<HTMLSpanElement>("player-name").textContent = station?.name ?? "Nothing selected";
  byId<HTMLSpanElement>("player-detail").textContent = station
    ? [station.country || "Unknown location", station.codec || "Internet radio", station.bitrate ? station.bitrate + " kbps" : ""].filter(Boolean).join(" · ")
    : "Choose a station";
  const art = byId<HTMLDivElement>("player-art");
  const image = station ? safeImageUrl(station.favicon) : "";
  art.innerHTML = image
    ? '<img src="' + escapeHtml(image) + '" alt="" referrerpolicy="no-referrer">'
    : '<span>' + (station ? escapeHtml(stationInitials(station.name)) : "FM") + '</span>';

  const playButton = byId<HTMLButtonElement>("play-button");
  playButton.disabled = !station || snapshot.loading;
  playButton.innerHTML = snapshot.playing ? icon.pause : icon.play;
  playButton.setAttribute("aria-label", snapshot.playing ? "Pause station" : "Play selected station");
  playButton.title = snapshot.playing ? "Pause station" : "Play selected station";
  byId<HTMLSpanElement>("play-state").textContent = snapshot.error ? "ERROR" : snapshot.loading ? "BUFFERING" : snapshot.playing ? "PLAYING" : "READY";
  byId<HTMLElement>("live-mark").classList.toggle("is-playing", snapshot.playing);
  byId<HTMLSpanElement>("visualizer-status").textContent = snapshot.visualizerNote;
  visualizer.setAnalyser(snapshot.analyser);
  visualizer.setPlaying(snapshot.playing && snapshot.visualizerAvailable);
  if (snapshot.error) showToast(snapshot.error);
}

player.subscribe(renderPlayer);

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view as AppView | undefined;
    if (!view) return;
    activeView = view;
    if (view === "favorites") void loadFavoriteStations();
    renderView();
  });
});

stationList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const favoriteButton = target.closest<HTMLButtonElement>("[data-favorite]");
  if (favoriteButton?.dataset.favorite) {
    toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }
  const selectButton = target.closest<HTMLButtonElement>("[data-select]");
  const uuid = selectButton?.dataset.select;
  if (!uuid) return;
  const station = [...stations, ...favoriteStations].find((item) => item.stationuuid === uuid);
  if (station) selectStation(station);
});

byId<HTMLFormElement>("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeView === "favorites") renderStations();
  else void loadStations(searchInput.value.trim());
});

byId<HTMLButtonElement>("refresh-button").addEventListener("click", () => {
  if (activeView === "favorites") void loadFavoriteStations();
  else void loadStations(searchInput.value.trim());
});

const sortDropdown = byId<HTMLDivElement>("sort-dropdown");
const sortTrigger = byId<HTMLButtonElement>("sort-trigger");
const sortMenu = byId<HTMLDivElement>("sort-menu");
const sortValue = byId<HTMLSpanElement>("sort-value");

function setSortMenuOpen(open: boolean): void {
  sortMenu.hidden = !open;
  sortTrigger.setAttribute("aria-expanded", String(open));
  if (open) {
    sortMenu.querySelector<HTMLButtonElement>('[data-sort-value="' + sortSelect.value + '"]')?.focus();
  }
}

function syncSortMenu(): void {
  const selected = sortMenu.querySelector<HTMLButtonElement>('[data-sort-value="' + sortSelect.value + '"]');
  sortValue.textContent = selected?.textContent ?? "Most popular";
  sortMenu.querySelectorAll<HTMLButtonElement>("[data-sort-value]").forEach((option) => {
    const active = option.dataset.sortValue === sortSelect.value;
    option.classList.toggle("is-selected", active);
    option.setAttribute("aria-selected", String(active));
  });
}

sortTrigger.addEventListener("click", () => {
  setSortMenuOpen(sortMenu.hidden);
});

sortMenu.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const option = target.closest<HTMLButtonElement>("[data-sort-value]");
  if (!option?.dataset.sortValue) return;
  sortSelect.value = option.dataset.sortValue;
  sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
  syncSortMenu();
  setSortMenuOpen(false);
  sortTrigger.focus();
});

sortMenu.addEventListener("keydown", (event) => {
  const options = [...sortMenu.querySelectorAll<HTMLButtonElement>("[data-sort-value]")];
  const current = options.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    options[(current + direction + options.length) % options.length]?.focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    setSortMenuOpen(false);
    sortTrigger.focus();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!sortDropdown.contains(event.target as Node)) setSortMenuOpen(false);
});

sortTrigger.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSortMenuOpen(false);
  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setSortMenuOpen(true);
  }
});

sortSelect.addEventListener("change", () => {
  syncSortMenu();
  renderStations();
});
syncSortMenu();

byId<HTMLButtonElement>("play-button").addEventListener("click", () => {
  const current = player.snapshot.station;
  const target = selectedStation ?? current;
  if (!target) return;
  if (current?.stationuuid === target.stationuuid) void player.toggle();
  else void player.play(target);
});

function renderVolumeIcon(value: number): void {
  const image = document.querySelector<HTMLImageElement>(".volume-icon img");
  if (!image) return;

  const iconId = value === 0 ? 15993 : value >= 2 / 3 ? 15992 : value >= 1 / 3 ? 22778 : 15991;
  image.src = "https://img.icons8.com/?size=100&id=" + iconId + "&format=png&color=000000";
}

const volumeSlider = byId<HTMLInputElement>("volume-slider");

function renderVolumeSlider(value: number): void {
  volumeSlider.style.setProperty("--volume-progress", (value * 100) + "%");
}

renderVolumeIcon(Number(volumeSlider.value));
renderVolumeSlider(Number(volumeSlider.value));
volumeSlider.addEventListener("input", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const value = Number(input.value);
  player.setVolume(value);
  byId<HTMLSpanElement>("volume-value").textContent = String(Math.round(value * 100));
  renderVolumeIcon(value);
  renderVolumeSlider(value);
});

window.addEventListener("resize", () => stationMap.invalidateSize());
renderView();
void loadStations();
