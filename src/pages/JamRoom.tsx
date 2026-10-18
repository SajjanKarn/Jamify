import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJamStore } from "../lib/store";
import { PlayIcon, PauseIcon, SkipNextIcon, HeartIcon, SearchIcon, LogoutIcon, CrownIcon } from "../components/icons";

export default function JamRoom() {
  const params = useParams<{ roomId: string }>();
  const nav = useNavigate();
  const room = useJamStore((s) => s.room);
  const hostDisconnected = useJamStore((s) => s.hostDisconnected);
  const myRole = useJamStore((s) => s.myRole);
  const myId = useJamStore((s) => s.myId);
  const myName = useJamStore((s) => s.myName);
  const bindAudio = useJamStore((s) => s.bindAudio);
  const audioRef = useJamStore((s) => s.audioRef);
  const leaveRoom = useJamStore((s) => s.leaveRoom);
  const joinRoom = useJamStore((s) => s.joinRoom);
  const play = useJamStore((s) => s.play);
  const pause = useJamStore((s) => s.pause);
  const next = useJamStore((s) => s.next);
  const seek = useJamStore((s) => s.seek);
  const addToQueue = useJamStore((s) => s.addToQueue);
  const jumpToTrack = useJamStore((s) => s.jumpToTrack);
  const moveInQueue = useJamStore((s) => s.moveInQueue);
  const removeFromQueue = useJamStore((s) => s.removeFromQueue);
  const renameMe = useJamStore((s) => s.renameMe);

  // Auto-join: if the user opens /jam/:roomId directly and isn't in that
  // room yet, join using whatever name we have stored.
  const [joinError, setJoinError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const id = params.roomId?.toUpperCase();
    if (!id) return;
    if (room && room.id === id) return;
    let cancelled = false;
    (async () => {
      try {
        await joinRoom(id, myName || "Guest");
      } catch (e: any) {
        if (!cancelled) setJoinError(e?.message ?? "Could not join");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.roomId, room, myName, joinRoom]);

  const [q, setQ] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  // The JamRoom timestamp everyone agrees on. We keep two: local audio
  // time (the host's actual player clock, slightly more accurate) and
  // room.positionMs (the server-anchored clock visible to everyone).
  const [localAudioMs, setLocalAudioMs] = React.useState(0);
  const [audioDuration, setAudioDuration] = React.useState(0);
  // Smooth interpolation of room.positionMs between server updates.
  const [livePosMs, setLivePosMs] = React.useState(0);
  const lastServerTsRef = React.useRef<number>(Date.now());

  // Each time the server emits a new room snapshot, reset the extrapolation
  // baseline. Anything between snapshots is local-clock extrapolation.
  React.useEffect(() => {
    if (!room) return;
    lastServerTsRef.current = Date.now();
    setLivePosMs(room.positionMs);
  }, [room?.positionMs, room?.isPlaying]);
  const [copied, setCopied] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");
  const [editingName, setEditingName] = React.useState(false);
  const [confirmingLeave, setConfirmingLeave] = React.useState(false);
  // While the host is dragging the seeker, suppress live updates and
  // commit the seek only on release. Prevents audio stutter from
  // continuous re-buffering.
  const [seeking, setSeeking] = React.useState(false);
  const [seekPreview, setSeekPreview] = React.useState<number | null>(null);
  const commitSeek = (ms: number) => {
    if (audioRef) audioRef.currentTime = ms / 1000;
    seek(ms);
  };

  // Pollers — must run unconditionally for stable hook order.
  React.useEffect(() => {
    const id = setInterval(() => {
      if (audioRef) {
        setLocalAudioMs(audioRef.currentTime * 1000);
        setAudioDuration((audioRef.duration || 0) * 1000);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Re-tick room.positionMs every 250ms so the seek bar moves smoothly
  // even though the server only emits room_state on state changes.
  React.useEffect(() => {
    if (!room) return;
    const id = setInterval(() => {
      const elapsed = room.isPlaying ? Date.now() - lastServerTsRef.current : 0;
      setLivePosMs(room.positionMs + elapsed);
    }, 250);
    return () => clearInterval(id);
  }, [room]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for browsers without clipboard API.
      const ta = document.createElement("textarea");
      ta.value = window.location.href;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  // Pre-join name picker: if no saved name, ask before joining.
  if (!room && joinError) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-400 mb-2">{joinError}</p>
        <button className="btn-pill-white px-5 h-10 text-sm" onClick={() => nav("/jam")}>
          Try again
        </button>
      </div>
    );
  }

  if (!room && !myName) {
    return (
      <div className="pt-6 max-w-md">
        <h2 className="text-3xl font-bold mb-2">Joining {params.roomId}</h2>
        <p className="text-ink-secondary mb-4">What's your name?</p>
        <input
          className="w-full bg-spotify-surface border-b border-white/20 focus:border-white outline-none py-2 text-xl font-bold"
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="e.g. Avery"
        />
        <div className="mt-4 flex gap-2">
          <button
            className="btn-pill-white px-6 h-10 text-sm"
            disabled={!nameDraft.trim()}
            onClick={async () => {
              const id = params.roomId?.toUpperCase();
              if (!id) return;
              try {
                await joinRoom(id, nameDraft.trim());
              } catch (e: any) {
                setJoinError(e?.message ?? "Could not join");
              }
            }}
          >
            Join
          </button>
          <button className="btn-pill bg-white/10 text-white px-6 h-10 text-sm" onClick={() => nav("/jam")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-2 h-2 rounded-full bg-brand animate-pulse" />
        <p className="mt-4 text-ink-secondary">Joining room {params.roomId}…</p>
      </div>
    );
  }

  const currentTrack = room.queue.find((t) => t.id === room.currentTrackId) ?? null;
  const upcoming = room.queue.filter((t) => t.id !== room.currentTrackId);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data.tracks ?? []);
  }

  const dur = audioDuration || (currentTrack?.durationSec ?? 0) * 1000;
  const progress = dur > 0 ? Math.min(100, (livePosMs / dur) * 100) : 0;

  return (
    <div className="pt-2">
      {/* Big mobile-friendly audio gate. Mobile browsers block
          autoplay after the original click-handler window expires (~1s);
          after a page refresh or re-join the audio element is paused and
          no longer has the gesture. Show a prominent CTA so the user can
          start playback with a single tap. */}
      {room.isPlaying && (
        <button
          onClick={() => audioRef?.play().catch(() => {})}
          className="md:hidden mb-4 w-full bg-brand text-black rounded-xl px-4 py-3 font-bold flex items-center gap-3 active:scale-95 transition shadow-lg"
        >
          <PlayIcon className="text-xl shrink-0" />
          <span className="flex-1 text-left">Tap to hear the music</span>
        </button>
      )}

      {/* Share row — stacks on mobile so the long room code doesn't
          crowd the buttons out of view. */}
      <div className="bg-spotify-surface rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-baseline gap-3 min-w-0 sm:flex-1">
          <div className="text-xs uppercase font-bold text-ink-secondary tracking-wider shrink-0">
            Code
          </div>
          <div
            className="text-xl sm:text-2xl font-bold tracking-[0.2em] truncate"
            title={room.id}
          >
            {room.id}
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 shrink-0">
          <button
            className="btn-pill bg-white text-black px-4 h-9 text-sm flex-1 sm:flex-initial"
            onClick={copyLink}
          >
            {copied ? "Link copied ✓" : "Copy invite link"}
          </button>
          <button
            className="btn-icon text-ink-secondary hover:text-white text-sm gap-1.5 shrink-0"
            onClick={() => setConfirmingLeave(true)}
            aria-label="Leave jam"
          >
            <LogoutIcon className="text-base" /> Leave
          </button>
        </div>
      </div>

      {confirmingLeave && (
        <LeaveConfirmDialog
          roomId={room.id}
          onCancel={() => setConfirmingLeave(false)}
          onConfirm={() => {
            setConfirmingLeave(false);
            leaveRoom();
          }}
        />
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
        {/* Left: now playing + search */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-gradient-to-b from-spotify-surface-2 to-spotify-surface rounded-lg p-4 sm:p-6">
            {currentTrack ? (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                <img
                  src={currentTrack.thumbnail}
                  alt=""
                  className="w-32 h-32 sm:w-36 sm:h-36 lg:w-44 lg:h-44 rounded shadow-xl object-cover shrink-0 mx-auto sm:mx-0"
                />
                <div className="min-w-0 flex-1 max-w-md sm:max-w-lg flex flex-col justify-center sm:justify-end gap-1.5">
                  <div className="text-[10px] sm:text-xs uppercase font-bold text-ink-secondary tracking-wider">
                    Now playing
                  </div>
                  <div
                    className="min-w-0 w-full text-lg sm:text-xl lg:text-2xl font-bold truncate"
                    title={currentTrack.title}
                  >
                    {currentTrack.title}
                  </div>
                  <div
                    className="min-w-0 w-full text-ink-secondary text-xs sm:text-sm lg:text-base truncate"
                    title={currentTrack.artist}
                  >
                    {currentTrack.artist}
                  </div>

                  {/* Seek — visible to everyone, host can drag, participants see live */}
                  <div className="mt-2 sm:mt-3">
                    <input
                      type="range"
                      className="spotify w-full"
                      min={0}
                      max={dur}
                      value={Math.min(seekPreview ?? livePosMs, dur)}
                      disabled={myRole !== "host"}
                      style={{
                        ["--track" as any]: `linear-gradient(to right, #fff ${seeking && seekPreview != null ? Math.min(100, (seekPreview / dur) * 100) : progress}%, #4d4d4d ${seeking && seekPreview != null ? Math.min(100, (seekPreview / dur) * 100) : progress}%)`,
                      } as React.CSSProperties}
                      onPointerDown={() => {
                        if (myRole === "host") setSeeking(true);
                      }}
                      onChange={(e) => {
                        if (myRole !== "host") return;
                        setSeekPreview(Number(e.target.value));
                      }}
                      onPointerUp={() => {
                        if (myRole !== "host") return;
                        const ms = seekPreview ?? livePosMs;
                        commitSeek(ms);
                        setSeekPreview(null);
                        setSeeking(false);
                      }}
                      onPointerCancel={() => {
                        setSeekPreview(null);
                        setSeeking(false);
                      }}
                      onKeyDown={(e) => {
                        if (myRole !== "host") return;
                        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                          // Keyboard seek — commit immediately, no
                          // debounce needed.
                          const ms = livePosMs + (e.key === "ArrowLeft" ? -5000 : 5000);
                          commitSeek(Math.max(0, Math.min(dur, ms)));
                        }
                      }}
                    />
                    <div className="flex justify-between text-xs text-ink-secondary mt-1 tabular-nums">
                      <span>{fmt(seekPreview ?? livePosMs)}</span>
                      <span>{fmt(dur)}</span>
                    </div>
                    {myRole !== "host" && (
                      <p className="text-[11px] text-ink-secondary mt-1">Following the host's playback</p>
                    )}
                  </div>

                  {myRole === "host" ? (
                    <div className="mt-4 flex items-center gap-4">
                      <button
                        className="btn-circle-lg !w-12 !h-12"
                        onClick={() => (room.isPlaying ? pause() : play())}
                        aria-label={room.isPlaying ? "Pause" : "Play"}
                      >
                        {room.isPlaying ? <PauseIcon className="text-xl" /> : <PlayIcon className="text-xl ml-0.5" />}
                      </button>
                      <button
                        className="btn-circle-md !w-10 !h-10"
                        onClick={() => next()}
                        aria-label="Next"
                      >
                        <SkipNextIcon className="text-lg" />
                      </button>
                      <button className="btn-icon !p-2 text-ink-secondary hover:text-brand ml-2" aria-label="Save">
                        <HeartIcon className="text-base" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-1">
                      <p className="text-sm text-ink-secondary">
                        Only the host can control playback.
                      </p>
                      {hostDisconnected && (
                        <p className="text-xs flex items-center gap-2 text-ink-secondary">
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          Host disconnected — playback continuing. They'll reconnect automatically.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-ink-secondary text-center py-12">
                Queue is empty. Add a track below to start the jam.
              </p>
            )}
          </div>

          {/* Add to queue */}
          <div className="bg-spotify-surface rounded-lg p-4 sm:p-6 overflow-hidden min-w-0">
            <h3 className="text-xl font-bold mb-4">Add to queue</h3>
            <form onSubmit={onSearch} className="search-pill mb-4 min-w-0">
              <SearchIcon className="text-ink-secondary text-base shrink-0" />
              <input
                placeholder="Search YouTube..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="min-w-0"
              />
            </form>
            <div className="space-y-1 max-h-80 overflow-y-auto overflow-x-hidden min-w-0 w-full">
              {searchResults.map((t) => (
                <article
                  key={t.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-spotify-surface-2 group min-w-0 w-full"
                >
                  <img src={t.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0 truncate text-sm" title={t.title}>{t.title}</div>
                    <div className="min-w-0 truncate text-xs text-ink-secondary" title={t.artist}>{t.artist}</div>
                  </div>
                  <button
                    className="btn-circle-sm !w-8 !h-8 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => addToQueue(t).catch((e) => alert(e.message))}
                    aria-label="Add"
                  >
                    +
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* Right: members + queue */}
        <div className="space-y-4">
          <div className="bg-spotify-surface rounded-lg p-5">
            <h3 className="text-xs uppercase font-bold text-ink-secondary tracking-wider mb-3">
              People ({room.members.length})
            </h3>
            <ul className="space-y-2">
              {room.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      m.role === "host" ? "bg-brand text-black" : "bg-spotify-surface-2 text-white"
                    }`}
                  >
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                  {m.id === myId && editingName ? (
                    <input
                      autoFocus
                      className="flex-1 min-w-0 bg-transparent border-b border-brand outline-none text-sm"
                      defaultValue={myName}
                      maxLength={32}
                      onBlur={(e) => {
                        setEditingName(false);
                        const v = e.target.value.trim();
                        if (v && v !== myName) renameMe(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                  ) : (
                    <button
                      className={`min-w-0 truncate flex-1 text-left text-sm ${m.id === myId ? "hover:underline cursor-pointer" : ""}`}
                      onClick={() => {
                        if (m.id === myId) setEditingName(true);
                      }}
                      title={m.id === myId ? "Click to rename" : undefined}
                    >
                      {m.name}
                    </button>
                  )}
                  {m.role === "host" && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand text-black text-[10px] font-bold uppercase tracking-wider shrink-0"
                      title="Host — drives playback"
                    >
                      <CrownIcon className="text-[10px]" />
                      Host
                    </span>
                  )}
                  {m.id === myId && !editingName && (
                    <button
                      className="btn-icon !p-1 text-ink-secondary hover:text-white shrink-0"
                      onClick={() => setEditingName(true)}
                      aria-label="Rename"
                      title="Rename"
                    >
                      ✎
                    </button>
                  )}
                  {m.id === myId && <span className="text-[10px] text-ink-secondary shrink-0">you</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-spotify-surface rounded-lg p-5">
            <h3 className="text-xs uppercase font-bold text-ink-secondary tracking-wider mb-3">
              Queue
            </h3>
<ol className="space-y-1">
              {room.queue.map((t, i) => {
                const isCurrent = t.id === currentTrack?.id;
                const isHostControl = !isCurrent && myRole === "host";
                return (
                  <li
                    key={`${t.id}-${i}`}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded min-w-0 hover:bg-white/5 ${
                      isCurrent ? "bg-white/5" : ""
                    }`}
                  >
                    <img src={t.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-sm ${isCurrent ? "text-brand" : ""}`}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                      <div
                        className="truncate text-xs text-ink-secondary"
                        title={t.artist}
                      >
                        {t.artist}
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-brand text-xs shrink-0">▶</span>
                    ) : isHostControl ? (
                      <>
                        <button
                          className="opacity-0 group-hover:opacity-100 btn-icon !p-1 text-ink-secondary hover:text-white shrink-0 disabled:opacity-20 disabled:cursor-not-allowed"
                          onClick={() => moveInQueue(t.id, "up")}
                          disabled={i <= 1}
                          aria-label={`Move ${t.title} up in queue`}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          className="opacity-0 group-hover:opacity-100 btn-circle-md !w-8 !h-8 shrink-0"
                          onClick={() => jumpToTrack(t.id)}
                          aria-label={`Play ${t.title} next`}
                          title="Play this track next"
                        >
                          <PlayIcon className="text-sm" />
                        </button>
                        <button
                          className="opacity-0 group-hover:opacity-100 btn-icon !p-1 text-ink-secondary hover:text-white shrink-0"
                          onClick={() => removeFromQueue(t.id).catch((e) => alert(e.message))}
                          aria-label={`Remove ${t.title} from queue`}
                          title="Remove from queue"
                        >
                          ✕
                        </button>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(ms: number) {
  if (!ms || !isFinite(ms)) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function LeaveConfirmDialog({
  roomId,
  onCancel,
  onConfirm,
}: {
  roomId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Close on Escape.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-dialog-title"
    >
      <div
        className="bg-spotify-surface rounded-xl p-6 w-full max-w-sm shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-dialog-title" className="text-xl font-bold mb-2">
          Leave this jam?
        </h2>
        <p className="text-ink-secondary text-sm mb-6">
          You'll be removed from room <span className="font-mono text-white">{roomId}</span>. The host keeps control — you can rejoin anytime with the code.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="btn-pill bg-white/10 text-white px-5 h-10 text-sm"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            className="btn-pill bg-white text-black px-5 h-10 text-sm font-bold"
            onClick={onConfirm}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}