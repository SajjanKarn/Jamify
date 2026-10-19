/**
 * Public-origin helper. Resolves the absolute URL used when sharing
 * jam links. Priority:
 *
 *   1. `import.meta.env.VITE_PUBLIC_URL` (set at build time, e.g. via
 *      `.env.production` or `VITE_PUBLIC_URL=... npm run build`).
 *   2. `window.location.origin` at runtime (so dev and any
 *      un-configured deployment just inherit whatever the user is
 *      browsing on).
 *
 * Always returns without a trailing slash. Falls back to a sane
 * localhost origin during SSR/tests.
 */
export function publicOrigin(): string {
  const fromEnv =
    typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_PUBLIC_URL;

  const raw =
    (fromEnv && fromEnv.trim()) ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "http://localhost:5173";

  return raw.replace(/\/+$/, "");
}

export function jamLink(roomId: string): string {
  return `${publicOrigin()}/jam/${roomId.toUpperCase()}`;
}

/**
 * Backend origin for direct cross-origin API + Socket.IO calls. Set
 * via `VITE_API_URL` when the frontend and backend are on different
 * hosts (e.g. Render static site + Render Web Service). When unset,
 * falls back to the current origin, which works behind a same-origin
 * proxy (Vercel rewrites, local Vite dev proxy).
 */
export function apiOrigin(): string {
  const fromEnv =
    typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_API_URL;
  const raw =
    (fromEnv && fromEnv.trim()) ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "http://localhost:3001";
  return raw.replace(/\/+$/, "");
}
