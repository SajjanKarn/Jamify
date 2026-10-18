import type { Track } from "./innertube.js";
export type MemberRole = "host" | "participant";
export interface Member {
    id: string;
    name: string;
    role: MemberRole;
    joinedAt: number;
}
export interface Room {
    id: string;
    hostId: string | null;
    hostSecret: string;
    members: Map<string, Member>;
    queue: Track[];
    currentTrackId: string | null;
    playingStartedAt: number | null;
    playingOffsetMs: number;
    isPlaying: boolean;
    hostLastSeenAt: number | null;
    createdAt: number;
}
export declare function createRoom(hostSocketId: string, hostName: string): Room;
export declare function getRoom(id: string): Room | undefined;
export declare function deleteRoom(id: string): void;
/** Is the host slot still reclaimable (within grace + non-empty room)? */
export declare function isHostRecoverable(room: Room): boolean;
export declare function snapshotRoom(room: Room): {
    id: string;
    hostId: string | null;
    members: any[];
    queue: Track[];
    currentTrackId: string | null;
    isPlaying: boolean;
    positionMs: number;
};
