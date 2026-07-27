// Taxa de vitória com o "prior" de Wilson (mesma ideia do ranking de
// comentário do Reddit) -- sem isso, um clipe com 1 vitória e 0 derrotas
// (100%) ficaria acima de um com 40 vitórias e 5 derrotas (89%), o que não
// faz sentido pra ranquear com pouca amostra.
export function auraScore(clip: { wins: number; losses: number }): number {
  const n = clip.wins + clip.losses;
  if (n === 0) return 0;
  const p = clip.wins / n;
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return (center - margin) / denom;
}
