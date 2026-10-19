// YouTube streaming URL resolution.
//
// We use a two-step strategy:
//   1. Try the InnerTube `player` endpoint (cheap, ~1 req per track).
//      If it returns a direct `url` (progressive/adaptive), use it.
//   2. Fall back to spawning `yt-dlp --get-url --format bestaudio`,
//      which handles signature decryption and yields a real URL.
//
// Both branches go through the same { audioUrl, expiresAt, track } shape
// the client expects.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fetch } from "undici";
import { getCookiesPath } from "./cookies.js";

const INNER_TUBE_BASE = "https://www.youtube.com/youtubei/v1";
const WEB_API_KEY = process.env.YT_API_KEY ?? "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y_YfRv9c";
const CLIENT_VERSION = "2.20240101.00.00";

// yt-dlp binary resolution. Priority:
//   1. `YT_DLP_BIN` env var (CI / container paths)
//   2. Common absolute locations across dev hosts and Render
//   3. `<cwd>/.bin/yt-dlp` — self-install fallback (next to server)
//   4. Bare `yt-dlp` so PATH resolution handles Homebrew, Linux
//      packages, pipx, etc.
function resolveYtDlpBin(): string {
  if (process.env.YT_DLP_BIN && existsSync(process.env.YT_DLP_BIN)) {
    return process.env.YT_DLP_BIN;
  }
  const candidates = [
    "/usr/local/bin/yt-dlp",          // Render build / Linux system
    "/usr/bin/yt-dlp",                // apt / system installs on Linux
    "/opt/homebrew/bin/yt-dlp",       // Homebrew (Apple Silicon)
    "/usr/local/bin/yt-dlp_macos",    // legacy Homebrew (Intel)
    "/Users/sajjankarna/Library/Python/3.13/bin/yt-dlp", // personal dev box
    `${process.cwd()}/.bin/yt-dlp`,   // self-install fallback
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "yt-dlp"; // last resort: rely on PATH
}

// Resolve on every call so the runtime self-install (which lands the
// binary *after* module load) is visible without a server restart.
export function getYtDlpBin(): string {
  return resolveYtDlpBin();
}
// Backwards-compatible constant: resolved at module load, used by
// other modules that only need the boot-time best guess.
export const YT_DLP_BIN = resolveYtDlpBin();
export function selfInstallPath(): string {
  return `${process.cwd()}/.bin/yt-dlp`;
}

// Lightweight status info the dashboard / status endpoint can read.
export function ytDlpStatus(): {
  resolved: string;
  selfInstallPath: string;
  selfInstallExists: boolean;
} {
  return {
    resolved: resolveYtDlpBin(),
    selfInstallPath: selfInstallPath(),
    selfInstallExists: existsSync(selfInstallPath()),
  };
}

// macOS system Python often lacks a working CA bundle. Locate the certifi
// cacert.pem (pip-installed next to the binary) so yt-dlp can verify TLS.
function locateCertBundle(): string | undefined {
  const candidates = [
    process.env.SSL_CERT_FILE,
    "/Users/sajjankarna/Library/Python/3.13/lib/python/site-packages/certifi/cacert.pem",
    "/usr/local/lib/python3.13/site-packages/certifi/cacert.pem",
    "/opt/homebrew/lib/python3.13/site-packages/certifi/cacert.pem",
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return undefined;
}

async function innerTube(path: string, body: Record<string, unknown>): Promise<any> {
  const url = `${INNER_TUBE_BASE}/${path}?key=${WEB_API_KEY}&prettyPrint=false`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      ...body,
      context: {
        client: {
          clientName: "WEB",
          clientVersion: CLIENT_VERSION,
          hl: "en",
          gl: "US",
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`InnerTube ${path} failed: ${res.status}`);
  return await res.json();
}

function ytDlpGetUrl(videoId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    const cert = locateCertBundle();
    if (cert) env.SSL_CERT_FILE = cert;
    const args: string[] = [
      "--no-warnings",
      "--no-playlist",
      "--no-progress",
      // iOS client is the most permissive about PO tokens; the
      // formats=missing_pot flag tells yt-dlp to use any format
      // that doesn't strictly require one.
      "--extractor-args", "youtube:player_client=ios,web_safari,android;formats=missing_pot",
      "-f",
      "bestaudio[ext=m4a]/bestaudio/best",
      "-g",
    ];
    const cookiesPath = getCookiesPath();
    if (cookiesPath && existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }
    args.push(videoId);
    const proc = spawn(
      getYtDlpBin(),
      args,
      { stdio: ["ignore", "pipe", "pipe"], env },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`yt-dlp timeout (${videoId})`));
    }, 25_000);
    proc.on("close", (code) => {
      clearTimeout(timeout);
      const url = stdout.trim().split("\n").filter(Boolean).pop();
      if (code === 0 && url) resolve(url);
      else reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(-200)}`));
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  thumbnail: string;
}

// --------------------------------------------------------------------------
// Search
// --------------------------------------------------------------------------
export async function searchTracks(query: string): Promise<Track[]> {
  if (!query.trim()) return [];
  const json: any = await innerTube("search", {
    query,
    params: "EgWKAQIIAVoMEA4QChADEAoQAxAEEAUQCRAFEBEQEBAVEDE",
  });

  const contents =
    json?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

  const tracks: Track[] = [];
  for (const item of contents) {
    const v = item.videoRenderer;
    if (!v?.videoId) continue;
    tracks.push({
      id: v.videoId,
      title: v.title?.runs?.map((r: any) => r.text).join("") ?? v.title?.simpleText ?? "Untitled",
      artist:
        v.ownerText?.runs?.map((r: any) => r.text).join("") ??
        v.longBylineText?.runs?.[0]?.text ??
        "Unknown artist",
      durationSec: parseLength(v.lengthText?.simpleText ?? "0:00"),
      thumbnail:
        v.thumbnail?.thumbnails?.pop()?.url ??
        `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    });
  }
  return tracks;
}

