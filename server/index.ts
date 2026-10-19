// Express + Socket.IO server. Exposes:
//   - REST: GET /api/search?q=, GET /api/stream/:id
//   - Socket.IO events for jam rooms:
//     create_room, join_room, leave_room, add_to_queue,
//     host_play, host_pause, host_seek, host_next

import express from "express";
import cors from "cors";
import http from "node:http";
import { Server, type Socket } from "socket.io";
import { searchTracks, resolveStream, YT_DLP_BIN, selfInstallPath } from "./innertube.js";
import { createRoom, getRoom, isHostRecoverable, snapshotRoom, type Room } from "./rooms.js";
import { ensureCookies, getCookiesState } from "./cookies.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST_GRACE_MS = 5 * 60 * 1000; // host can refresh and reclaim within 5 min
const app = express();
app.use(cors());
app.use(express.json());

// Load YouTube cookies from `YT_COOKIES_TXT` env var. Without this,
// yt-dlp will fail with the "do i pass cookies" anti-bot error
// on every stream from Render's datacenter IP.
{
  const state = ensureCookies();
  if (state.configured) {
    console.log(
      `[jamify] YouTube cookies: ${state.bytes} bytes at ${state.path}` +
        (state.stale ? " (stale — consider refreshing)" : ""),
    );
  } else {
    console.warn(
      `[jamify] YouTube cookies: NOT CONFIGURED. Set YT_COOKIES_TXT on Render (Netscape format) or stream requests will return 500.`,
    );
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.get("/api/cookies/status", (_req, res) => {
  const state = getCookiesState();
  res.json({
    configured: state.configured,
    bytes: state.bytes,
    path: state.path,
    stale: state.stale,
    note:
      "Set YT_COOKIES_TXT on Render to a Netscape-format cookies.txt exported from a browser logged into YouTube.",
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "");
    const tracks = await searchTracks(q);
    res.json({ tracks });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "search failed" });
  }
});

// Stream resolution is done lazily by the host's player when they
// press play. Other participants piggy-back off the host's resolved
// URL — see /api/rooms/:id/stream?trackId=... logic on the client.
app.get("/api/stream/:videoId", async (req, res) => {
  try {
    const { audioUrl, expiresAt, track } = await resolveStream(req.params.videoId);
    res.json({ audioUrl, expiresAt, track });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "resolve failed" });
  }
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true },
});

// Map socket.id -> { roomId, memberName } for reconnection/teardown.
const socketMeta = new Map<string, { roomId: string; name: string }>();

