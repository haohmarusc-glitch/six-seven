import { useEffect, useState } from "react";
import { clipVideoUrl, getLeaderboard, reportClip, type LeaderboardEntry } from "../lib/api";

function Thumb({ clip, rank }: { clip: LeaderboardEntry; rank: number }) {
  const total = clip.wins + clip.losses;
  const winRate = total ? Math.round((clip.wins / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 ring-1 ring-white/10">
      <span className="w-7 shrink-0 text-center font-black text-white/40 tabular-nums">
        {rank}
      </span>
      <video src={clipVideoUrl(clip.id)} muted playsInline className="h-14 w-11 rounded-lg object-cover bg-black shrink-0" />
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

export function LeaderboardView({
  refreshKey,
  onChallenge,
}: {
  refreshKey: number;
  onChallenge: (clipId: string) => void;
}) {
  const [ranked, setRanked] = useState<LeaderboardEntry[]>([]);
  const [reportedId, setReportedId] = useState<string | null>(null);

  useEffect(() => {
    getLeaderboard().then(setRanked).catch(() => {});
  }, [refreshKey]);

  const handleReport = async (id: string) => {
    await reportClip(id);
    setReportedId(id);
    setTimeout(() => setReportedId(null), 1500);
  };

  if (ranked.length === 0) {
    return <p className="text-white/50 text-center">Nenhum clipe aprovado ainda. Vai farmar aura.</p>;
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-md mx-auto">
      {ranked.map((clip, i) => (
        <div key={clip.id} className="flex items-center gap-2">
          <div className="flex-1">
            <Thumb clip={clip} rank={i + 1} />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onChallenge(clip.id)}
              disabled={ranked.length < 2}
              className="text-[11px] font-bold text-fuchsia-300 hover:text-fuchsia-200 disabled:opacity-30 disabled:hover:text-fuchsia-300 px-2 py-1 rounded-md bg-fuchsia-500/10 ring-1 ring-fuchsia-400/30"
              aria-label={`Chamar ${clip.label} pra batalha`}
            >
              batalhar
            </button>
            <button
              type="button"
              onClick={() => handleReport(clip.id)}
              className="text-white/30 hover:text-rose-400 text-xs px-2 py-1"
              aria-label={`Denunciar clipe ${clip.label}`}
            >
              {reportedId === clip.id ? "denunciado" : "denunciar"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
