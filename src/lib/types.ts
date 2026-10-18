export interface Track {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  thumbnail: string;
}

export type MemberRole = "host" | "participant";

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  joinedAt: number;
}

export interface RoomSnapshot {
  id: string;
  hostId: string;
  members: Member[];
  queue: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  positionMs: number;
}