// --------------------------------------------------------------------------
// Stream resolution — InnerTube first, yt-dlp fallback.
// --------------------------------------------------------------------------
export async function resolveStream(videoId: string): Promise<{
  audioUrl: string;
  expiresAt: number;
  track: Track;
}> {
  // Step 1: InnerTube
  let track: Track = {
    id: videoId,
    title: "Untitled",
    artist: "Unknown artist",
    durationSec: 0,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };

  try {
    const json: any = await innerTube("player", { video_id: videoId });
    const details = json?.videoDetails;
    const streaming = json?.streamingData ?? {};
    const expires = Number(streaming?.expiresInSeconds ?? 21540);

    const adaptive = streaming?.adaptiveFormats ?? [];
    const progressive = streaming?.formats ?? [];

    const audioOnly = adaptive
      .filter((f: any) => f.mimeType?.startsWith("audio/") && f.url)
      .sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    const progressiveAudio = progressive
      .filter((f: any) => f.url)
      .sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

    const directUrl = audioOnly?.url ?? progressiveAudio?.url;
    if (directUrl) {
      if (details) {
        track = {
          id: videoId,
          title: details.title ?? track.title,
          artist: details.author ?? track.artist,
          durationSec: Number(details.lengthSeconds ?? 0),
          thumbnail: track.thumbnail,
        };
      }
      return {
        audioUrl: directUrl,
        expiresAt: Date.now() + expires * 1000,
        track,
      };
    }
  } catch {
    /* fall through to yt-dlp */
  }

  // Step 2: yt-dlp fallback. It resolves signature-cipher formats into
  // direct URLs that browsers can play.
  const audioUrl = await ytDlpGetUrl(videoId);
  return {
    audioUrl,
    // Stream URLs typically live 6 hours.
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
    track,
  };
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function parseLength(text: string): number {
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}