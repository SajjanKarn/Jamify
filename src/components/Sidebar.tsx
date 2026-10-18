import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useJamStore } from "../lib/store";
import {
  HomeIcon,
  SearchIcon,
  GroupIcon,
  PlusIcon,
  LibraryIcon,
  CrownIcon,
  PlayIcon,
} from "./icons";

export default function Sidebar() {
  const nav = useNavigate();
  const personalQueue = useJamStore((s) => s.personalQueue);
  const room = useJamStore((s) => s.room);
  const myId = useJamStore((s) => s.myId);
  const myName = useJamStore((s) => s.myName);
  const myRole = useJamStore((s) => s.myRole);
  const isPlaying = useJamStore((s) =>
    s.room ? s.room.isPlaying : s.personalPlaying,
  );

  // "Jam" nav is smart: if you're in a room, jump straight back to it.
  // Otherwise the lobby.
  const jamTarget = room ? `/jam/${room.id}` : "/jam";

  return (
    <aside className="hidden md:flex flex-col gap-2 w-64 h-full p-2 shrink-0">
      {/* Primary nav */}
      <nav className="bg-spotify-surface rounded-lg p-2 flex flex-col gap-1">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-item-active" : "nav-item")}>
          <HomeIcon className="text-xl" /> Home
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? "nav-item-active" : "nav-item")}>
          <SearchIcon className="text-xl" /> Search
        </NavLink>
        <NavLink to={jamTarget} className={({ isActive }) => (isActive ? "nav-item-active" : "nav-item")}>
          <GroupIcon className="text-xl" />
          {room ? `Room ${room.id}` : "Jam"}
        </NavLink>
      </nav>

      {/* Library / queue */}
      <div className="bg-spotify-surface rounded-lg flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <NavLink
            to="/library"
            className={({ isActive }) => (isActive ? "nav-item-active !p-0" : "nav-item !p-0")}
          >
            <LibraryIcon className="text-xl" /> Your Queue
          </NavLink>
          <button
            className="btn-icon !p-1.5"
            title="Create room"
            onClick={() => nav("/jam")}
          >
            <PlusIcon className="text-base" />
          </button>
        </div>

        <div className="px-2 pb-2 overflow-y-auto flex-1 min-h-0">
          {!room && personalQueue.length === 0 && (
            <div className="px-3 py-6 text-center text-ink-secondary text-sm">
              <p className="font-semibold text-white mb-1">Songs you add will show up here</p>
              <p>Save tracks by tapping the + on any track.</p>
            </div>
          )}
          <ul className="space-y-1">
            {!room &&
              personalQueue.map((t, i) => (
                <li
                  key={`${t.id}-${i}`}
                  className="grid grid-cols-[auto_1fr] gap-3 items-center p-2 rounded-md hover:bg-spotify-surface-2 cursor-pointer"
                >
                  <img src={t.thumbnail} alt="" className="w-12 h-12 rounded" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="truncate text-xs text-ink-secondary">{t.artist}</div>
                  </div>
                </li>
              ))}
            {room && (
              <li className="mt-3">
                <button
                  onClick={() => nav(`/jam/${room.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-brand/10 ring-1 ring-brand/30 hover:bg-brand/20 transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-brand text-black flex items-center justify-center shrink-0">
                    {isPlaying ? (
                      <span className="block w-2 h-2 rounded-full bg-black animate-pulse" />
                    ) : (
                      <CrownIcon className="text-base" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-sm truncate">
                      {myRole === "host" ? "Hosting" : "In a jam"}
                    </div>
                    <div className="text-xs text-ink-secondary truncate">
                      Room {room.id}
                    </div>
                  </div>
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* "Now playing" mini-player indicator — persists across the app */}
      {(() => {
        const track = room
          ? room.queue.find((t) => t.id === room.currentTrackId) ?? null
          : personalQueue[0] ?? null;
        if (!track) return null;
        return (
          <button
            onClick={() => {
              if (room) nav(`/jam/${room.id}`);
            }}
            className="bg-spotify-surface hover:bg-spotify-surface-hover rounded-lg p-3 flex items-center gap-3 transition text-left"
            title="Open now playing"
          >
            <div className="relative w-12 h-12 rounded overflow-hidden shrink-0">
              <img src={track.thumbnail} alt="" className="w-12 h-12 object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <PlayIcon className="text-sm text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-ink-secondary font-bold">
                Now playing
              </div>
              <div className="truncate text-sm font-medium" title={track.title}>{track.title}</div>
              <div className="truncate text-[10px] text-ink-secondary" title={track.artist}>
                {track.artist}
              </div>
            </div>
          </button>
        );
      })()}
    </aside>
  );
}