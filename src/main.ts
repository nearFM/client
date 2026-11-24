import "./styles.css";
import type { AppView, RadioStation } from "./types";
import type { PlayerSnapshot } from "./components/radio-player";
import { getPopularStations, getStationsByUuid, hasCoordinates, searchStations } from "./services/radio-browser";
import { StationMap } from "./components/station-map";
import { RadioPlayer } from "./components/radio-player";
import { Visualizer } from "./components/visualizer";

const icon = {
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 6.5 5-2 7 2 5-2v13l-5 2-7-2-5 2z"/><path d="M8.5 4.5v13M15.5 6.5v13"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 11.9-3"/></svg>',
  volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a9 9 0 0 1 0 11"/></svg>',
  radio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5h18v10H3zM5 6l14-3"/><circle cx="8" cy="14.5" r="2"/><path d="M14 13h4M14 16h4"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root was not found.");

app.innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <a class="wordmark" href="#" aria-label="nearFM">nearFM</a>
      <nav class="view-tabs" aria-label="Library">
        <button class="view-tab is-active" type="button" data-view="discover" aria-current="page">Discover</button>
        <button class="view-tab" type="button" data-view="stations">Stations</button>
        <button class="view-tab" type="button" data-view="favorites">Favorites</button>
      </nav>
      <form class="search-form" id="search-form" role="search">
        <label class="sr-only" for="station-search">Search stations</label>
        <span class="search-icon">\${icon.search}</span>
        <input id="station-search" name="q" type="search" placeholder="Search stations" autocomplete="off" />
        <kbd>ENTER</kbd>
      </form>
      <button class="header-command" id="refresh-button" type="button" aria-label="Refresh stations" title="Refresh stations">\${icon.refresh}</button>
    </header>

    <main class="main-content">
      <div class="hub-title-row">
        <h1 id="content-title">Discover radio</h1>
        <div class="directory-state" aria-live="polite">
          <span class="network-indicator" id="network-indicator"></span>
          <span id="network-label">Connecting</span>
        </div>
      </div>

      <div class="radio-hub" id="radio-hub" data-win-control="WinJS.UI.Hub">
        <section class="hub-section stations-section" id="stations-section"
          data-win-control="WinJS.UI.HubSection"
          data-win-options="{ header: 'Stations', isHeaderStatic: true }">
          <div class="hub-section-content">
            <div class="section-toolbar">
              <div class="section-count">
                <span id="station-count">Loading stations</span>
                <span class="count-divider">/</span>
                <span id="mapped-count">— on map</span>
              </div>
              <label class="sr-only" for="sort-select">Sort stations</label>
              <select id="sort-select" class="win-dropdown sort-select">
                <option value="popular">Popular</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div class="station-list-frame">
              <div class="station-list" id="station-list"></div>
              <div class="list-message" id="list-message">Connecting to Radio Browser…</div>
            </div>
            <div class="source-line">
              Directory data by <a href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">Radio Browser</a>
            </div>
          </div>
        </section>

        <section class="hub-section map-section" id="map-section"
          data-win-control="WinJS.UI.HubSection"
          data-win-options="{ header: 'World map', isHeaderStatic: true }">
          <div class="hub-section-content map-section-content">
            <div class="map-toolbar">
              <span id="map-count">0 stations on map</span>
              <span>Select a marker to tune in</span>
            </div>
            <div class="map-panel">
              <div id="station-map" class="station-map"></div>
              <aside class="selected-station-card" id="selected-station-card" aria-live="polite" hidden>
                <div class="selected-station-art" id="selected-station-art"></div>
                <div class="selected-station-copy">
                  <strong id="selected-station-name"></strong>
                  <span id="selected-station-detail"></span>
                </div>
              </aside>
              <div class="map-empty" id="map-empty" hidden>No stations with location data</div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <footer class="player-bar" aria-label="Playback controls">
      <div class="now-playing">
        <div class="station-art" id="player-art"><span>FM</span></div>
        <div class="now-playing-copy">
          <strong id="player-name">Nothing selected</strong>
          <span id="player-detail">Select a station to listen</span>
        </div>
      </div>
      <div class="transport">
        <button class="play-button win-button win-button-primary" id="play-button" type="button" aria-label="Play selected station" title="Play selected station" disabled>\${icon.play}</button>
        <span class="play-state" id="play-state">READY</span>
      </div>
      <div class="visualizer-panel">
        <span class="visualizer-status" id="visualizer-status">WAITING FOR AUDIO</span>
        <canvas id="visualizer" aria-label="Audio frequency visualizer"></canvas>
      </div>
      <div class="volume-control">
        <span class="volume-icon">\${icon.volume}</span>
        <label class="sr-only" for="volume-slider">Volume</label>
        <input class="win-slider" id="volume-slider" type="range" min="0" max="1" step="0.01" value="0.72" />
        <span id="volume-value">72</span>
      </div>
    </footer>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
