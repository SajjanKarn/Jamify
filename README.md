<p align="center">
  <img src="demo-ss.png" alt="Jamify — listen together" width="100%" />
</p>

<h1 align="center">Jamify</h1>

<p align="center">
  A YouTube-powered music streaming prototype with shared <b>jam</b> rooms.
  One host controls playback, everyone in the room hears the same track at the same time.
</p>

<p align="center">
  <a href="#what-is-it">What is it</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#how-jam-rooms-work">How jam rooms work</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#reverse-engineering-notes">REA notes</a> ·
  <a href="#known-limitations">Limitations</a>
</p>

---

## What is it

Jamify is a Spotify-styled web player that streams audio straight from YouTube (no files, no uploads) and lets you start a **jam session** anyone can join with a 6-letter code.

- **Search & play** — YouTube results stream into a personal queue with prev/next/seek.
- **Jam rooms** — start a room, share the code, and every listener hears what you hear, perfectly in sync.
- **Shared queue** — participants can add tracks, the host decides what plays.
- **Drift correction** — server-anchored clock means nobody drifts out of beat.
- **Survives a refresh** — host reloads the page, audio keeps going, host reclaims control when they're back.

## Quick start

```bash
cd jamify
npm install
npm run dev          # starts frontend (5173) + backend (3001)
```

Then open <http://localhost:5173>.

