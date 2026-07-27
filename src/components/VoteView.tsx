import { useEffect, useMemo, useState } from "react";
import { listClips, recordVote, type Clip } from "../lib/db";

function pickPair(clips: Clip[]): [Clip, Clip] | null {
  if (clips.length < 2) return null;
  const a = Math.floor(Math.random() * clips.length);
  let b = Math.floor(Math.random() * clips.length);
  while (b === a) b = Math.floor(Math.random() * clips.length);
  return [clips[a], clips[b]];
}

function ClipCard({ clip, onPick }: { clip: Clip; onPick: () => void }) {
  const url = useMemo(() => URL.createObjectURL(clip.blob), [clip.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <button
      type="button"
      onClick={onPick}
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 hover:ring-fuchsia-400/60 transition"
    >
      <video src={url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-sm font-bold text-white">{clip.label}</span>
      </div>
      <div className="absolute inset-0 grid place-items-center opacity-0 group-active:opacity-100 bg-fuchsia-500/20 transition">
        <span className="text-white font-black text-xl">mais aura ✦</span>
      </div>
    </button>
  );
}

export function VoteView({ refreshKey }: { refreshKey: number }) {
  const [pair, setPair] = useState<[Clip, Clip] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listClips().then((all) => {
      setPair(pickPair(all));
      setLoading(false);
    });
  }, [refreshKey]);

  const vote = async (winner: Clip, loser: Clip) => {
    await recordVote(winner.id, loser.id);
    const updated = await listClips();
    setPair(pickPair(updated));
  };

  if (loading) {
    return <p className="text-white/50 text-center">Carregando os clipes...</p>;
  }

  if (!pair) {
    return (
      <div className="text-center text-white/60 max-w-sm mx-auto">
        <p className="font-semibold text-white">Precisa de pelo menos 2 clipes pra votar.</p>
        <p className="text-sm mt-1">Grava mais alguns na aba "Farmar" primeiro.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-white/60 font-medium">Qual farmou mais aura?</p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        <ClipCard clip={pair[0]} onPick={() => vote(pair[0], pair[1])} />
        <ClipCard clip={pair[1]} onPick={() => vote(pair[1], pair[0])} />
      </div>
    </div>
  );
}
