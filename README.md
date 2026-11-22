# nearFM Client

A map-based internet radio client powered by Radio Browser.

nearFM is designed as a browser-based radio application rather than a conventional content website. The first client iteration focuses on station discovery, geographic browsing, playback, and live audio visualization.

## Features

- Radio Browser station directory with popular stations and name search
- World map with station markers when geographic coordinates are available
- Station selection from either the map or directory
- Internet radio playback through the browser's audio element
- Now Playing panel with playback state and volume control
- Live frequency visualization through the Web Audio API when the stream permits CORS audio analysis
- Direct playback fallback when Web Audio analysis is unavailable for a stream
- Local favorites stored in the current browser

## Deploy with Cloudflare Pages

Connect the `nearFM/client` GitHub repository using Cloudflare Pages Git integration. Use these build settings:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/` (repository root)

The Vite base path is relative, so the same build works on the `pages.dev` hostname and a custom domain.

## Development

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Create a production build:

```sh
npm run build
npm run preview
```

## Data and services

- Station metadata and resolved stream URLs: [Radio Browser](https://www.radio-browser.info/)
- Map tiles: [CARTO](https://carto.com/attributions/) based on OpenStreetMap data
- Map library: [Leaflet](https://leafletjs.com/)

Radio Browser is a community service provided without an uptime guarantee. The client uses the `all.api.radio-browser.info` endpoint and handles directory failures in the UI.

A station's coordinates may be missing, so not every station appears on the map. A stream may play normally while blocking Web Audio analysis through its cross-origin policy; in that case the client falls back to direct playback and disables the visualizer for that station.

The browser may also block insecure HTTP streams when the application is served over HTTPS.

## License

BSD 3-Clause. See [LICENSE](./LICENSE).
