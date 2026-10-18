export interface Track {
    id: string;
    title: string;
    artist: string;
    durationSec: number;
    thumbnail: string;
}
export declare function searchTracks(query: string): Promise<Track[]>;
export declare function resolveStream(videoId: string): Promise<{
    audioUrl: string;
    expiresAt: number;
    track: Track;
}>;