;

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
};

const stationList = byId<HTMLDivElement>("station-list");
const listMessage = byId<HTMLDivElement>("list-message");
const mapSection = byId<HTMLElement>("map-section");
const WinJS = (window as unknown as { WinJS: any }).WinJS;
if (!WinJS) throw new Error("WinJS failed to load.");
let stationListControl: any = null;
let hubControl: any = null;
const stationMapElement = byId<HTMLDivElement>("station-map");
const workspace = byId<HTMLElement>("radio-hub");
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

const stationMap = new StationMap(stationMapElement, (station) => {
  selectStation(station, false);
});

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
    const entities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    };
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

  if (sortSelect.value === "name") return filtered.sort((a, b) => a.name.localeCompare(b.name));
  return filtered.sort((a, b) => b.clickcount - a.clickcount);
}

function setListMessage(message: string | null, error = false): void {
  listMessage.textContent = message ?? "";
  listMessage.hidden = message === null;
  listMessage.classList.toggle("error-message", error);
}

function createStationItem(itemPromise: any): Promise<HTMLElement> {
  return itemPromise.then((item: { data: RadioStation; index: number }) => {
    const station = item.data;
    const favorite = favoriteIds.includes(station.stationuuid);
    const selected = selectedStation?.stationuuid === station.stationuuid;
    const image = safeImageUrl(station.favicon);
    const row = document.createElement("div");
    row.className = \`station-row\${selected ? " is-selected" : ""}\`;
    row.dataset.stationRow = station.stationuuid;

    const select = document.createElement("button");
    select.className = "station-select";
    select.type = "button";
    select.dataset.select = station.stationuuid;
    select.setAttribute("aria-label", \`Select \${station.name}\`);

    const index = document.createElement("span");
    index.className = "station-index";
    index.textContent = String(item.index + 1).padStart(2, "0");

    const avatar = document.createElement("span");
    avatar.className = "station-avatar";
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      avatar.append(img);
    } else {
      avatar.textContent = stationInitials(station.name);
    }

    const copy = document.createElement("span");
    copy.className = "station-copy";
    const name = document.createElement("strong");
    name.textContent = station.name || "Unnamed station";
    const detail = document.createElement("span");
    const tags = station.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 2).join(" · ");
    detail.textContent = [station.country || "Unknown country", tags].filter(Boolean).join(" · ");
    copy.append(name, detail);

    const codec = document.createElement("span");
    codec.className = "station-format";
    codec.textContent = station.codec || "RADIO";
    select.append(index, avatar, copy, codec);

    const favoriteButton = document.createElement("button");
    favoriteButton.className = \`favorite-button\${favorite ? " is-favorite" : ""}\`;
    favoriteButton.type = "button";
    favoriteButton.dataset.favorite = station.stationuuid;
    favoriteButton.setAttribute("aria-label", \`\${favorite ? "Remove from" : "Add to"} favorites\`);
    favoriteButton.setAttribute("aria-pressed", String(favorite));
    favoriteButton.innerHTML = icon.star;
    row.append(select, favoriteButton);
    return row;
  });
}

function renderStations(): void {
  const visible = getVisibleStations();
  const mapped = visible.filter(hasCoordinates).length;
  byId<HTMLSpanElement>("station-count").textContent = \`\${visible.length.toLocaleString()} stations\`;
  byId<HTMLSpanElement>("mapped-count").textContent = \`\${mapped.toLocaleString()} on map\`;
  byId<HTMLSpanElement>("map-count").textContent = \`\${mapped.toLocaleString()} stations on map\`;
  byId<HTMLDivElement>("map-empty").hidden = mapped > 0;

  if (stationListControl) {
    const data = new WinJS.Binding.List(visible);
    stationListControl.itemDataSource = data.dataSource;
  }
  setListMessage(
    visible.length === 0
      ? (activeView === "favorites" ? "No saved stations." : "No stations found.")
      : null
  );

  stationMap.render(visible, selectedStation?.stationuuid ?? null);
  renderSelectedStation();
}

function renderSelectedStation(): void {
  const card = byId<HTMLElement>("selected-station-card");
  if (!selectedStation) {
    card.hidden = true;
    return;
  }

  const image = safeImageUrl(selectedStation.favicon);
  const art = byId<HTMLDivElement>("selected-station-art");
  art.innerHTML = image
    ? `<img src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer" />`
    : `<span>${escapeHtml(stationInitials(selectedStation.name))}</span>`;
  byId<HTMLElement>("selected-station-name").textContent = selectedStation.name || "Unnamed station";
  byId<HTMLElement>("selected-station-detail").textContent = [
    selectedStation.country || "Unknown location",
    selectedStation.state,
    selectedStation.codec || "Internet radio"
  ].filter(Boolean).join(" · ");
  card.hidden = false;
}

function renderView(): void {
  const titles: Record<AppView, string> = {
    discover: "Discover radio",
    stations: "Stations",
    favorites: "Favorites"
  };
  byId<HTMLHeadingElement>("content-title").textContent = titles[activeView];
  workspace.dataset.view = activeView;
  mapSection.hidden = activeView !== "discover";
  if (hubControl) hubControl.forceLayout();

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
  networkLabel.textContent = message ?? ({
    connecting: "CONNECTING TO DIRECTORY",
    online: "RADIO BROWSER ONLINE",
    offline: "DIRECTORY UNAVAILABLE"
  }[state]);
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
      ? await searchStations(query, 120, requestController.signal)
      : await getPopularStations(160, requestController.signal);
    stations = result;
    for (const station of result) {
      if (selectedStation?.stationuuid === station.stationuuid) selectedStation = station;
    }
    setNetworkState("online");
    if (activeView === "favorites") {
      await loadFavoriteStations();
    } else {
      renderStations();
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    setNetworkState("offline");
    setListMessage("Unable to load stations. Select Refresh to try again.", true);
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
  if (focusMap && activeView === "discover") stationMap.focus(station);
  renderPlayer(player.snapshot);
}

function toggleFavorite(uuid: string): void {
  const existing = favoriteIds.indexOf(uuid);
  if (existing >= 0) favoriteIds.splice(existing, 1);
  else favoriteIds.unshift(uuid);
  saveFavorites();

  if (activeView === "favorites") {
    void loadFavoriteStations();
  } else {
    renderStations();
  }
}

function renderPlayer(snapshot: PlayerSnapshot): void {
  const station = snapshot.station ?? selectedStation;
  const name = byId<HTMLSpanElement>("player-name");
  const detail = byId<HTMLSpanElement>("player-detail");
  const playButton = byId<HTMLButtonElement>("play-button");
  const state = byId<HTMLSpanElement>("play-state");
  const art = byId<HTMLDivElement>("player-art");

  name.textContent = station?.name ?? "Nothing selected";
  detail.textContent = station
    ? [station.country || "Unknown location", station.codec || "Internet radio", station.bitrate ? `${station.bitrate} kbps` : ""].filter(Boolean).join(" · ")
    : "Choose a station from the directory";

  const image = station ? safeImageUrl(station.favicon) : "";
  art.innerHTML = image
    ? `<img src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer" />`
    : `<span>${station ? escapeHtml(stationInitials(station.name)) : "FM"}</span>`;

  playButton.disabled = !station || snapshot.loading;
  playButton.innerHTML = snapshot.playing ? icon.pause : icon.play;
  playButton.setAttribute("aria-label", snapshot.playing ? "Pause station" : "Play selected station");
  playButton.title = snapshot.playing ? "Pause station" : "Play selected station";

  state.textContent = snapshot.error
    ? "ERROR"
    : snapshot.loading
      ? "BUFFERING"
      : snapshot.playing
        ? "ON AIR"
        : station
          ? "READY"
          : "READY";

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
    else renderView();
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
  if (activeView === "favorites") {
    renderStations();
    return;
  }
  activeView = activeView === "discover" ? "discover" : "stations";
  renderView();
  void loadStations(searchInput.value.trim());
});

byId<HTMLButtonElement>("refresh-button").addEventListener("click", () => {
  if (activeView === "favorites") void loadFavoriteStations();
  else void loadStations(searchInput.value.trim());
});

sortSelect.addEventListener("change", renderStations);

byId<HTMLButtonElement>("play-button").addEventListener("click", () => {
  const current = player.snapshot.station;
  const target = selectedStation ?? current;
  if (!target) return;

  if (current?.stationuuid === target.stationuuid) {
    void player.toggle();
  } else {
    void player.play(target);
  }
});

byId<HTMLInputElement>("volume-slider").addEventListener("input", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const value = Number(input.value);
  player.setVolume(value);
  byId<HTMLSpanElement>("volume-value").textContent = String(Math.round(value * 100));
});



window.addEventListener("resize", () => stationMap.invalidateSize());

void WinJS.UI.processAll().then(() => {
  hubControl = byId<HTMLElement>("radio-hub").winControl;
  stationListControl = new WinJS.UI.ListView(stationList, {
    layout: { type: WinJS.UI.ListLayout },
    selectionMode: "none",
    tapBehavior: "none",
    swipeBehavior: "none",
    itemTemplate: createStationItem
  });
  stationListControl.element.addEventListener("contentanimating", (event: Event) => event.preventDefault());
  renderView();
  void loadStations();
}).catch((error: unknown) => {
  console.error("WinJS initialization failed.", error);
  setListMessage("The station interface could not be initialized.", true);
});