io.on("connection", (socket: Socket) => {
  // --------------------------------------------------------------------
  // create_room — host spins up a room, becomes host. Server returns
  // a hostSecret the client must persist to reclaim host on refresh.
  // --------------------------------------------------------------------
  socket.on("create_room", ({ name }: { name: string }, ack?: (resp: any) => void) => {
    const room = createRoom(socket.id, name?.trim() || "Host");
    socketMeta.set(socket.id, { roomId: room.id, name: name?.trim() || "Host" });
    socket.join(room.id);
    ack?.({
      ok: true,
      you: { id: socket.id, name: name?.trim() || "Host", role: "host" },
      room: snapshotRoom(room),
      hostSecret: room.hostSecret,
    });
  });

  // --------------------------------------------------------------------
  // join_room — joins as participant, or reclaims host with matching secret.
  // --------------------------------------------------------------------
  socket.on(
    "join_room",
    (
      {
        roomId,
        name,
        hostSecret,
      }: { roomId: string; name: string; hostSecret?: string },
      ack?: (resp: any) => void,
    ) => {
      const room = getRoom(roomId.toUpperCase());
      if (!room) return ack?.({ ok: false, error: "Room not found" });

      const trimmedName = name?.trim() || "Guest";

      // Reclaim host if the caller proves they're the original creator
      // (matching secret) and the host slot hasn't expired.
      const reclaimingHost =
        hostSecret &&
        room.hostSecret === hostSecret &&
        isHostRecoverable(room);

      if (reclaimingHost) {
        // Clear out the stale host member record if it's still in the
        // map (it would have been removed on disconnect — see below).
        if (room.hostId && room.hostId !== socket.id) {
          room.members.delete(room.hostId);
        }
        room.hostId = socket.id;
        room.hostLastSeenAt = Date.now();
        room.members.set(socket.id, {
          id: socket.id,
          name: trimmedName,
          role: "host",
          joinedAt: Date.now(),
        });
        socketMeta.set(socket.id, { roomId: room.id, name: trimmedName });
        socket.join(room.id);
        ack?.({
          ok: true,
          you: { id: socket.id, name: trimmedName, role: "host" },
          room: snapshotRoom(room),
          reclaimed: true,
        });
        io.to(room.id).emit("room_state", snapshotRoom(room));
        return;
      }

      // If host slot is taken by someone else, this user is a participant.
      // (They can't take over without the secret.)
      room.members.set(socket.id, {
        id: socket.id,
        name: trimmedName,
        role: "participant",
        joinedAt: Date.now(),
      });
      socketMeta.set(socket.id, { roomId: room.id, name: trimmedName });
      socket.join(room.id);
      ack?.({
        ok: true,
        you: { id: socket.id, name: trimmedName, role: "participant" },
        room: snapshotRoom(room),
      });
      io.to(room.id).emit("room_state", snapshotRoom(room));
    },
  );

  // --------------------------------------------------------------------
  // add_to_queue — anyone in the room can add. Host auto-approves.
  // --------------------------------------------------------------------
  socket.on(
    "add_to_queue",
    ({ track }: { track: any }, ack?: (resp: any) => void) => {
      const meta = socketMeta.get(socket.id);
      if (!meta) return ack?.({ ok: false, error: "Not in a room" });
      const room = getRoom(meta.roomId);
      if (!room) return ack?.({ ok: false, error: "Room gone" });

      // If queue is empty and nothing is playing, autoplay.
      const wasIdle = !room.currentTrackId;
      room.queue.push(track);
      if (wasIdle) {
        room.currentTrackId = track.id;
        room.playingOffsetMs = 0;
        room.playingStartedAt = Date.now();
        room.isPlaying = true;
      }
      io.to(room.id).emit("room_state", snapshotRoom(room));
      ack?.({ ok: true });
    },
  );

  // --------------------------------------------------------------------
  // host_play / host_pause / host_seek / host_next
  // Only the host may emit these; server broadcasts authoritative state.
  // --------------------------------------------------------------------
  socket.on("host_play", (_: unknown, ack?: (resp: any) => void) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && getRoom(meta.roomId);
    if (!room) return ack?.({ ok: false, error: "No room" });
    if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Not host" });
    if (!room.currentTrackId) return ack?.({ ok: false, error: "No track loaded" });

    room.isPlaying = true;
    room.playingStartedAt = Date.now();
    io.to(room.id).emit("room_state", snapshotRoom(room));
    ack?.({ ok: true });
  });

  socket.on("host_pause", (_: unknown, ack?: (resp: any) => void) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && getRoom(meta.roomId);
    if (!room) return ack?.({ ok: false, error: "No room" });
    if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Not host" });

    if (room.isPlaying && room.playingStartedAt) {
      room.playingOffsetMs = Math.max(0, room.playingOffsetMs + (Date.now() - room.playingStartedAt));
    }
    room.isPlaying = false;
    room.playingStartedAt = null;
    io.to(room.id).emit("room_state", snapshotRoom(room));
    ack?.({ ok: true });
  });

  socket.on(
    "host_seek",
    ({ positionMs }: { positionMs: number }, ack?: (resp: any) => void) => {
      const meta = socketMeta.get(socket.id);
      const room = meta && getRoom(meta.roomId);
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Not host" });

      room.playingOffsetMs = Math.max(0, positionMs);
      room.playingStartedAt = room.isPlaying ? Date.now() : null;
      io.to(room.id).emit("room_state", snapshotRoom(room));
      ack?.({ ok: true });
    },
  );

  socket.on("host_next", (_: unknown, ack?: (resp: any) => void) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && getRoom(meta.roomId);
    if (!room) return ack?.({ ok: false, error: "No room" });
    if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Not host" });

    // Pop current, advance to next in queue.
    room.queue.shift();
    const next = room.queue[0] ?? null;
    room.currentTrackId = next?.id ?? null;
    room.playingOffsetMs = 0;
    room.playingStartedAt = next ? Date.now() : null;
    room.isPlaying = !!next;
    io.to(room.id).emit("room_state", snapshotRoom(room));
    ack?.({ ok: true });
  });

  // --------------------------------------------------------------------
  // host_jump — host jumps directly to a queued track. Everything before
  // it is dropped (skipped); the target becomes the new current track.
  // --------------------------------------------------------------------
  socket.on(
    "host_jump",
    ({ trackId }: { trackId: string }, ack?: (resp: any) => void) => {
      const meta = socketMeta.get(socket.id);
      const room = meta && getRoom(meta.roomId);
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Not host" });

      const idx = room.queue.findIndex((t) => t.id === trackId);
      if (idx === -1) return ack?.({ ok: false, error: "Track not in queue" });

      room.queue = room.queue.slice(idx);
      room.currentTrackId = room.queue[0]?.id ?? null;
      room.playingOffsetMs = 0;
      room.playingStartedAt = Date.now();
      room.isPlaying = !!room.currentTrackId;
      io.to(room.id).emit("room_state", snapshotRoom(room));
      ack?.({ ok: true });
    },
  );

  // --------------------------------------------------------------------
  // host_queue_move — host reorders a queued track by swapping it with
  // its neighbor ("up" or "down"). The currently-playing track is fixed
  // in position 0.
  // --------------------------------------------------------------------
  socket.on(
    "host_queue_move",
    ({ trackId, direction }: { trackId: string; direction: "up" | "down" }, ack?: (resp: any) => void) => {
      const meta = socketMeta.get(socket.id);
      const room = meta && getRoom(meta.roomId);
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Not host" });

      const idx = room.queue.findIndex((t) => t.id === trackId);
      if (idx <= 0) return ack?.({ ok: false, error: "Track not movable" });
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target <= 0 || target >= room.queue.length) {
        return ack?.({ ok: false, error: "Already at edge" });
      }
      const tmp = room.queue[idx];
      room.queue[idx] = room.queue[target];
      room.queue[target] = tmp;
      io.to(room.id).emit("room_state", snapshotRoom(room));
      ack?.({ ok: true });
    },
  );

  // --------------------------------------------------------------------
  // host_queue_remove — host removes a queued track. Refuses to remove
  // the currently-playing track (idx 0) — use host_jump or host_next.
  // --------------------------------------------------------------------
  socket.on(
    "host_queue_remove",
    ({ trackId }: { trackId: string }, ack?: (resp: any) => void) => {
      const meta = socketMeta.get(socket.id);
      const room = meta && getRoom(meta.roomId);
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Not host" });

      const idx = room.queue.findIndex((t) => t.id === trackId);
      if (idx <= 0) return ack?.({ ok: false, error: "Cannot remove the current track" });
      room.queue.splice(idx, 1);
      io.to(room.id).emit("room_state", snapshotRoom(room));
      ack?.({ ok: true });
    },
  );

  // --------------------------------------------------------------------
  // rename — a member updates their own display name.
  // --------------------------------------------------------------------
  socket.on(
    "rename",
    ({ name }: { name: string }, ack?: (resp: any) => void) => {
      const meta = socketMeta.get(socket.id);
      const room = meta && getRoom(meta.roomId);
      if (!room) return ack?.({ ok: false, error: "Not in a room" });
      const trimmed = (name ?? "").trim().slice(0, 32);
      if (!trimmed) return ack?.({ ok: false, error: "Name required" });
      const member = room.members.get(socket.id);
      if (member) {
        member.name = trimmed;
        socketMeta.set(socket.id, { roomId: room.id, name: trimmed });
        io.to(room.id).emit("room_state", snapshotRoom(room));
      }
      ack?.({ ok: true });
    },
  );

  // --------------------------------------------------------------------
  // Disconnect — drop the socket from the room, but DON'T kill the room
  // when the host vanishes. Participants stay connected; the room is
  // reclaimable by anyone holding hostSecret for HOST_GRACE_MS.
  // --------------------------------------------------------------------
  socket.on("disconnect", () => {
    const meta = socketMeta.get(socket.id);
    if (!meta) return;
    const room = getRoom(meta.roomId);
    if (!room) return;

    room.members.delete(socket.id);

    if (room.hostId === socket.id) {
      // Mark host slot as vacated but keep the room + playback state
      // alive so participants keep listening while the host reloads.
      // The server-anchored position keeps advancing via the wall clock
      // in snapshotRoom, so audio stays in sync; when the host returns
      // they reclaim and their audio element catches up via drift correction.
      room.hostId = null;
      room.hostLastSeenAt = Date.now();
      io.to(room.id).emit("host_disconnected", { graceMs: HOST_GRACE_MS });
      io.to(room.id).emit("room_state", snapshotRoom(room));
    } else if (room.members.size > 0) {
      io.to(room.id).emit("room_state", snapshotRoom(room));
    }
    socketMeta.delete(socket.id);
  });
});

