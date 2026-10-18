// In-memory jam room state. Good enough for a prototype.
// Each room has one host (the creator). The host's player is the
// authoritative source of truth; participants drift-correct against
// the host via periodic position broadcasts.

import type { Track } from "./innertube.js";

export type MemberRole = "host" | "participant";

export interface Member {
  id: string; // socket id
  name: string;
  role: MemberRole;
  joinedAt: number;
}

export interface Room {
  id: string;
  hostId: string | null;
  // Random per-room secret returned to the creator. Lets a refreshing
  // host reclaim host status on reconnect.
  hostSecret: string;
  members: Map<string, Member>;
  queue: Track[];
  // Playback state — only the host writes to currentTrackId/playingAtMs.
  currentTrackId: string | null;
  // Server-anchored epoch ms when the current track started playing.
  playingStartedAt: number | null;
  // Offset within the track at the moment playback started.
  playingOffsetMs: number;
  isPlaying: boolean;
  // ms timestamp the host was last seen; used to decide whether the
  // room is still recoverable. null if host never connected.
  hostLastSeenAt: number | null;
  createdAt: number;
}

const rooms = new Map<string, Room>();

// Host gets a 5-minute grace period to refresh and reclaim.
const HOST_GRACE_MS = 5 * 60 * 1000;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6h idle eviction

function gc() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS && room.members.size === 0) {
      rooms.delete(id);
    }
  }
}

function newRoomId(): string {
  // 6-char base36 — easy to read aloud.
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function newSecret(): string {
  return Math.random().toString(36).slice(2, 18);
}

export function createRoom(hostSocketId: string, hostName: string): Room {
  gc();
  const room: Room = {
    id: newRoomId(),
    hostId: hostSocketId,
    hostSecret: newSecret(),
    members: new Map([[hostSocketId, { id: hostSocketId, name: hostName, role: "host", joinedAt: Date.now() }]]),
    queue: [],
    currentTrackId: null,
    playingStartedAt: null,
    playingOffsetMs: 0,
    isPlaying: false,
    hostLastSeenAt: Date.now(),
    createdAt: Date.now(),
  };
  rooms.set(room.id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  gc();
  return rooms.get(id);
}

export function deleteRoom(id: string) {
  rooms.delete(id);
}

/** Is the host slot still reclaimable (within grace + non-empty room)? */
export function isHostRecoverable(room: Room): boolean {
  if (room.hostSecret === "") return false;
  if (room.hostLastSeenAt == null) return false;
  return Date.now() - room.hostLastSeenAt < HOST_GRACE_MS;
}

export function snapshotRoom(room: Room) {
  return {
    id: room.id,
    hostId: room.hostId,
    members: [...room.members.values()],
    queue: room.queue,
    currentTrackId: room.currentTrackId,
    isPlaying: room.isPlaying,
    // Reconstructed playback position (server-anchored clock).
    positionMs:
      room.isPlaying && room.playingStartedAt
        ? Math.max(0, room.playingOffsetMs + (Date.now() - room.playingStartedAt))
        : room.playingOffsetMs,
  };
}