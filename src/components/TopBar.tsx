import React from "react";
import { useNavigate } from "react-router-dom";
import { useJamStore } from "../lib/store";
import { ChevronLeftIcon, ChevronRightIcon, GroupIcon } from "./icons";

export default function TopBar({ title }: { title: string }) {
  const nav = useNavigate();
  const room = useJamStore((s) => s.room);
  const myId = useJamStore((s) => s.myId);
  const myName = useJamStore((s) => s.myName);

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 gap-2">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <button
          className="btn-circle-md w-8 h-8 hidden sm:inline-flex"
          onClick={() => nav(-1)}
          aria-label="Go back"
        >
          <ChevronLeftIcon className="text-base" />
        </button>
        <button
          className="btn-circle-md w-8 h-8 hidden sm:inline-flex"
          onClick={() => nav(1)}
          aria-label="Go forward"
        >
          <ChevronRightIcon className="text-base" />
        </button>
        <h1 className="ml-1 sm:ml-3 text-base sm:text-xl font-bold truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {room ? (
          <button
            onClick={() => nav(`/jam/${room.id}`)}
            className="flex items-center gap-1.5 sm:gap-2 bg-spotify-surface-2 hover:bg-spotify-surface-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full transition"
            title="Open jam room"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-white truncate max-w-[80px] sm:max-w-none">
              {room.id}
            </span>
          </button>
        ) : (
          <button
            className="btn-pill bg-white text-black px-3 sm:px-5 h-8 sm:h-9 text-xs sm:text-sm inline-flex items-center gap-1.5"
            onClick={() => nav("/jam")}
          >
            <GroupIcon className="text-sm" />
            <span className="hidden sm:inline">Start a Jam</span>
            <span className="sm:hidden">Jam</span>
          </button>
        )}
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs sm:text-sm shrink-0"
          title={myName || "guest"}
        >
          {(room && myId ? (room.members.find((m) => m.id === myId)?.name ?? myName) : myName ?? "G")
            .slice(0, 1)
            .toUpperCase()}
        </div>
      </div>
    </header>
  );
}