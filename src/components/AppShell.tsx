import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import NowPlayingBar from "./NowPlayingBar";
import { useJamStore } from "../lib/store";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Home",
  "/search": "Search",
  "/library": "Your Queue",
  "/jam": "Jam",
};

export default function AppShell() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const room = useJamStore((s) => s.room);
  const bindAudio = useJamStore((s) => s.bindAudio);

  // The single audio element lives here, always mounted. Routes that
  // change underneath us don't unmount it — playback survives.
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  React.useEffect(() => {
    if (audioRef.current) bindAudio(audioRef.current);
  }, [bindAudio]);

  let title = ROUTE_TITLES["/"] ?? "Home";
  for (const [prefix, t] of Object.entries(ROUTE_TITLES)) {
    if (pathname.startsWith(prefix) && prefix.length >= title.length) {
      title = t;
    }
  }
  if (pathname.startsWith("/jam/")) title = "Jam Room";

  return (
    <div className="h-full flex flex-col bg-spotify-bg overflow-hidden">
      {/* Audio is in flow but zero-sized and invisible. position:fixed
          instead of absolute so it can't be pushed by any flex layout. */}
      <audio
        ref={audioRef}
        preload="auto"
        className="opacity-0 pointer-events-none fixed"
        style={{ width: 0, height: 0, top: 0, left: 0 }}
      />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-spotify-surface to-spotify-bg overflow-hidden">
          <TopBar title={title} />
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(theme(spacing.16)+1rem)] sm:pb-24">
            <div className="max-w-7xl mx-auto w-full min-w-0 px-3 sm:px-6 pt-2 pb-6 sm:pb-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <NowPlayingBar />
    </div>
  );
}