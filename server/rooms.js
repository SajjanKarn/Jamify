// In-memory jam room state. Good enough for a prototype.
// Each room has one host (the creator). The host's player is the
// authoritative source of truth; participants drift-correct against
// the host via periodic position broadcasts.
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var rooms = new Map();
// Host gets a 5-minute grace period to refresh and reclaim.
var HOST_GRACE_MS = 5 * 60 * 1000;
var ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6h idle eviction
function gc() {
    var now = Date.now();
    for (var _i = 0, rooms_1 = rooms; _i < rooms_1.length; _i++) {
        var _a = rooms_1[_i], id = _a[0], room = _a[1];
        if (now - room.createdAt > ROOM_TTL_MS && room.members.size === 0) {
            rooms.delete(id);
        }
    }
}
function newRoomId() {
    // 6-char base36 — easy to read aloud.
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function newSecret() {
    return Math.random().toString(36).slice(2, 18);
}
export function createRoom(hostSocketId, hostName) {
    gc();
    var room = {
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
export function getRoom(id) {
    gc();
    return rooms.get(id);
}
export function deleteRoom(id) {
    rooms.delete(id);
}
/** Is the host slot still reclaimable (within grace + non-empty room)? */
export function isHostRecoverable(room) {
    if (room.hostSecret === "")
        return false;
    if (room.hostLastSeenAt == null)
        return false;
    return Date.now() - room.hostLastSeenAt < HOST_GRACE_MS;
}
export function snapshotRoom(room) {
    return {
        id: room.id,
        hostId: room.hostId,
        members: __spreadArray([], room.members.values(), true),
        queue: room.queue,
        currentTrackId: room.currentTrackId,
        isPlaying: room.isPlaying,
        // Reconstructed playback position (server-anchored clock).
        positionMs: room.isPlaying && room.playingStartedAt
            ? Math.max(0, room.playingOffsetMs + (Date.now() - room.playingStartedAt))
            : room.playingOffsetMs,
    };
}
