# Jamify

A music streaming prototype with shared **jam** rooms.

This project exists in two halves:

1. **An REA-based reverse-engineering profile of Youtify v1.8.6** (Android APK), captured in `/Users/sajjankarna/REA/Youtify_1.8.6_...apk`.
2. **An independent web prototype** that implements the music-streaming + jam-room concepts in original code (no copied code, assets, or API contract from Youtify).

## What we learned from Youtify (with REA)

Youtify v1.8.6 (`ai.apps.youtify`) is **a rebranded fork of [BlackHole](https://github.com/Sangwan5688/BlackHole)**, an open-source Flutter music player, with ad-removal patches and a few YouTube-Music-specific tweaks. Confirmed via `aapt2 dump xmltree` and string analysis of `lib/arm64-v8a/libapp.so`.

### Profile

| Property | Value |
| --- | --- |
| Package | `ai.apps.youtify` |
| Version | 1.8.6 (code 86) |
| minSdk / targetSdk | 21 / 34 |
| Native code | arm64-v8a |
| App framework | Flutter (`com.ryanheise.audioservice.AudioServiceActivity`) |
| Background audio | `audio_service` plugin (`MediaBrowserService` + `MediaSessionService`) |
| Streaming backend | YouTube InnerTube (`youtubei/v1/player`, `youtubei/v1/search`) |
| InnerTube key (public Web client) | `AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w` |
| YT Music endpoints | `music/get_search_suggestions`, `music/nav`, `music/playlist`, `music/privacy` |
| Spotify deep link | `accounts.spotify.com/api/token` (client_id `80a49c7111088100a233b2ae788e1f48`) |
| Telemetry | Firebase Analytics, Google Mobile Ads |
| In-App Billing | Yes |
| Deep link schemes | `blackhole://`, `app://blackhole/play` |
| Modded indicators | `com.hm.speedremoveads.RMApplication`; ELF shims `libbasichook.so`, `libcorecall.so`, `libmetadata_god.so` |

### Dart packages observed in libapp.so (Dart AOT snapshot string pool)

```
audio_service, audio_session, just_audio (via ryanheise), on_audio_query,
youtube_explode_dart, flutter_lyric, hive / hive_flutter, cloud_firestore,
firebase_auth, get_it, provider, http, flutter_cache_manager, palette_generator,
flutter_rust_bridge, dart_des, audiotagger, flutter_archive, file_picker,
permission_handler, connectivity_plus, google_mobile_ads, share_plus,
receive_sharing_intent, url_launcher, webview_flutter, app_links, sqflite,
cached_network_image, carousel_slider, fading_edge_scrollview, flip_card,
persistent_bottom_nav_bar, sliding_up_panel, sizer, cupertino_icons,
material_design_icons_flutter, html, xml, petitparser, string_scanner,
collection, crypto, mime, uuid, synchronized, archive, source_span,
vector_math, term_glyph, typed_data, characters, clock, cross_file,
device_info_plus, package_info_plus, path_provider, platform,
rxdart, freezed_annotation, html_unescape, palette_generator, octo_image,
metadata_god (custom)
```

These confirm BlackHole's feature set: local audio playback, lyrics display, theme extraction from album art, favorites/cache via Hive, optional Firestore sync for lyrics/queue, ad-supported with ad-removal mod.

### Youtify → Jamify feature mapping

| Youtify feature | Where it lives | Jamify mapping |
| --- | --- | --- |
| YouTube search | `youtubei/v1/search` | Same endpoint, same `WEB` client name (`server/innertube.ts`) |
| Audio playback | `just_audio` + InnerTube `player` -> `streamingData.adaptiveFormats` | Same. `server/innertube.ts` resolves the highest-bitrate audio-only stream. |
| Background queue | `audio_service` | Client-side Zustand store + Socket.IO room state |
| Lyrics | `flutter_lyric` (and lyrics fetched via `music/get_search_suggestions`) | Out of scope for prototype (no lyrics API in room sync) |
| Themes / palette | `palette_generator` | Future work (auto extract from album art) |
| Local audio (`on_audio_query`) | Dart scan of device media | Out of scope — prototype streams only |
| Settings / Hive | local DB | LocalStorage only (username) for now |
| **Sharing / sync across users** | **Not present in Youtify** | **Jamify's jam feature** |
| **Queue additions by participants** | **Not present in Youtify** | **Jamify's `add_to_queue`** |
| **Host-authoritative playback** | **N/A** | **Jamify's `host_play` / `host_pause` / `host_seek` / `host_next`** |
| Drift-corrected clients | N/A | Server-anchored clock; clients re-anchor when drift > 500ms |
| **Standalone player (no room)** | `just_audio` plays locally; no remote sync | `MiniPlayer` (search result ▶ Play / + Queue), persistent personal queue, prev/next/seek |

The "jam" feature is the new design — there's nothing analogous in Youtify.

## Run the prototype

```
cd /Users/sajjankarna/REA/jamify
npm install
npm run dev
```

Then open `http://localhost:5173`.

- `npm run server` starts the Express + Socket.IO backend on `:3001`.
- `npm run web` starts the Vite + React frontend on `:5173`. Vite proxies `/api` and `/socket.io` to the backend.

## Architecture

```
┌──────────────────┐    HTTP /api/*          ┌──────────────────────┐
│  Vite + React    │ ───────────────────────▶│ Express + Socket.IO  │
│  (5173)          │                         │   (3001)             │
│                  │ ◀─── Socket.IO /ws ──── │                      │
│  Zustand store   │                         │  InnerTube → yt-dlp  │
│  HTML5 <audio>   │                         │   (innertube.ts)     │
└──────────────────┘                         └──────────────────────┘
```

- **Identity**: name only, persisted in localStorage. No login. (Youtify has Firebase Auth; this prototype skips it.)
- **Playback**: the host's player is the source of truth. Server tracks `currentTrackId`, `isPlaying`, `playingStartedMs`, `playingStartedAt` (epoch ms). Clients compute the current position from the server-anchored clock and drift-correct when off by >500 ms.
- **Sync protocol**: every host action rebroadcasts full room state to all members via Socket.IO. Cheap for prototype; scales poorly past ~50 members.
- **Streaming URLs**: each videoId's InnerTube `player` response gives an `adaptiveFormats[]` entry with a direct HTTPS audio URL plus `expiresInSeconds`. Clients cache by `(trackId, expiresAt)` so most participants share one URL.
- **yt-dlp fallback**: YouTube now returns `signatureCipher` blobs (not direct URLs) for most Web client requests. The server falls back to spawning `yt-dlp --get-url -f bestaudio` which decrypts the signature and yields a real playable URL. macOS Python's missing CA bundle is auto-detected and exported via `SSL_CERT_FILE`.

## What was deliberately *not* copied

- No Youtify / BlackHole code, packages, assets, or icon set.
- No YouTube cookie auth, no innerTube TV/ANDROID/MWEB clients (more restricted), no PoToken flow (none required for public Web key).
- No Invidious/Piped proxy — direct InnerTube + yt-dlp is sufficient for a prototype.
- No Spotify link-out (Youtify has one via `accounts.spotify.com/authorize?client_id=...`).
- No ad SDK.

## File map

```
/Users/sajjankarna/REA/jamify/
├── server/
│   ├── index.ts          Express + Socket.IO entry point
│   ├── innertube.ts      YouTube InnerTube (search + player) helper
│   └── rooms.ts          In-memory jam room store
├── src/
│   ├── main.tsx          React Router setup
│   ├── index.css         Tailwind + custom seek slider
│   ├── pages/
│   │   ├── Home.tsx      Search + add-to-queue
│   │   ├── JamLobby.tsx  Create / join a room
│   │   └── JamRoom.tsx   Player, queue, members, search
│   └── lib/
│       ├── types.ts
│       ├── socket.ts     Singleton Socket.IO client
│       └── store.ts      Zustand store with sync logic
├── package.json
├── vite.config.ts        Proxies /api + /socket.io to :3001
└── README.md
```

## Known limitations (intentional, for a prototype)

- In-memory room store. Restart = rooms gone. Swap for Redis or Postgres later.
- No reconnection/resync. Refresh = rejoin the room.
- Single-process server, single tab per client. Multi-tab participants will fight over the host's audio element.
- YT InnerTube Web key can be rate-limited or rotated by Google. The prototype will break if the key changes; swap for an Invidious proxy in production.
- Browser autoplay restrictions mean users must interact with the page before audio plays. The host must press Play once.