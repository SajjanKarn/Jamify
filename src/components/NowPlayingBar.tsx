import React from "react";
import { useJamStore } from "../lib/store";
import {
  PlayIcon,
  PauseIcon,
  SkipPrevIcon,
  SkipNextIcon,
  ShuffleIcon,
  RepeatIcon,
  HeartIcon,
  VolumeIcon,
  MuteIcon,
  QueueIcon,
} from "./icons";

function fmt(ms: number) {
  if (!ms || !isFinite(ms)) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function NowPlayingBar() {
  // ---- Personal state (used when not in a room) ---------------------------
  const personalQueue = useJamStore((s) => s.personalQueue);
  const personalIdx = useJamStore((s) => s.personalIdx);
  const personalPlaying = useJamStore((s) => s.personalPlaying);
  const personalPositionMs = useJamStore((s) => s.personalPositionMs);
  const personalPlay = useJamStore((s) => s.personalPlay);
  const personalPause = useJamStore((s) => s.personalPause);
  const personalNext = useJamStore((s) => s.personalNext);
  const personalPrev = useJamStore((s) => s.personalPrev);
  const personalSeek = useJamStore((s) => s.personalSeek);
  const personalRemove = useJamStore((s) => s.personalRemove);
  const personalClear = useJamStore((s) => s.personalClear);

  // ---- Jam / room state -----------------------------------------------
  const room = useJamStore((s) => s.room);
  const myRole = useJamStore((s) => s.myRole);
  const play = useJamStore((s) => s.play);
  const pause = useJamStore((s) => s.pause);
  const next = useJamStore((s) => s.next);
  const seek = useJamStore((s) => s.seek);

  const audioRef = useJamStore((s) => s.audioRef);
  const playIntent = useJamStore((s) => s.playIntent);
  const acknowledge = useJamStore((s) => s.acknowledgePlayIntent);

  // ---- UI feedback state (always declared for stable hook order) -------
  const [liveMs, setLiveMs] = React.useState(0);
  const [liveDur, setLiveDur] = React.useState(0);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [readyState, setReadyState] = React.useState<number>(0);
  const [actuallyPlaying, setActuallyPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [vol, setVol] = React.useState(0.7);
  const [seeking, setSeeking] = React.useState(false);
  const [seekPreview, setSeekPreview] = React.useState<number | null>(null);
  const lastServerTsRef = React.useRef<number>(Date.now());
  const [queueOpen, setQueueOpen] = React.useState(false);
  const queueWrapRef = React.useRef<HTMLDivElement | null>(null);
  // The browser can fire the HTMLAudioElement `ended` event more than once
  // around the moment a new src is loaded. Track the last track we
  // advanced off of so a duplicate event doesn't re-advance the queue
  // (which would cause the next track to be skipped past).
  const lastEndedTrackIdRef = React.useRef<string | null>(null);

  // ---- What we're showing -----------------------------------------------
  const inJam = !!room;
  const personalTrack = personalIdx >= 0 ? personalQueue[personalIdx] : null;
  const jamTrack = room ? room.queue.find((t) => t.id === room.currentTrackId) ?? null : null;
  const track = inJam ? jamTrack : personalTrack;
  const isHost = myRole === "host";

  // Extrapolated position between server snapshots (room mode) — copy of
  // JamRoom's smoother.
  // Smooth animation loop: derive liveMs from the right source and write
  // it directly to the seek slider DOM at refresh-rate (60fps) to avoid
  // the perceptible lag of a 250ms setInterval poll. The formatted time
  // label still re-renders via React state at a coarser cadence.
  const desktopSeekRef = React.useRef<HTMLInputElement | null>(null);
  const mobileSeekRef = React.useRef<HTMLInputElement | null>(null);
  const desktopTimeRef = React.useRef<HTMLSpanElement | null>(null);
  const mobileTimeRef = React.useRef<HTMLDivElement | null>(null);
  const desktopDurRef = React.useRef<HTMLSpanElement | null>(null);
  const mobileDurRef = React.useRef<HTMLSpanElement | null>(null);
  // dur lives in a ref so the rAF loop can read the latest value
  // without re-subscribing on every render.
  const durRef = React.useRef(0);

  React.useEffect(() => {
    if (!room) return;
    lastServerTsRef.current = Date.now();
    setLiveMs(room.positionMs);
  }, [room?.positionMs, room?.isPlaying]);

  // When the active track changes, clear the ended-guard so the new
  // track's natural end can fire host_next.
  React.useEffect(() => {
    if (room?.currentTrackId) lastEndedTrackIdRef.current = null;
  }, [room?.currentTrackId]);

  React.useEffect(() => {
    if (!room) return;
    let rafId = 0;
    let lastLabelMs = 0;
    const tick = () => {
      const elapsed = room.isPlaying ? Date.now() - lastServerTsRef.current : 0;
      const ms = room.positionMs + elapsed;
      const curDur = durRef.current;
      const pct = curDur > 0 ? Math.min(100, (ms / curDur) * 100) : 0;
      const labelMs = Math.min(ms, curDur || 0);
      const apply = (slider: HTMLInputElement | null, durEl: HTMLSpanElement | null, timeEl: HTMLSpanElement | null) => {
        if (slider && document.activeElement !== slider) slider.value = String(labelMs);
        if (durEl) durEl.textContent = fmt(curDur);
        if (timeEl) timeEl.textContent = fmt(labelMs);
      };
      const trackStyle = (slider: HTMLInputElement | null) => {
        if (!slider) return;
        if (seeking) return; // user is dragging — they're driving the visual
        slider.style.setProperty(
          "--track",
          `linear-gradient(to right, #fff ${pct}%, #4d4d4d ${pct}%)`,
        );
      };
      trackStyle(desktopSeekRef.current);
      trackStyle(mobileSeekRef.current);
      apply(desktopSeekRef.current, desktopDurRef.current, desktopTimeRef.current);
      apply(mobileSeekRef.current, mobileDurRef.current, mobileTimeRef.current);
      // Keep React state fresh for any labels/derivations not yet in refs,
      // but only refresh every ~120 ms to avoid render churn.
      if (labelMs - lastLabelMs > 120 || lastLabelMs - labelMs > 120) {
        lastLabelMs = labelMs;
        setLiveMs(labelMs);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [room, seeking]);

  // Personal-mode animation loop (mirrors the room-mode loop above).
  React.useEffect(() => {
    if (room) return; // only when in personal mode
    let rafId = 0;
    let lastLabelMs = 0;
    const tick = () => {
      const a = audioRef;
      const curDur = durRef.current;
      const ms = a ? a.currentTime * 1000 : 0;
      const pct = curDur > 0 ? Math.min(100, (ms / curDur) * 100) : 0;
      const labelMs = Math.min(ms, curDur || 0);
      const apply = (slider: HTMLInputElement | null, durEl: HTMLSpanElement | null, timeEl: HTMLSpanElement | null) => {
        if (slider && document.activeElement !== slider) slider.value = String(labelMs);
        if (durEl) durEl.textContent = fmt(curDur);
        if (timeEl) timeEl.textContent = fmt(labelMs);
      };
      const trackStyle = (slider: HTMLInputElement | null) => {
        if (!slider || seeking) return;
        slider.style.setProperty(
          "--track",
          `linear-gradient(to right, #fff ${pct}%, #4d4d4d ${pct}%)`,
        );
      };
      trackStyle(desktopSeekRef.current);
      trackStyle(mobileSeekRef.current);
      apply(desktopSeekRef.current, desktopDurRef.current, desktopTimeRef.current);
      apply(mobileSeekRef.current, mobileDurRef.current, mobileTimeRef.current);
      if (labelMs - lastLabelMs > 120 || lastLabelMs - labelMs > 120) {
        lastLabelMs = labelMs;
        setLiveMs(labelMs);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [room, audioRef, seeking]);

  // Local audio clock + event listeners (personal mode). In jam mode
  // we still subscribe to readyState/errors so the bottom bar can
  // surface problems with the host's stream.
  React.useEffect(() => {
    const a = audioRef;
    if (!a) return;
    const onTime = () => {
      // In personal mode the audio element IS the source of truth;
      // in jam mode the room snapshot drives the position. We mirror
      // personal-mode playback only when no room is active.
      if (!room) setLiveMs(a.currentTime * 1000);
      setLiveDur((isFinite(a.duration) ? a.duration : 0) * 1000);
      setReadyState(a.readyState);
    };
    const onErr = () => {
      const code = a.error?.code;
      const msgs: Record<number, string> = {
        1: "Aborted", 2: "Network", 3: "Decode", 4: "Not supported",
      };
      setAudioError(msgs[code ?? -1] ?? `Audio ${code}`);
    };
    const onCanPlay = () => {
      setReadyState(a.readyState);
      setAudioError(null);
      const s = useJamStore.getState();
      // Resume personal playback once enough data is buffered.
      if (!s.room && s.personalPlaying && a.paused) a.play().catch(() => {});
    };
    const onLoadedData = () => {
      setReadyState(a.readyState);
      const s = useJamStore.getState();
      if (!s.room && s.personalPlaying && a.paused) a.play().catch(() => {});
    };
    const onPlay = () => {
      setActuallyPlaying(true);
      acknowledge();
    };
    const onPause = () => setActuallyPlaying(false);
    const onEnded = () => {
      const state = useJamStore.getState();
      const trackId = state.room?.currentTrackId
        ?? state.personalQueue[state.personalIdx]?.id
        ?? null;
      if (!trackId) return;
      if (lastEndedTrackIdRef.current === trackId) return; // duplicate event
      lastEndedTrackIdRef.current = trackId;
      if (state.room) {
        // Only the host advances the shared jam queue. Participants'
        // audio elements also fire `ended` (since everyone plays the
        // same stream) but they shouldn't drive the queue.
        if (state.myRole === "host") state.next();
      } else {
        state.personalNext();
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("error", onErr);
    a.addEventListener("canplay", onCanPlay);
    a.addEventListener("loadeddata", onLoadedData);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    const id = setInterval(onTime, 250);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("error", onErr);
      a.removeEventListener("canplay", onCanPlay);
      a.removeEventListener("loadeddata", onLoadedData);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      clearInterval(id);
    };
  }, [room, audioRef, acknowledge]);

  React.useEffect(() => {
    if (audioRef) audioRef.volume = muted ? 0 : vol;
  }, [vol, muted, audioRef]);

  // Close the queue popover on Escape or click-outside.
  React.useEffect(() => {
    if (!queueOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQueueOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const wrap = queueWrapRef.current;
      if (wrap && !wrap.contains(e.target as Node)) setQueueOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Use mousedown so we close before any click action in the popover
    // would fire; popover-internal clicks still work because the wrap
    // contains the popover via `relative` positioning.
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [queueOpen]);

  // ---- Unified play/pause/seek handlers ---------------------------------
  // Use the *actual* audio element state, not the room snapshot, so
  // that clicking "Pause" on a track that's supposed to be playing but
  // isn't (e.g., right after a host reload where the autoplay was
  // blocked) does the right thing: starts playback instead of being
  // a no-op pause on already-paused audio.
  const actuallyPaused = audioRef ? audioRef.paused : true;
  const doPlay = () => {
    if (inJam) {
      if (audioRef) audioRef.play().catch(() => {});
      play();
    } else {
      personalPlay();
    }
  };
  const doPause = () => {
    if (inJam) {
      pause();
      if (audioRef) audioRef.pause();
    } else {
      personalPause();
    }
  };
  const doNext = () => {
    if (inJam) {
      next();
    } else {
      personalNext();
    }
  };
  const doPrev = () => {
    if (inJam) {
      // No remote prev yet; play() at the host is the only operator.
      return;
    } else {
      personalPrev();
    }
  };
  const commitSeek = (ms: number) => {
    const a = audioRef;
    if (a) a.currentTime = ms / 1000;
    if (inJam) seek(ms);
    else personalSeek(ms);
  };
  const isPlaying = inJam ? !!room?.isPlaying : personalPlaying;
  const dur = liveDur || (track?.durationSec ?? 0) * 1000 || 0;
  const progress = dur > 0 ? Math.min(100, (liveMs / dur) * 100) : 0;
  const hostCanControl = inJam ? isHost : true;

  // Keep the rAF-read ref in sync with the derived duration.
  React.useEffect(() => {
    durRef.current = dur;
  }, [dur]);

  return (
    <footer className="min-h-16 sm:h-20 bg-black border-t border-white/5 px-2 sm:px-4 py-2 sm:py-0 flex items-center gap-2 sm:gap-4 shrink-0 z-20 min-w-0">
      {track ? (
        <>
          {/* Left: track info */}
          <div className="flex items-center gap-2 sm:gap-3 w-2/5 sm:w-[30%] lg:w-[28%] min-w-0">
            <img src={track.thumbnail} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded shrink-0" />
            <div className="min-w-0 flex-1">
              <div
                className="min-w-0 text-xs sm:text-sm font-medium truncate hover:underline cursor-pointer"
                title={track.title}
              >
                {track.title}
              </div>
              <div
                className="min-w-0 text-[10px] sm:text-xs text-ink-secondary truncate hover:underline hover:text-white cursor-pointer"
                title={track.artist}
              >
                {track.artist}
              </div>
            </div>
            <button
              className="hidden md:inline-flex btn-icon !p-2 text-ink-secondary hover:text-brand"
              aria-label="Save to your Liked Songs"
            >
              <HeartIcon className="text-base" />
            </button>
          </div>

          {/* Center: full controls (md+) */}
          <div className="flex-1 hidden md:flex flex-col items-center gap-1 max-w-[40%]">
            <div className="flex items-center gap-4 lg:gap-5 text-ink-secondary">
              <button className="btn-icon !p-1 text-ink-secondary hover:text-white" aria-label="Shuffle">
                <ShuffleIcon className="text-base" />
              </button>
              <button
                className="btn-icon !p-1 disabled:opacity-40"
                aria-label="Previous"
                disabled={inJam ? !hostCanControl : personalIdx <= 0}
                onClick={doPrev}
              >
                <SkipPrevIcon className="text-xl" />
              </button>
              <button
                className="btn-circle-lg w-9 h-9 disabled:opacity-40"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={actuallyPaused ? doPlay : doPause}
              >
                {actuallyPaused ? <PlayIcon className="text-lg ml-0.5" /> : <PauseIcon className="text-lg" />}
              </button>
              <button
                className="btn-icon !p-1 disabled:opacity-40"
                aria-label="Next"
                onClick={doNext}
              >
                <SkipNextIcon className="text-xl" />
              </button>
              <button className="btn-icon !p-1 text-ink-secondary hover:text-white" aria-label="Repeat">
                <RepeatIcon className="text-base" />
              </button>
            </div>

            <div className="flex items-center gap-2 w-full">
              <span ref={desktopTimeRef} className="text-[11px] tabular-nums text-ink-secondary w-10 text-right">{fmt(liveMs)}</span>
              <input
                ref={desktopSeekRef}
                type="range"
                className="spotify flex-1"
                min={0}
                max={dur || 100}
                defaultValue={Math.min(liveMs, dur)}
                disabled={!hostCanControl}
                style={{
                  ["--track" as any]: `linear-gradient(to right, #fff ${seeking && seekPreview != null ? Math.min(100, (seekPreview / dur) * 100) : progress}%, #4d4d4d ${seeking && seekPreview != null ? Math.min(100, (seekPreview / dur) * 100) : progress}%)`,
                  ["--thumb" as any]: "#fff",
                } as React.CSSProperties}
                onPointerDown={() => {
                  if (hostCanControl) setSeeking(true);
                }}
                onChange={(e) => {
                  if (!hostCanControl) return;
                  setSeekPreview(Number(e.target.value));
                }}
                onPointerUp={() => {
                  if (!hostCanControl) return;
                  const ms = seekPreview ?? liveMs;
                  commitSeek(ms);
                  setSeekPreview(null);
                  setSeeking(false);
                }}
                onPointerCancel={() => {
                  setSeekPreview(null);
                  setSeeking(false);
                }}
                aria-label="Seek"
              />
              <span ref={desktopDurRef} className="text-[11px] tabular-nums text-ink-secondary w-10">{fmt(dur)}</span>
            </div>
            {audioError && (
              <div className="text-[10px] text-red-400">{audioError}</div>
            )}
            {!audioError && playIntent && readyState >= 2 && !actuallyPlaying && (
              <button
                className="text-[10px] text-brand underline"
                onClick={() => audioRef?.play().catch(() => {})}
              >
                {inJam ? "Tap to sync audio" : "Tap to enable audio"}
              </button>
            )}
          </div>

          {/* Center: mobile compact (<md) */}
          <div className="flex md:hidden flex-1 flex-col items-stretch justify-center min-w-0 gap-1">
            <div className="flex items-center gap-2">
              <button
                className="btn-icon !p-1 text-ink-secondary hover:text-white shrink-0"
                aria-label="Shuffle"
              >
                <ShuffleIcon className="text-sm" />
              </button>
              <button
                className="btn-icon !p-1 disabled:opacity-40 shrink-0"
                aria-label="Previous"
                disabled={inJam ? !hostCanControl : personalIdx <= 0}
                onClick={doPrev}
              >
                <SkipPrevIcon className="text-base" />
              </button>
              <button
                className="btn-circle-lg w-8 h-8 disabled:opacity-40 shrink-0 mx-auto"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={actuallyPaused ? doPlay : doPause}
              >
                {actuallyPaused ? <PlayIcon className="text-base ml-0.5" /> : <PauseIcon className="text-base" />}
              </button>
              <button
                className="btn-icon !p-1 disabled:opacity-40 shrink-0"
                aria-label="Next"
                onClick={doNext}
              >
                <SkipNextIcon className="text-base" />
              </button>
<div ref={mobileTimeRef} className="text-[10px] tabular-nums text-ink-secondary shrink-0 ml-1">
                {fmt(liveMs)} / <span ref={mobileDurRef} className="tabular-nums">{fmt(dur)}</span>
              </div>
            </div>
            <input
              ref={mobileSeekRef}
              type="range"
              className="spotify w-full"
              min={0}
              max={dur || 100}
              defaultValue={Math.min(liveMs, dur)}
              disabled={!hostCanControl}
              style={{
                ["--track" as any]: `linear-gradient(to right, #fff ${seeking && seekPreview != null ? Math.min(100, (seekPreview / dur) * 100) : progress}%, #4d4d4d ${seeking && seekPreview != null ? Math.min(100, (seekPreview / dur) * 100) : progress}%)`,
                ["--thumb" as any]: "#fff",
              } as React.CSSProperties}
              onPointerDown={() => {
                if (hostCanControl) setSeeking(true);
              }}
              onChange={(e) => {
                if (!hostCanControl) return;
                setSeekPreview(Number(e.target.value));
              }}
              onPointerUp={() => {
                if (!hostCanControl) return;
                const ms = seekPreview ?? liveMs;
                commitSeek(ms);
                setSeekPreview(null);
                setSeeking(false);
              }}
              onPointerCancel={() => {
                setSeekPreview(null);
                setSeeking(false);
              }}
              aria-label="Seek"
            />
{audioError && <div className="text-[10px] text-red-400 text-center">{audioError}</div>}
              {!audioError && playIntent && readyState >= 2 && !actuallyPlaying && (
                <button
                  className="text-[10px] text-brand underline text-center"
                  onClick={() => audioRef?.play().catch(() => {})}
                >
                  {inJam ? "Tap to sync audio" : "Tap to enable audio"}
                </button>
              )}
          </div>

          {/* Right: queue + volume */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 w-1/5 sm:w-[30%] lg:w-[28%] shrink-0">
            <div ref={queueWrapRef} className="relative">
              <button
                className="btn-icon !p-2 text-ink-secondary hover:text-white"
                aria-label="Now playing view"
                aria-expanded={queueOpen}
                onClick={() => setQueueOpen((o) => !o)}
              >
                <QueueIcon className="text-base" />
              </button>
              {queueOpen && (
                <div className="absolute right-0 bottom-10 w-72 sm:w-80 max-h-96 overflow-y-auto bg-spotify-surface rounded-lg shadow-2xl p-2 ring-1 ring-white/10">
                  <div className="px-2 py-1 text-xs uppercase tracking-wider text-ink-secondary font-semibold">
                    {inJam ? "Jam queue" : "Playing next"}
                  </div>
                  <ol className="space-y-1 text-sm">
                    {(inJam ? (room?.queue ?? []) : personalQueue).map((t, i) => {
                      const isCurrent = inJam
                        ? t.id === room?.currentTrackId
                        : i === personalIdx;
                      return (
                        <li
                          key={`${t.id}-${i}`}
                          className={`flex items-center gap-2 rounded px-2 py-1 ${
                            isCurrent ? "bg-white/5" : ""
                          }`}
                        >
                          <img src={t.thumbnail} alt="" className="w-9 h-9 rounded object-cover" />
                          <div className="min-w-0 flex-1">
                            <div
                              className={`min-w-0 truncate text-sm ${isCurrent ? "text-brand" : ""}`}
                              title={t.title}
                            >
                              {t.title}
                            </div>
                            <div
                              className="min-w-0 truncate text-[10px] text-ink-secondary"
                              title={t.artist}
                            >
                              {t.artist}
                            </div>
                          </div>
                          {isCurrent && <span className="text-brand text-xs">▶</span>}
                          {!inJam && (
                            <button
                              className="text-ink-secondary hover:text-white text-xs"
                              onClick={() => personalRemove(i)}
                              title="Remove"
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {!inJam && personalQueue.length > 0 && (
                    <button
                      className="mt-2 w-full text-xs text-ink-secondary hover:text-white py-1"
                      onClick={() => personalClear()}
                    >
                      Clear queue
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              className="hidden sm:inline-flex btn-icon !p-2"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MuteIcon className="text-base" /> : <VolumeIcon className="text-base" />}
            </button>
            <input
              type="range"
              className="hidden sm:inline-block spotify w-24"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : vol}
              onChange={(e) => setVol(Number(e.target.value))}
              style={{
                ["--track" as any]: `linear-gradient(to right, #fff ${(muted ? 0 : vol) * 100}%, #4d4d4d ${(muted ? 0 : vol) * 100}%)`,
              } as React.CSSProperties}
              aria-label="Volume"
            />
          </div>
        </>
      ) : (
        <div className="text-ink-secondary text-xs sm:text-sm">Pick a song to start playing.</div>
      )}
    </footer>
  );
}