// YouTube cookies loader.
//
// YouTube gates streams behind "Sign in to confirm you're not a
// bot" when requests come from datacenter IPs (Render, Vercel, AWS,
// etc). The two ways to get past it from a Render deploy are:
//
//   1. A PO Token provider (the bgutil-ytdlp-pot-provider plugin) —
//      not wired in this branch.
//   2. Real YouTube cookies from a logged-in browser session.
//
// This module supports the cookies path. Set `YT_COOKIES_TXT` to
// the full Netscape-format cookies.txt file contents in your
// Render env. On first request we write it to `.bin/cookies.txt`
// and pass `--cookies <path>` to yt-dlp. The path is also exposed
// at `/api/cookies/status` so the user can confirm the deploy
// received the cookies.
//
// Cookies expire every 1-2 weeks; when streams start failing
// again, re-export from your browser and update the env var.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const COOKIES_PATH = join(process.cwd(), ".bin", "cookies.txt");

export interface CookiesState {
  /** Absolute path yt-dlp should be given via --cookies, or null. */
  path: string | null;
  /** Number of bytes in the cookies file (0 if absent). */
  bytes: number;
  /** True if `YT_COOKIES_TXT` env var was present at boot. */
  configured: boolean;
  /** True if the file on disk is older than ~10 days (rotation hint). */
  stale: boolean;
}

let cached: CookiesState | null = null;

/**
 * Write `YT_COOKIES_TXT` (the env var) to disk and return the path.
 * Idempotent: if the file already exists with the same content,
 * no write happens. Logs the cookie count on first write.
 */
export function ensureCookies(): CookiesState {
  if (cached) return cached;

  const raw = process.env.YT_COOKIES_TXT?.trim();
  if (!raw) {
    cached = { path: null, bytes: 0, configured: false, stale: false };
    return cached;
  }

  if (!existsSync(dirname(COOKIES_PATH))) {
    mkdirSync(dirname(COOKIES_PATH), { recursive: true });
  }

  // Skip the write if the existing file already has the same content
  // (avoids restarting yt-dlp's cookie cache every time the env
  // var is re-read on a redeploy).
  if (existsSync(COOKIES_PATH)) {
    try {
      const { readFileSync, statSync } = require("node:fs");
      const existing = readFileSync(COOKIES_PATH, "utf8");
      if (existing === raw) {
        const ageMs = Date.now() - statSync(COOKIES_PATH).mtimeMs;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        cached = {
          path: COOKIES_PATH,
          bytes: existing.length,
          configured: true,
          stale: ageDays > 10,
        };
        return cached;
      }
    } catch {
      /* fall through and rewrite */
    }
  }

  writeFileSync(COOKIES_PATH, raw, { mode: 0o600 });
  const lineCount = raw.split("\n").filter((l) => l && !l.startsWith("#")).length;
  console.log(
    `[cookies] wrote ${raw.length} bytes (${lineCount} entries) to ${COOKIES_PATH}`,
  );
  cached = {
    path: COOKIES_PATH,
    bytes: raw.length,
    configured: true,
    stale: false,
  };
  return cached;
}

export function getCookiesPath(): string | null {
  return ensureCookies().path;
}

export function getCookiesState(): CookiesState {
  return ensureCookies();
}
