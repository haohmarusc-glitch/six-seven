import { useEffect, useMemo, useState } from "react";
import { auraScore, listClips, recordVote, type Clip } from "../lib/db";

// forcedId: clipe "convocado" a partir do botão batalhar do ranking -- entra
// garantido num dos dois lados, o adversário ainda sai sorteado. Se o clipe
// convocado não existir mais (foi apagado), cai de volta pro sorteio normal.
function pickPair(clips: Clip[], forcedId?: string | null): [Clip, Clip] | null {
  if (clips.length < 2) return null;
  const forced = forcedId ? clips.find((c) => c.id === forcedId) : undefined;
  const pool = forced ? clips.filter((c) => c.id !== forced.id) : clips;
  const opponent = pool[Math.floor(Math.random() * pool.length)];
  if (forced) return [forced, opponent];

  const a = Math.floor(Math.random() * clips.length);
  let b = Math.floor(Math.random() * clips.length);
  while (b === a) b = Math.floor(Math.random() * clips.length);
  return [clips[a], clips[b]];
}

// Nível de aura exibido na hora da batalha -- mesmo Wilson score do
// ranking, só que em escala 0-99 (mais fácil de comparar num relance do
// que a fração crua) e "??" enquanto o clipe ainda não tem voto nenhum,
// pra não fingir que 0 é um placar de verdade.
function auraLevel(clip: Clip): string {
  const n = clip.wins + clip.losses;
  if (n === 0) return "??";
  return String(Math.round(auraScore(clip) * 99)).padStart(2, "0");
}

function Contestant({
  clip,
  side,
  result,
  onPick,
}: {
  clip: Clip;
  side: "top" | "bottom";
  result: "winner" | "loser" | null;
  onPick: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(clip.blob), [clip.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={result !== null}
      className={`group relative flex-1 min-h-0 overflow-hidden bg-black ring-2 transition-all duration-300 ${
        side === "top" ? "rounded-t-3xl" : "rounded-b-3xl"
      } ${
        result === "winner"
          ? "ring-fuchsia-400 scale-[1.01] z-10"
          : result === "loser"
            ? "ring-white/5 opacity-40 grayscale"
            : "ring-white/10 active:ring-cyan-300/70"
      }`}
    >
      <video src={url} autoPlay loop muted playsInline className="w-full h-full object-cover" />

      {/* nível de aura -- placar visível ANTES de votar, faz parte da graça da batalha */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full ring-1 ring-white/10">
        <span className="text-[10px] font-black text-cyan-300 tabular-nums">
          {auraLevel(clip)}
        </span>
        <span className="text-[9px] text-white/40 uppercase">aura</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 to-transparent">
        <span className="text-base font-black text-white drop-shadow">{clip.label}</span>
      </div>

      {result === "winner" && (
        <div className="absolute inset-0 grid place-items-center bg-fuchsia-500/25 animate-in fade-in zoom-in-95 duration-200">
          <span className="text-2xl font-black text-white drop-shadow-[0_0_12px_rgba(232,121,249,0.9)]">
            VENCEU ✦
          </span>
        </div>
      )}
    </button>
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
  const [pair, setPair] = useState<[Clip, Clip] | null>(null);
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(true);
  // Guarda qual dos dois venceu enquanto o flash de vitória aparece, antes
  // de sortear a próxima batalha -- sem isso a troca é instantânea e
  // ninguém vê o resultado do próprio voto.
  const [winnerId, setWinnerId] = useState<string | null>(null);

  useEffect(() => {
    listClips().then((all) => {
      setPair(pickPair(all, challengerId));
      setLoading(false);
      // O convocado só vale pra ESSA batalha -- consome na hora pra não
      // ficar puxando o mesmo clipe de novo depois que o round passar.
      if (challengerId) onChallengerConsumed();
    });
    // Só depende de refreshKey (mudança de aba/voto) de propósito -- reagir
    // a challengerId aqui também dispararia de novo quando ele for
    // consumido (vira null), sorteando por cima do par que acabou de forçar.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const vote = async (winner: Clip, loser: Clip) => {
    setWinnerId(winner.id);
    await recordVote(winner.id, loser.id);
    setTimeout(async () => {
      const updated = await listClips();
      setPair(pickPair(updated));
      setWinnerId(null);
      setRound((r) => r + 1);
    }, 700);
  };

  if (loading) {
    return <p className="text-white/50 text-center">Carregando os clipes...</p>;
  }

  if (!pair) {
    return (
      <div className="text-center text-white/60 max-w-sm mx-auto">
        <p className="font-semibold text-white">Precisa de pelo menos 2 clipes pra batalhar.</p>
        <p className="text-sm mt-1">Grava mais alguns na aba "Farmar" primeiro.</p>
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
        />
        <Contestant
          clip={b}
          side="bottom"
          result={winnerId ? (winnerId === b.id ? "winner" : "loser") : null}
          onPick={() => vote(b, a)}
        />

        {/* selo VS flutuando na costura entre os dois cards */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 h-14 w-14 rounded-full bg-gradient-to-br from-fuchsia-600 to-cyan-500 grid place-items-center shadow-[0_0_25px_-4px_rgba(232,121,249,0.9)] ring-4 ring-[#0a0a12]">
          <span className="text-white font-black text-sm italic">VS</span>
        </div>
      </div>

      <p className="text-xs text-white/40">Toca no clipe que farmou mais aura</p>
    </div>
  );
}
