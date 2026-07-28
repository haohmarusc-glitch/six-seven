import { useEffect, useState } from "react";
import { castVote, clipVideoUrl, getBattlePair, reportClip, type BattleContestant } from "../lib/api";
import { CommentBox } from "./CommentBox";

function Contestant({
  clip,
  side,
  result,
  onPick,
  onReport,
}: {
  clip: BattleContestant;
  side: "top" | "bottom";
  result: "winner" | "loser" | null;
  onPick: () => void;
  onReport: () => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  // A rodada seguinte reaproveita esse mesmo slot (top/bottom) pra um clipe
  // novo -- fecha o painel do clipe anterior em vez de deixá-lo aberto por
  // cima de um vídeo que não tem nada a ver.
  useEffect(() => {
    setCommentsOpen(false);
  }, [clip.id]);

  return (
    <div
      className={`group relative flex-1 min-h-0 overflow-hidden bg-black ring-2 transition-all duration-300 ${
        side === "top" ? "rounded-t-3xl" : "rounded-b-3xl"
      } ${
        result === "winner"
          ? "ring-fuchsia-400 scale-[1.01] z-10"
          : result === "loser"
            ? "ring-white/5 opacity-40 grayscale"
            : "ring-white/10"
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={result !== null}
        className="absolute inset-0 w-full h-full active:brightness-90 transition"
      >
        <video src={clipVideoUrl(clip.id)} autoPlay loop muted playsInline className="w-full h-full object-cover" />
      </button>

      {/* nível de aura -- placar visível ANTES de votar, faz parte da graça da batalha */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full ring-1 ring-white/10 pointer-events-none">
        <span className="text-[10px] font-black text-cyan-300 tabular-nums">
          {clip.auraLevel ?? "??"}
        </span>
        <span className="text-[9px] text-white/40 uppercase">aura</span>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReport(); }}
        title="Denunciar clipe"
        aria-label="Denunciar clipe"
        className="absolute top-2.5 left-2.5 h-6 w-6 grid place-items-center bg-black/60 backdrop-blur rounded-full ring-1 ring-white/10 text-white/50 hover:text-rose-300 text-xs"
      >
        ⚑
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setCommentsOpen((v) => !v); }}
        title="Comentários"
        aria-label="Comentários"
        className="absolute bottom-2.5 right-2.5 z-20 h-6 w-6 grid place-items-center bg-black/60 backdrop-blur rounded-full ring-1 ring-white/10 text-white/50 hover:text-cyan-300 text-xs"
      >
        💬
      </button>

      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 to-transparent pointer-events-none">
        <span className="text-base font-black text-white drop-shadow">{clip.label}</span>
      </div>

      {commentsOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 max-h-[75%] bg-black/90 backdrop-blur-md ring-1 ring-white/10 rounded-t-2xl z-30 flex flex-col"
        >
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 shrink-0">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Comentários</span>
            <button
              type="button"
              onClick={() => setCommentsOpen(false)}
              className="text-white/40 hover:text-white text-xs"
            >
              fechar
            </button>
          </div>
          <div className="overflow-y-auto px-3 pb-3">
            <CommentBox clipId={clip.id} />
          </div>
        </div>
      )}

      {result === "winner" && (
        <div className="absolute inset-0 grid place-items-center bg-fuchsia-500/25 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <span className="text-2xl font-black text-white drop-shadow-[0_0_12px_rgba(232,121,249,0.9)]">
            VENCEU ✦
          </span>
        </div>
      )}
    </div>
  );
}

export function VoteView({
  refreshKey,
  challengerId,
  onChallengerConsumed,
}: {
  refreshKey: number;
  challengerId: string | null;
  onChallengerConsumed: () => void;
}) {
  const [pair, setPair] = useState<BattleContestant[] | null>(null);
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guarda qual dos dois venceu enquanto o flash de vitória aparece, antes
  // de sortear a próxima batalha -- sem isso a troca é instantânea e
  // ninguém vê o resultado do próprio voto.
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [reportedId, setReportedId] = useState<string | null>(null);

  useEffect(() => {
    getBattlePair(challengerId ?? undefined)
      .then((p) => {
        setPair(p);
        setLoading(false);
        // O convocado só vale pra ESSA batalha -- consome na hora pra não
        // ficar puxando o mesmo clipe de novo depois que o round passar.
        if (challengerId) onChallengerConsumed();
      })
      .catch((err) => setError(err.message ?? "Falha ao carregar batalha"));
    // Só depende de refreshKey (mudança de aba/voto) de propósito -- reagir
    // a challengerId aqui também dispararia de novo quando ele for
    // consumido (vira null), sorteando por cima do par que acabou de forçar.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const vote = async (winner: BattleContestant, loser: BattleContestant) => {
    setWinnerId(winner.id);
    await castVote(winner.id, loser.id);
    setTimeout(async () => {
      const updated = await getBattlePair();
      setPair(updated);
      setWinnerId(null);
      setRound((r) => r + 1);
    }, 700);
  };

  const report = async (id: string) => {
    await reportClip(id);
    setReportedId(id);
    setTimeout(() => setReportedId(null), 1500);
  };

  if (loading) {
    return <p className="text-white/50 text-center">Carregando os clipes...</p>;
  }

  if (error) {
    return <p className="text-rose-300 text-center text-sm">{error}</p>;
  }

  if (!pair) {
    return (
      <div className="text-center text-white/60 max-w-sm mx-auto">
        <p className="font-semibold text-white">Ninguém pra batalhar com você ainda.</p>
        <p className="text-sm mt-1">
          Precisa de pelo menos 2 clipes aprovados de dispositivos diferentes.
        </p>
      </div>
    );
  }

  const [a, b] = pair;

  return (
    <div className="flex flex-col items-center gap-3 h-[calc(100dvh-11.5rem)] max-h-[640px] w-full max-w-sm mx-auto">
      <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">
        Batalha #{round}
      </p>

      <div className="relative flex-1 w-full flex flex-col gap-[3px]">
        <Contestant
          clip={a}
          side="top"
          result={winnerId ? (winnerId === a.id ? "winner" : "loser") : null}
          onPick={() => vote(a, b)}
          onReport={() => report(a.id)}
        />
        <Contestant
          clip={b}
          side="bottom"
          result={winnerId ? (winnerId === b.id ? "winner" : "loser") : null}
          onPick={() => vote(b, a)}
          onReport={() => report(b.id)}
        />

        {/* selo VS flutuando na costura entre os dois cards */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 h-14 w-14 rounded-full bg-gradient-to-br from-fuchsia-600 to-cyan-500 grid place-items-center shadow-[0_0_25px_-4px_rgba(232,121,249,0.9)] ring-4 ring-[#0a0a12]">
          <span className="text-white font-black text-sm italic">VS</span>
        </div>
      </div>

      <p className="text-xs text-white/40">
        {reportedId ? "Denúncia enviada, valeu." : "Toca no clipe que farmou mais aura"}
      </p>
    </div>
  );
}
