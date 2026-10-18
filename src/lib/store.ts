import { create } from "zustand";
import type { RoomSnapshot, Track } from "./types";
import { getSocket } from "./socket";

interface JamState {
  // ---- Identity / room -----------------------------------------------
  myId: string | null;
  myName: string;
  myRole: "host" | "participant" | null;
  room: RoomSnapshot | null;
  hostDisconnected: boolean;
  hostReconnectGraceMs: number | null;

  // Shared audio element (whichever page is mounted owns it).
  audioRef: HTMLAudioElement | null;
  bindAudio: (el: HTMLAudioElement) => void;
  // Wall-clock timestamp of the last server room_state snapshot —
  // used to extrapolate room.positionMs for drift correction without
  // jerking the audio backward whenever a non-playback event (e.g.
  // add_to_queue) re-broadcasts the snapshot.
  lastSyncAt: number | null;
  // Last isPlaying we acted on, so add_to_queue/host_seek/rename don't
  // re-fire play()/pause() on every room_state tick.
  _lastSyncedRoomIsPlaying: boolean | null;

  // ---- Shared audio URL cache -----------------------------------------
  audioUrl: string | null;
  audioUrlExpiresAt: number | null;
  audioUrlTrackId: string | null;

  // ---- Personal playback (when not in a room) ------------------------
  personalQueue: Track[];
  personalIdx: number; // index of the currently-playing track, -1 = none
  personalPlaying: boolean;
  personalPositionMs: number;
  // When the user clicks Play, we may be inside an async fetch for the
  // audio URL. Browser autoplay policy needs the play() call to happen
  // synchronously inside a user-gesture handler (or very shortly after).
  // The audio element's `canplay` event fires from the network/audio
  // stack and is *not* inside the user-gesture window. So we set this
  // flag whenever the user requested playback and let MiniPlayer re-arm
  // audioRef.play() on the next user gesture (e.g. another ▶ click).
  playIntent: boolean;
  personalAdd: (track: Track, playNow?: boolean) => void;
  personalPlay: () => void;
  personalPause: () => void;
  personalNext: () => void;
  personalPrev: () => void;
  personalSeek: (positionMs: number) => void;
  personalRemove: (idx: number) => void;
  personalClear: () => void;
  acknowledgePlayIntent: () => void;

  // ---- Search --------------------------------------------------------
  searchResults: Track[];
  setSearchResults: (tracks: Track[]) => void;
  search: (q: string) => Promise<void>;

  // ---- Jam lifecycle -------------------------------------------------
  createRoom: (name: string) => Promise<void>;
  joinRoom: (roomId: string, name: string) => Promise<void>;
  renameMe: (name: string) => Promise<void>;
  leaveRoom: () => void;

  // ---- Jam queue + host controls --------------------------------------
  addToQueue: (track: Track) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  jumpToTrack: (trackId: string) => Promise<void>;
  moveInQueue: (trackId: string, direction: "up" | "down") => Promise<void>;
  removeFromQueue: (trackId: string) => Promise<void>;

  // Internal: drive audio element to authoritative state.
  _syncAudio: (room: RoomSnapshot) => Promise<void>;
  _syncPersonal: () => Promise<void>;
}

async function resolveAudioUrl(videoId: string): Promise<{ url: string; expiresAt: number }> {
  const res = await fetch(`/api/stream/${videoId}`);
  if (!res.ok) throw new Error("stream fetch failed");
  const data = await res.json();
  return { url: data.audioUrl, expiresAt: data.expiresAt };
}