You'll need **`yt-dlp`** on your PATH for the server's stream-URL fallback (only used when YouTube's `adaptiveFormats` come back ciphered):

```bash
brew install yt-dlp        # or pipx install yt-dlp
```

> **One thing to know**: YouTube's Web client sometimes returns `signatureCipher` blobs instead of direct HTTPS URLs. Jamify transparently falls back to `yt-dlp --get-url -f bestaudio` to get a real playable URL.

## How jam rooms work

1. **Start a room** from the lobby — the server gives you a code and a `hostSecret` (kept in `localStorage`).
2. **Share the code** — anyone joining becomes a *participant*. They can search, queue tracks, and react.
3. **You stay in control** — only the host's Play / Pause / Next / Prev / Seek actually drive the room.
4. **Drift stays bounded** — each client extrapolates the current position from `playingStartedAt` and re-anchors when its `audio.currentTime` drifts more than 500 ms.

If the host disconnects, the room keeps playing for everyone else. They have a 5-minute grace window to reclaim the host slot using the secret. If nobody reclaims in time, the room is closed and a new host is auto-elected from the first remaining member.

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

- **Identity**: name only, persisted in `localStorage`. No login.
- **Source of truth**: the host's player. The server mirrors `currentTrackId`, `isPlaying`, and the play clock; clients extrapolate from the last `room_state` event.
- **Sync protocol**: every host action emits a full `room_state` snapshot to all members over Socket.IO. Cheap for a prototype; doesn't scale past ~50 listeners.
- **Streaming URLs**: each video's InnerTube `player` response yields a direct HTTPS audio URL plus `expiresInSeconds`. Clients cache by `(trackId, expiresAt)` so most participants share one URL.
- **yt-dlp fallback**: when YouTube returns `signatureCipher` blobs (the common case for the Web client), the server spawns `yt-dlp --get-url -f bestaudio` to decrypt the signature. The macOS Python CA bundle is auto-detected and exported via `SSL_CERT_FILE`.
- **Auto-play after reload**: the audio element is muted *before* `play()` is called — every modern browser (Chrome, Safari, Firefox) allows muted autoplay without a user gesture, so a host refresh resumes automatically. The element unmutes itself as soon as `canplay` fires.

## Tech stack

| Layer | What |
| --- | --- |
| UI | React + TypeScript + Vite |
| Styling | Tailwind (Spotify-tuned palette: `#121212` background, `#1ed760` brand, Inter) |
| State | Zustand |
| Real-time | Socket.IO |
| Backend | Express |
| Streaming | YouTube InnerTube (`youtubei/v1/player`, `youtubei/v1/search`) + `yt-dlp` |
| Audio | A single, always-mounted HTML5 `<audio>` element survives route changes |

## Project layout

```
jamify/
├── server/
│   ├── index.ts          Express + Socket.IO entry point
│   ├── innertube.ts      YouTube InnerTube (search + player) helper + yt-dlp fallback
│   └── rooms.ts          In-memory jam room store (host election, grace window, queue)
├── src/
│   ├── main.tsx          React Router setup
│   ├── index.css         Tailwind + custom seek slider
│   ├── pages/
│   │   ├── Home.tsx      Search + personal queue
│   │   ├── JamLobby.tsx  Create / join a room
│   │   └── JamRoom.tsx   Player, queue, members, search
│   └── lib/
│       ├── types.ts
│       ├── socket.ts     Singleton Socket.IO client
│       └── store.ts      Zustand store with sync logic
├── demo-ss.png
├── package.json
├── vite.config.ts        Proxies /api + /socket.io to :3001
└── README.md
```

## Reverse-engineering notes

This project's UX was informed by reverse-engineering **Youtify v1.8.6** (Android APK, `ai.apps.youtify`) with REA. Youtify is a rebranded fork of [BlackHole](https://github.com/Sangwan5688/BlackHole), an open-source Flutter music player, with ad-removal patches and YouTube-Music tweaks. Profile was captured in `/Users/sajjankarna/REA/Youtify_1.8.6_...apk`.

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
| Modded indicators | ELF shims `libbasichook.so`, `libcorecall.so`, `libmetadata_god.so` |

### Youtify → Jamify mapping

| Youtify feature | Youtify internals | Jamify |
| --- | --- | --- |
| YouTube search | `youtubei/v1/search` | Same endpoint, same `WEB` client name (`server/innertube.ts`) |
| Audio playback | `just_audio` + InnerTube `player` → `streamingData.adaptiveFormats` | Same. `server/innertube.ts` resolves the highest-bitrate audio-only stream. |
| Background queue | `audio_service` | Client-side Zustand store + Socket.IO room state |
| Lyrics | `flutter_lyric` | Out of scope (no lyrics API in room sync) |
| Themes / palette | `palette_generator` | Future work |
| Local audio (`on_audio_query`) | Dart scan of device media | Out of scope — prototype streams only |
| Settings / Hive | local DB | LocalStorage only (username) for now |
| **Sharing / sync across users** | Not present | **Jamify's jam feature** |
| **Queue additions by participants** | Not present | **Jamify's `add_to_queue`** |
| **Host-authoritative playback** | N/A | **Jamify's `host_play` / `host_pause` / `host_seek` / `host_next`** |
| **Drift-corrected clients** | N/A | Server-anchored clock; clients re-anchor when drift > 500 ms |

The "jam" feature is the new design — there's nothing analogous in Youtify.

### What was deliberately *not* copied

- No Youtify / BlackHole code, packages, assets, or icon set.
- No YouTube cookie auth, no InnerTube TV/ANDROID/MWEB clients (more restricted), no PoToken flow (none required for the public Web key).
- No Invidious/Piped proxy — direct InnerTube + yt-dlp is sufficient for a prototype.
- No Spotify link-out (Youtify has one via `accounts.spotify.com/authorize?client_id=...`).
- No ad SDK.

## Known limitations

- **In-memory room store.** Restart = rooms gone. Swap for Redis or Postgres later.
- **Single-process server, single tab per client.** Multi-tab participants will fight over the host's audio element.
- **YT InnerTube Web key can be rate-limited or rotated by Google.** The prototype will break if the key changes; swap for an Invidious proxy in production.
- **No lyrics, no local files, no playlists.** The prototype focuses on the search → jam → sync loop.
- **No reconnection mid-track for participants.** Refresh = rejoin the room. (The host now auto-recovers via the muted-autoplay trick + `hostSecret` in `localStorage`.)

## License

Prototype code is original. The REA profile of Youtify v1.8.6 is a documentation artifact about a third-party app; no Youtify or BlackHole code is included in this repository.