// Ensure yt-dlp is available before the first stream request. If none
// of the candidate paths resolve, download the official release into
// `<cwd>/.bin/yt-dlp` so the resolver's last candidate finds it.
async function ensureYtDlp(): Promise<void> {
  const target = selfInstallPath();
  try {
    const { existsSync, mkdirSync } = await import("node:fs");
    const { spawnSync } = await import("node:child_process");
    if (existsSync(target)) {
      const v = spawnSync(target, ["--version"], { encoding: "utf8" });
      if (v.status === 0) {
        console.log(`[jamify] yt-dlp ready at ${target} (${v.stdout.trim()})`);
        return;
      }
      console.warn(`[jamify] yt-dlp at ${target} returned non-zero; replacing`);
    }
    const dir = target.slice(0, target.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    console.log(`[jamify] yt-dlp missing — downloading to ${target}`);
    const res = await fetch(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
    );
    if (!res.ok) {
      console.warn(
        `[jamify] yt-dlp download failed: HTTP ${res.status} (${res.statusText})`,
      );
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(target, buf, { mode: 0o755 }),
    );
    const v = spawnSync(target, ["--version"], { encoding: "utf8" });
    if (v.status === 0) {
      console.log(`[jamify] yt-dlp self-installed (${v.stdout.trim()})`);
    } else {
      console.warn(`[jamify] yt-dlp self-installed binary not executable: ${v.stderr}`);
    }
  } catch (err) {
    console.warn(`[jamify] yt-dlp self-install skipped: ${(err as Error).message}`);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Jamify backend listening on http://localhost:${PORT}`);
  console.log(`Jamify yt-dlp binary:  ${YT_DLP_BIN}`);
  // Self-install runs after listen so the server is up immediately
  // even if the download takes a few seconds.
  ensureYtDlp().then(() => {
    console.log(`[jamify] yt-dlp bootstrap complete`);
  });
});