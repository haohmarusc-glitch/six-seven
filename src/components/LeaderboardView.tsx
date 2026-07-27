import { useEffect, useMemo, useState } from "react";
import { auraScore, deleteClip, listClips, type Clip } from "../lib/db";

function Thumb({ clip, rank }: { clip: Clip; rank: number }) {
  const url = useMemo(() => URL.createObjectURL(clip.blob), [clip.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const total = clip.wins + clip.losses;
  const winRate = total ? Math.round((clip.wins / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 ring-1 ring-white/10">
      <span className="w-7 shrink-0 text-center font-black text-white/40 tabular-nums">
        {rank}
      </span>
      <video src={url} muted playsInline className="h-14 w-11 rounded-lg object-cover bg-black shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white truncate">{clip.label}</p>
        <p className="text-xs text-white/50 tabular-nums">
          {clip.wins}V · {clip.losses}D {total > 0 && `· ${winRate}%`}
        </p>
      </div>
      {rank === 1 && total > 0 && <span className="text-2xl shrink-0">👑</span>}
    </div>
  );
}

export function LeaderboardView({ refreshKey }: { refreshKey: number }) {
  const [clips, setClips] = useState<Clip[]>([]);

  useEffect(() => {
    listClips().then(setClips);
  }, [refreshKey]);

  const ranked = useMemo(
    () => [...clips].sort((a, b) => auraScore(b) - auraScore(a)),
    [clips],
  );

  const handleDelete = async (id: string) => {
    await deleteClip(id);
    setClips((prev) => prev.filter((c) => c.id !== id));
  };

  if (ranked.length === 0) {
    return <p className="text-white/50 text-center">Nenhum clipe ainda. Vai farmar aura.</p>;
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-md mx-auto">
      {ranked.map((clip, i) => (
        <div key={clip.id} className="flex items-center gap-2">
          <div className="flex-1">
            <Thumb clip={clip} rank={i + 1} />
          </div>
          <button
            type="button"
            onClick={() => handleDelete(clip.id)}
            className="text-white/30 hover:text-rose-400 text-xs px-2 py-1 shrink-0"
            aria-label={`Apagar clipe ${clip.label}`}
          >
            apagar
          </button>
        </div>
      ))}
    </div>
  );
}
