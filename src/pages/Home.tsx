import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJamStore } from "../lib/store";
import { PlayIcon, PauseIcon, SearchIcon, XIcon, GroupIcon } from "../components/icons";

const SUGGESTIONS = [
  "Pink Floyd",
  "King Crimson",
  "Tool",
  "Black Label Society",
  "Led Zeppelin",
  "Black Sabbath",
];

export default function Home() {
  const nav = useNavigate();
  const { search, searchResults, personalAdd } = useJamStore();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Initial browse.
  React.useEffect(() => {
    search("Pink Floyd greatest hits");
  }, [search]);

  // Debounced auto-search as the user types.
  React.useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        await search(trimmed);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      setLoading(false);
    };
  }, [q, search]);

  // Cmd/Ctrl+K focuses search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await search(q.trim() || "Pink Floyd greatest hits");
    } finally {
      setLoading(false);
    }
  }

  const showEmpty = q.trim().length > 0 && searchResults.length === 0 && !loading;
  const showInitial = q.trim().length === 0;

  return (
    <div className="pt-2">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Good evening</h2>

      {/* Mobile-only entry point: on big screens the sidebar + topbar
          already expose the Jam lobby, but on phones both are hidden. */}
      <button
        onClick={() => nav("/jam")}
        className="md:hidden mb-4 w-full flex items-center gap-3 bg-gradient-to-r from-brand to-brand-accent text-black rounded-xl px-4 py-3 font-bold shadow-lg active:scale-95 transition"
      >
        <GroupIcon className="text-xl shrink-0" />
        <span className="flex-1 text-left">Start or join a jam</span>
        <span className="text-sm opacity-70">→</span>
      </button>

      <form onSubmit={onSubmit} className="search-pill mb-2">
        <SearchIcon className="text-ink-secondary text-base shrink-0" />
        <input
          ref={inputRef}
          placeholder="What do you want to play?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0"
        />
        {q && (
          <button
            type="button"
            className="btn-icon !p-1 text-ink-secondary hover:text-white shrink-0"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <XIcon className="text-sm" />
          </button>
        )}
        {loading ? (
          <span
            className="inline-block w-4 h-4 rounded-full border-2 border-ink-secondary border-t-transparent animate-spin shrink-0"
            aria-label="Loading"
          />
        ) : (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-ink-secondary font-mono shrink-0">
            ⌘K
          </kbd>
        )}
      </form>

      {showInitial && (
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="px-3 py-1 rounded-full bg-spotify-surface-2 hover:bg-spotify-surface-3 text-sm text-ink-secondary hover:text-white transition"
              onClick={() => setQ(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between mb-3 sm:mb-4 gap-2">
        <h3 className="text-lg sm:text-2xl font-bold truncate">
          {showInitial ? "Trending" : `Results for "${q.trim()}"`}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className={`px-3 py-1 rounded-full text-xs ${view === "grid" ? "bg-white text-black" : "text-ink-secondary hover:text-white"}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            className={`px-3 py-1 rounded-full text-xs ${view === "list" ? "bg-white text-black" : "text-ink-secondary hover:text-white"}`}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </div>

      {showEmpty ? (
        <div className="py-16 text-center text-ink-secondary">
          <p className="text-white font-semibold mb-1">No matches</p>
          <p className="text-sm">Try different keywords or one of the trending searches.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {searchResults.map((t) => (
            <article key={t.id} className="tile group cursor-pointer" onDoubleClick={() => personalAdd(t, true)}>
              <div className="relative">
                <img
                  src={t.thumbnail}
                  alt=""
                  className="w-full aspect-square object-cover rounded shadow-lg"
                  loading="lazy"
                />
                <button
                  className="btn-circle-lg absolute bottom-2 right-2 w-11 h-11 shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    personalAdd(t, true);
                  }}
                  aria-label={`Play ${t.title}`}
                >
                  <PlayIcon className="text-lg ml-0.5" />
                </button>
              </div>
              <div className="mt-3">
<div className="font-semibold truncate" title={t.title}>{t.title}</div>
              <div className="text-sm text-ink-secondary truncate" title={t.artist}>{t.artist}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {searchResults.map((t, i) => (
            <article
              key={t.id}
              className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-2 py-2 rounded-md hover:bg-spotify-surface-2 group"
            >
              <span className="text-ink-secondary w-6 text-right tabular-nums">{i + 1}</span>
              <div className="flex items-center gap-3 min-w-0">
                <img src={t.thumbnail} alt="" className="w-10 h-10 rounded" />
                <div className="min-w-0">
                  <div className="truncate" title={t.title}>{t.title}</div>
                  <div className="text-sm text-ink-secondary truncate" title={t.artist}>{t.artist}</div>
                </div>
              </div>
              <span className="text-xs text-ink-secondary tabular-nums">
                {Math.floor((t.durationSec || 0) / 60)}:{((t.durationSec || 0) % 60).toString().padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="btn-circle-md opacity-0 group-hover:opacity-100"
                  onClick={() => personalAdd(t, true)}
                  aria-label="Play"
                >
                  <PlayIcon className="text-base" />
                </button>
                <button
                  className="btn-icon text-ink-secondary hover:text-white !p-1.5 opacity-0 group-hover:opacity-100"
                  onClick={() => personalAdd(t, false)}
                  aria-label="Add to queue"
                  title="Add to queue"
                >
                  +
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}