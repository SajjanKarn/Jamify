// Express + Socket.IO server. Exposes:
//   - REST: GET /api/search?q=, GET /api/stream/:id
//   - Socket.IO events for jam rooms:
//     create_room, join_room, leave_room, add_to_queue,
//     host_play, host_pause, host_seek, host_next
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";
import { searchTracks, resolveStream } from "./innertube.js";
import { createRoom, getRoom, isHostRecoverable, snapshotRoom } from "./rooms.js";
var PORT = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3001);
var HOST_GRACE_MS = 5 * 60 * 1000; // host can refresh and reclaim within 5 min
var app = express();
app.use(cors());
app.use(express.json());
app.get("/api/health", function (_req, res) {
    res.json({ ok: true, time: Date.now() });
});
app.get("/api/search", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var q, tracks, err_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                q = String((_a = req.query.q) !== null && _a !== void 0 ? _a : "");
                return [4 /*yield*/, searchTracks(q)];
            case 1:
                tracks = _c.sent();
                res.json({ tracks: tracks });
                return [3 /*break*/, 3];
            case 2:
                err_1 = _c.sent();
                res.status(500).json({ error: (_b = err_1 === null || err_1 === void 0 ? void 0 : err_1.message) !== null && _b !== void 0 ? _b : "search failed" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Stream resolution is done lazily by the host's player when they
// press play. Other participants piggy-back off the host's resolved
// URL — see /api/rooms/:id/stream?trackId=... logic on the client.
app.get("/api/stream/:videoId", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, audioUrl, expiresAt, track, err_2;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                return [4 /*yield*/, resolveStream(req.params.videoId)];
            case 1:
                _a = _c.sent(), audioUrl = _a.audioUrl, expiresAt = _a.expiresAt, track = _a.track;
                res.json({ audioUrl: audioUrl, expiresAt: expiresAt, track: track });
                return [3 /*break*/, 3];
            case 2:
                err_2 = _c.sent();
                res.status(500).json({ error: (_b = err_2 === null || err_2 === void 0 ? void 0 : err_2.message) !== null && _b !== void 0 ? _b : "resolve failed" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
var httpServer = http.createServer(app);
var io = new Server(httpServer, {
    cors: { origin: true },
});
// Map socket.id -> { roomId, memberName } for reconnection/teardown.
var socketMeta = new Map();
io.on("connection", function (socket) {
    // --------------------------------------------------------------------
    // create_room — host spins up a room, becomes host. Server returns
    // a hostSecret the client must persist to reclaim host on refresh.
    // --------------------------------------------------------------------
    socket.on("create_room", function (_a, ack) {
        var name = _a.name;
        var room = createRoom(socket.id, (name === null || name === void 0 ? void 0 : name.trim()) || "Host");
        socketMeta.set(socket.id, { roomId: room.id, name: (name === null || name === void 0 ? void 0 : name.trim()) || "Host" });
        socket.join(room.id);
        ack === null || ack === void 0 ? void 0 : ack({
            ok: true,
            you: { id: socket.id, name: (name === null || name === void 0 ? void 0 : name.trim()) || "Host", role: "host" },
            room: snapshotRoom(room),
            hostSecret: room.hostSecret,
        });
    });
    // --------------------------------------------------------------------
    // join_room — joins as participant, or reclaims host with matching secret.
    // --------------------------------------------------------------------
    socket.on("join_room", function (_a, ack) {
        var roomId = _a.roomId, name = _a.name, hostSecret = _a.hostSecret;
        var room = getRoom(roomId.toUpperCase());
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Room not found" });
        var trimmedName = (name === null || name === void 0 ? void 0 : name.trim()) || "Guest";
        // Reclaim host if the caller proves they're the original creator
        // (matching secret) and the host slot hasn't expired.
        var reclaimingHost = hostSecret &&
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
            ack === null || ack === void 0 ? void 0 : ack({
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
        ack === null || ack === void 0 ? void 0 : ack({
            ok: true,
            you: { id: socket.id, name: trimmedName, role: "participant" },
            room: snapshotRoom(room),
        });
        io.to(room.id).emit("room_state", snapshotRoom(room));
    });
    // --------------------------------------------------------------------
    // add_to_queue — anyone in the room can add. Host auto-approves.
    // --------------------------------------------------------------------
    socket.on("add_to_queue", function (_a, ack) {
        var track = _a.track;
        var meta = socketMeta.get(socket.id);
        if (!meta)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not in a room" });
        var room = getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Room gone" });
        // If queue is empty and nothing is playing, autoplay.
        var wasIdle = !room.currentTrackId;
        room.queue.push(track);
        if (wasIdle) {
            room.currentTrackId = track.id;
            room.playingOffsetMs = 0;
            room.playingStartedAt = Date.now();
            room.isPlaying = true;
        }
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    // --------------------------------------------------------------------
    // host_play / host_pause / host_seek / host_next
    // Only the host may emit these; server broadcasts authoritative state.
    // --------------------------------------------------------------------
    socket.on("host_play", function (_, ack) {
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No room" });
        if (room.hostId !== socket.id)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not host" });
        if (!room.currentTrackId)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No track loaded" });
        room.isPlaying = true;
        room.playingStartedAt = Date.now();
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    socket.on("host_pause", function (_, ack) {
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No room" });
        if (room.hostId !== socket.id)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not host" });
        if (room.isPlaying && room.playingStartedAt) {
            room.playingOffsetMs = Math.max(0, room.playingOffsetMs + (Date.now() - room.playingStartedAt));
        }
        room.isPlaying = false;
        room.playingStartedAt = null;
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    socket.on("host_seek", function (_a, ack) {
        var positionMs = _a.positionMs;
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No room" });
        if (room.hostId !== socket.id)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not host" });
        room.playingOffsetMs = Math.max(0, positionMs);
        room.playingStartedAt = room.isPlaying ? Date.now() : null;
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    socket.on("host_next", function (_, ack) {
        var _a, _b;
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No room" });
        if (room.hostId !== socket.id)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not host" });
        // Pop current, advance to next in queue.
        room.queue.shift();
        var next = (_a = room.queue[0]) !== null && _a !== void 0 ? _a : null;
        room.currentTrackId = (_b = next === null || next === void 0 ? void 0 : next.id) !== null && _b !== void 0 ? _b : null;
        room.playingOffsetMs = 0;
        room.playingStartedAt = next ? Date.now() : null;
        room.isPlaying = !!next;
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    // --------------------------------------------------------------------
    // host_jump — host jumps directly to a queued track. Everything before
    // it is dropped (skipped); the target becomes the new current track.
    // --------------------------------------------------------------------
    socket.on("host_jump", function (_a, ack) {
        var _b, _c;
        var trackId = _a.trackId;
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No room" });
        if (room.hostId !== socket.id)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not host" });
        var idx = room.queue.findIndex(function (t) { return t.id === trackId; });
        if (idx === -1)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Track not in queue" });
        room.queue = room.queue.slice(idx);
        room.currentTrackId = (_c = (_b = room.queue[0]) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : null;
        room.playingOffsetMs = 0;
        room.playingStartedAt = Date.now();
        room.isPlaying = !!room.currentTrackId;
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    // --------------------------------------------------------------------
    // host_queue_move — host reorders a queued track by swapping it with
    // its neighbor ("up" or "down"). The currently-playing track is fixed
    // in position 0.
    // --------------------------------------------------------------------
    socket.on("host_queue_move", function (_a, ack) {
        var trackId = _a.trackId, direction = _a.direction;
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No room" });
        if (room.hostId !== socket.id)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not host" });
        var idx = room.queue.findIndex(function (t) { return t.id === trackId; });
        if (idx <= 0)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Track not movable" });
        var target = direction === "up" ? idx - 1 : idx + 1;
        if (target <= 0 || target >= room.queue.length) {
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Already at edge" });
        }
        var tmp = room.queue[idx];
        room.queue[idx] = room.queue[target];
        room.queue[target] = tmp;
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    // --------------------------------------------------------------------
    // host_queue_remove — host removes a queued track. Refuses to remove
    // the currently-playing track (idx 0) — use host_jump or host_next.
    // --------------------------------------------------------------------
    socket.on("host_queue_remove", function (_a, ack) {
        var trackId = _a.trackId;
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "No room" });
        if (room.hostId !== socket.id)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not host" });
        var idx = room.queue.findIndex(function (t) { return t.id === trackId; });
        if (idx <= 0)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Cannot remove the current track" });
        room.queue.splice(idx, 1);
        io.to(room.id).emit("room_state", snapshotRoom(room));
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    // --------------------------------------------------------------------
    // rename — a member updates their own display name.
    // --------------------------------------------------------------------
    socket.on("rename", function (_a, ack) {
        var name = _a.name;
        var meta = socketMeta.get(socket.id);
        var room = meta && getRoom(meta.roomId);
        if (!room)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Not in a room" });
        var trimmed = (name !== null && name !== void 0 ? name : "").trim().slice(0, 32);
        if (!trimmed)
            return ack === null || ack === void 0 ? void 0 : ack({ ok: false, error: "Name required" });
        var member = room.members.get(socket.id);
        if (member) {
            member.name = trimmed;
            socketMeta.set(socket.id, { roomId: room.id, name: trimmed });
            io.to(room.id).emit("room_state", snapshotRoom(room));
        }
        ack === null || ack === void 0 ? void 0 : ack({ ok: true });
    });
    // --------------------------------------------------------------------
    // Disconnect — drop the socket from the room, but DON'T kill the room
    // when the host vanishes. Participants stay connected; the room is
    // reclaimable by anyone holding hostSecret for HOST_GRACE_MS.
    // --------------------------------------------------------------------
    socket.on("disconnect", function () {
        var meta = socketMeta.get(socket.id);
        if (!meta)
            return;
        var room = getRoom(meta.roomId);
        if (!room)
            return;
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
        }
        else if (room.members.size > 0) {
            io.to(room.id).emit("room_state", snapshotRoom(room));
        }
        socketMeta.delete(socket.id);
    });
});
httpServer.listen(PORT, function () {
    console.log("Jamify backend listening on http://localhost:".concat(PORT));
});