export const useJamStore = create<JamState>((set, get) => {
  const socket = getSocket();

  socket.on("room_state", (room: RoomSnapshot) => {
    set({ room, lastSyncAt: Date.now() });
    // Clear the host-disconnected banner if the host slot is filled —
    // either by ourselves (we just reclaimed) or by someone else.
    if (room.hostId) set({ hostDisconnected: false, hostReconnectGraceMs: null });
    get()._syncAudio(room);
  });

  socket.on("host_disconnected", ({ graceMs }: { graceMs: number }) => {
    // Mark the room as having a temporarily-vacant host. Playback keeps
    // going — participants hear uninterrupted music.
    set({ hostDisconnected: true, hostReconnectGraceMs: graceMs });
  });

  socket.on("room_closed", ({ reason }: { reason: string }) => {
    set({
      room: null,
      audioUrl: null,
      audioUrlExpiresAt: null,
      audioUrlTrackId: null,
      personalQueue: [],
      personalIdx: -1,
      personalPlaying: false,
      personalPositionMs: 0,
      playIntent: false,
      hostDisconnected: false,
      hostReconnectGraceMs: null,
    });
    alert(`Jam closed: ${reason}`);
  });

  return {
    myId: null,
    myName: localStorage.getItem("jamify:name") ?? "",
    myRole: null,
    room: null,

    audioRef: null,
    audioUrl: null,
    audioUrlExpiresAt: null,
    audioUrlTrackId: null,
    lastSyncAt: null,
    _lastSyncedRoomIsPlaying: null,

    personalQueue: [],
    personalIdx: -1,
    personalPlaying: false,
    personalPositionMs: 0,
    playIntent: false,
    hostDisconnected: false,
    hostReconnectGraceMs: null,

    searchResults: [],

    bindAudio: (el) => set({ audioRef: el }),

    // ------------------------------------------------------------------
    // Personal playback
    // ------------------------------------------------------------------
    personalAdd(track, playNow) {
      const q = [...get().personalQueue, track];
      if (playNow || get().personalIdx === -1) {
        const { audioRef } = get();
        set({
          personalQueue: q,
          personalIdx: q.length - 1,
          personalPlaying: true,
          personalPositionMs: 0,
          playIntent: true,
        });
        // Call play() synchronously from the click handler so Chrome
        // sees the user-activation gesture even if src isn't set yet.
        if (audioRef) audioRef.play().catch(() => {});
      } else {
        set({ personalQueue: q });
      }
      get()._syncPersonal();
    },

    personalPlay() {
      // Called from the user-gesture context (▶ Play button). Call
      // audioRef.play() synchronously here too so the browser sees the
      // gesture, even if the audio src hasn't been resolved yet.
      const { audioRef } = get();
      set({ personalPlaying: true, playIntent: true });
      if (audioRef) audioRef.play().catch(() => {});
      get()._syncPersonal();
    },
    personalPause() {
      const { audioRef } = get();
      set({ personalPlaying: false, playIntent: false });
      if (audioRef) audioRef.pause();
      get()._syncPersonal();
    },
    personalNext() {
      const { personalQueue, personalIdx } = get();
      if (personalIdx < 0) return;
      const nextIdx = personalIdx + 1;
      if (nextIdx >= personalQueue.length) {
        set({ personalPlaying: false, personalPositionMs: 0, playIntent: false });
        get()._syncPersonal();
        return;
      }
      set({ personalIdx: nextIdx, personalPositionMs: 0, personalPlaying: true, playIntent: true });
      const { audioRef } = get();
      if (audioRef) audioRef.play().catch(() => {});
      get()._syncPersonal();
    },
    personalPrev() {
      const { personalIdx } = get();
      if (personalIdx <= 0) return;
      set({ personalIdx: personalIdx - 1, personalPositionMs: 0, personalPlaying: true, playIntent: true });
      const { audioRef } = get();
      if (audioRef) audioRef.play().catch(() => {});
      get()._syncPersonal();
    },
    personalSeek(positionMs) {
      set({ personalPositionMs: Math.max(0, positionMs) });
      get()._syncPersonal();
    },
    personalRemove(idx) {
      const { personalQueue, personalIdx } = get();
      const q = personalQueue.filter((_, i) => i !== idx);
      let nextIdx = personalIdx;
      if (idx < personalIdx) nextIdx = personalIdx - 1;
      else if (idx === personalIdx) nextIdx = -1;
      set({ personalQueue: q, personalIdx: nextIdx });
      get()._syncPersonal();
    },
    personalClear() {
      const { audioRef } = get();
      set({ personalQueue: [], personalIdx: -1, personalPlaying: false, personalPositionMs: 0, playIntent: false });
      if (audioRef) {
        audioRef.pause();
        audioRef.removeAttribute("src");
        audioRef.load();
      }
    },

    acknowledgePlayIntent: () => set({ playIntent: false }),

    // ------------------------------------------------------------------
    // Jam lifecycle
    // ------------------------------------------------------------------
    async createRoom(name) {
      localStorage.setItem("jamify:name", name);
      const sock = getSocket();
      await new Promise<void>((resolve, reject) => {
        sock.emit("create_room", { name }, (resp: any) => {
          if (!resp.ok) return reject(new Error(resp.error));
          if (resp.hostSecret) {
            try {
              localStorage.setItem(`jamify:host-secret:${resp.room.id}`, resp.hostSecret);
            } catch {
              /* ignore quota errors */
            }
          }
          set({ myId: resp.you.id, myName: name, myRole: "host", room: resp.room });
          resolve();
        });
      });
    },

    async joinRoom(roomId, name) {
      localStorage.setItem("jamify:name", name);
      let hostSecret: string | undefined;
      try {
        hostSecret = localStorage.getItem(`jamify:host-secret:${roomId.toUpperCase()}`) ?? undefined;
      } catch {
        /* ignore */
      }
      const sock = getSocket();
      // A re-join means a fresh connection; the previous-sync bookkeeping
      // (especially `_lastSyncedRoomIsPlaying`) is stale. If the room is
      // still playing when we get back in, the play()/pause() branch in
      // _syncAudio would short-circuit and audio would never restart.
      set({ _lastSyncedRoomIsPlaying: null });
      await new Promise<void>((resolve, reject) => {
        sock.emit(
          "join_room",
          { roomId: roomId.toUpperCase(), name, hostSecret },
          (resp: any) => {
            if (!resp.ok) return reject(new Error(resp.error));
            // If we were a previous host reclaiming, store the secret
            // back (it matches) and adopt host role; otherwise clear it
            // so we don't accidentally try to claim again later.
            if (resp.reclaimed) {
              try {
                localStorage.setItem(
                  `jamify:host-secret:${resp.room.id}`,
                  hostSecret ?? "",
                );
              } catch {
                /* ignore */
              }
              set({ myId: resp.you.id, myName: name, myRole: "host", room: resp.room });
            } else {
              try {
                localStorage.removeItem(`jamify:host-secret:${resp.room.id}`);
              } catch {
                /* ignore */
              }
              set({
                myId: resp.you.id,
                myName: name,
                myRole: "participant",
                room: resp.room,
              });
            }
            resolve();
          },
        );
      });
    },

    async renameMe(name) {
      const trimmed = String(name ?? "").trim().slice(0, 32);
      if (!trimmed) return;
      localStorage.setItem("jamify:name", trimmed);
      set({ myName: trimmed });
      // If in a room, tell the server so other participants see the new name.
      if (get().room) {
        const sock = getSocket();
        await new Promise<void>((resolve) => {
          sock.emit("rename", { name: trimmed }, (resp: any) => {
            resolve();
          });
        });
      }
    },

    leaveRoom() {
      // Forget any stored host secret so it doesn't follow the user.
      try {
        if (typeof window !== "undefined") {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("jamify:host-secret:")) localStorage.removeItem(key);
          }
        }
      } catch {
        /* ignore */
      }
      window.location.href = "/";
    },

    // ------------------------------------------------------------------
    // Search + jam queue + host controls
    // ------------------------------------------------------------------
    setSearchResults: (tracks) => set({ searchResults: tracks }),
    async search(q) {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      set({ searchResults: data.tracks ?? [] });
    },

    async addToQueue(track) {
      const sock = getSocket();
      await new Promise<void>((resolve, reject) => {
        sock.emit("add_to_queue", { track }, (resp: any) => {
          if (!resp?.ok) return reject(new Error(resp?.error));
          resolve();
        });
      });
    },

    async play() {
      getSocket().emit("host_play", {});
    },
    async pause() {
      getSocket().emit("host_pause", {});
    },
    async next() {
      getSocket().emit("host_next", {});
    },
    async seek(positionMs) {
      getSocket().emit("host_seek", { positionMs });
    },
    async jumpToTrack(trackId) {
      getSocket().emit("host_jump", { trackId });
    },
    async moveInQueue(trackId, direction) {
      getSocket().emit("host_queue_move", { trackId, direction });
    },
    async removeFromQueue(trackId) {
      getSocket().emit("host_queue_remove", { trackId });
    },

    // ------------------------------------------------------------------
    // Audio sync helpers
    // ------------------------------------------------------------------
async _syncAudio(room) {
      const { audioRef, audioUrl, audioUrlExpiresAt, audioUrlTrackId, lastSyncAt } = get();
      const wantTrackId = room.currentTrackId;
      if (!wantTrackId) {
        audioRef?.pause();
        if (audioRef) {
          audioRef.removeAttribute("src");
          audioRef.load();
        }
        set({ audioUrl: null, audioUrlExpiresAt: null, audioUrlTrackId: null });
        return;
      }

      let url = audioUrl;
      let expiresAt = audioUrlExpiresAt;
      let needSrcUpdate = false;
      if (audioUrlTrackId !== wantTrackId || !audioUrl || (expiresAt ?? 0) < Date.now() + 30_000) {
        try {
          const r = await resolveAudioUrl(wantTrackId);
          url = r.url;
          expiresAt = r.expiresAt;
          set({ audioUrl: url, audioUrlExpiresAt: expiresAt, audioUrlTrackId: wantTrackId });
          needSrcUpdate = true;
        } catch (err) {
          console.error("stream resolve failed", err);
          return;
        }
      }

      if (!audioRef || !url) return;
      // Only reset src when we just fetched — never on trackId equality,
      // otherwise the reload kills in-progress playback.
      if (needSrcUpdate) {
        // After a page refresh the user-gesture window is gone; the
        // browser would reject any unmuteable play(). Mute the audio
        // element first — muted playback is allowed to autoplay — then
        // unmute on canplay so the user hears full-volume audio without
        // a manual click. The personal-mode block does the same.
        const wasMuted = audioRef.muted;
        if (!wasMuted) audioRef.muted = true;
        audioRef.src = url;
        audioRef.load();
        // currentTime set before metadata loads is silently ignored by
        // most browsers. Re-apply once loadedmetadata fires, and try
        // play() if the room is currently playing so late-joiners
        // actually hear audio without waiting for a host action.
        const onLoaded = () => {
          const drift = Math.abs(audioRef.currentTime * 1000 - extrapolatedMs);
          if (drift > 1500) audioRef.currentTime = extrapolatedMs / 1000;
          audioRef.removeEventListener("loadedmetadata", onLoaded);
        };
        const onCanPlay = () => {
          // Try play() here — audio has enough data to start now, and
          // because we muted before load() this usually bypasses the
          // browser's autoplay gate (Chrome/Safari/Firefox all allow
          // muted playback without a gesture).
          if (room.isPlaying && audioRef.paused) {
            audioRef.play().catch(() => {});
          }
          if (!wasMuted && audioRef.muted) audioRef.muted = false;
          audioRef.removeEventListener("canplay", onCanPlay);
        };
        audioRef.addEventListener("loadedmetadata", onLoaded);
        audioRef.addEventListener("canplay", onCanPlay);
      }

      // Extrapolate the server's room.positionMs to "now" using the
      // lastSyncAt timestamp. Without this, drift against an audio that's
      // been playing for N seconds would be ~N * 1000 — and any unrelated
      // room_state broadcast (e.g. add_to_queue) would jerk the audio
      // back to the snapshot's stale position.
      const extrapolatedMs =
        room.isPlaying && lastSyncAt
          ? room.positionMs + Math.max(0, Date.now() - lastSyncAt)
          : room.positionMs;

      const driftMs = Math.abs(audioRef.currentTime * 1000 - extrapolatedMs);
      const target = extrapolatedMs / 1000;

      // Only call play()/pause() when isPlaying actually changed
      // compared to what we last synced — otherwise we keep restarting
      // playback on every room_state tick (e.g. add_to_queue, rename).
      const prevIsPlaying = get()._lastSyncedRoomIsPlaying;
      if (room.isPlaying !== prevIsPlaying) {
        if (room.isPlaying) {
          if (audioRef.paused) await audioRef.play().catch(() => {});
        } else {
          if (!audioRef.paused) audioRef.pause();
        }
        set({ _lastSyncedRoomIsPlaying: room.isPlaying });
      }

      if (driftMs > 1500) {
        audioRef.currentTime = target;
      }
    },

    async _syncPersonal() {
      const { audioRef, personalQueue, personalIdx, personalPlaying, personalPositionMs } = get();
      const track = personalIdx >= 0 ? personalQueue[personalIdx] : null;
      if (!track) {
        audioRef?.pause();
        if (audioRef) {
          audioRef.removeAttribute("src");
          audioRef.load();
        }
        set({ audioUrl: null, audioUrlExpiresAt: null, audioUrlTrackId: null });
        return;
      }

      let { audioUrl, audioUrlExpiresAt, audioUrlTrackId } = get();
      let needSrcUpdate = false;
      if (audioUrlTrackId !== track.id || !audioUrl || (audioUrlExpiresAt ?? 0) < Date.now() + 30_000) {
        try {
          const r = await resolveAudioUrl(track.id);
          audioUrl = r.url;
          audioUrlExpiresAt = r.expiresAt;
          audioUrlTrackId = track.id;
          set({ audioUrl, audioUrlExpiresAt, audioUrlTrackId });
          needSrcUpdate = true;
        } catch (err) {
          console.error("personal stream resolve failed", err);
          return;
        }
      }

      if (!audioRef || !audioUrl) return;
      if (needSrcUpdate) {
        // Mute-autoplay trick: after a page refresh the user gesture is
        // gone. Mute first so the browser allows autoplay, then unmute
        // and (re)try play on canplay so the user hears full-volume audio.
        const wasMuted = audioRef.muted;
        if (!wasMuted) audioRef.muted = true;
        audioRef.src = audioUrl;
        audioRef.load();
        const onCanPlay = () => {
          if (personalPlaying && audioRef.paused) {
            audioRef.play().catch(() => {});
          }
          if (!wasMuted && audioRef.muted) audioRef.muted = false;
          audioRef.removeEventListener("canplay", onCanPlay);
        };
        audioRef.addEventListener("canplay", onCanPlay);
      }
      // In personal mode the audio element is the source of truth — no
      // drift correction. personalPositionMs is only updated by personalSeek,
      // which already sets audioRef.currentTime directly.
      if (personalPlaying) {
        if (audioRef.paused && audioRef.readyState >= 2) {
          audioRef.play().catch(() => {});
        } else if (audioRef.paused && audioRef.readyState < 2) {
          // Audio is still loading; the canplay handler will resume.
        }
      } else {
        if (!audioRef.paused) audioRef.pause();
      }
    },
  } as JamState;
});