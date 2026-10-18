import React from "react";
import { useNavigate } from "react-router-dom";
import { useJamStore } from "../lib/store";
import { SearchIcon, GroupIcon, ArrowRightIcon } from "../components/icons";

export default function JamLobby() {
  const nav = useNavigate();
  const createRoom = useJamStore((s) => s.createRoom);
  const joinRoom = useJamStore((s) => s.joinRoom);
  const myName = useJamStore((s) => s.myName);

  const [name, setName] = React.useState(myName);
  const [joinCode, setJoinCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      await createRoom(name || "Host");
      const id = useJamStore.getState().room?.id;
      if (id) nav(`/jam/${id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    setBusy(true);
    setErr(null);
    try {
      await joinRoom(joinCode, name || "Guest");
      const id = useJamStore.getState().room?.id;
      if (id) nav(`/jam/${id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-6 max-w-2xl">
      <h2 className="text-3xl font-bold mb-2">Jam together</h2>
      <p className="text-ink-secondary mb-8">
        One host plays, everyone listens in sync. Anyone in the room can add songs to the shared queue.
      </p>

      <div className="bg-spotify-surface rounded-lg p-6 mb-4">
        <label className="text-xs uppercase font-bold text-ink-secondary tracking-wider">Your name</label>
        <input
          className="w-full bg-transparent border-b border-white/20 focus:border-white outline-none py-2 text-xl font-bold mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Avery"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          className="bg-spotify-surface hover:bg-spotify-surface-hover rounded-lg p-6 text-left transition group"
          onClick={onCreate}
          disabled={busy}
        >
          <GroupIcon className="text-3xl text-brand mb-3" />
          <div className="text-xl font-bold mb-1">Create a room</div>
          <p className="text-sm text-ink-secondary mb-4">You'll be the host — your player drives everyone.</p>
          <div className="text-brand text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
            Start jamming <ArrowRightIcon className="text-sm" />
          </div>
        </button>

        <div className="bg-spotify-surface hover:bg-spotify-surface-hover rounded-lg p-6 text-left transition">
          <SearchIcon className="text-3xl text-brand mb-3" />
          <div className="text-xl font-bold mb-1">Join with code</div>
          <p className="text-sm text-ink-secondary mb-4">Got a room code? Punch it in.</p>
          <input
            className="w-full bg-black/40 border border-white/10 focus:border-white rounded-md px-4 py-3 text-center text-2xl tracking-[0.4em] uppercase font-bold outline-none"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
          />
          <button
            className="btn-pill-white mt-3 w-full h-10 text-sm"
            onClick={onJoin}
            disabled={busy || joinCode.length < 4}
          >
            Join
          </button>
        </div>
      </div>

      {err && <p className="mt-4 text-red-400 text-sm">{err}</p>}
    </div>
  );
}