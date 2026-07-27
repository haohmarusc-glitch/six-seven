import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Protótipo local, single-device: os clipes ficam só no navegador do
// jogador (IndexedDB), sem upload nenhum. É o que permite validar o loop
// "gravar -> votar -> ranking" sem precisar de backend/hospedagem de vídeo
// já de cara -- ver conversa sobre as duas fases do projeto.
export interface Clip {
  id: string;
  label: string;
  blob: Blob;
  createdAt: number;
  wins: number;
  losses: number;
}

interface AuraDB extends DBSchema {
  clips: {
    key: string;
    value: Clip;
  };
}

let dbPromise: Promise<IDBPDatabase<AuraDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AuraDB>("six-seven", 1, {
      upgrade(db) {
        db.createObjectStore("clips", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function saveClip(blob: Blob, label: string): Promise<Clip> {
  const clip: Clip = {
    id: crypto.randomUUID(),
    label,
    blob,
    createdAt: Date.now(),
    wins: 0,
    losses: 0,
  };
  const db = await getDB();
  await db.put("clips", clip);
  return clip;
}

export async function listClips(): Promise<Clip[]> {
  const db = await getDB();
  return db.getAll("clips");
}

export async function deleteClip(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("clips", id);
}

export async function recordVote(winnerId: string, loserId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("clips", "readwrite");
  const [winner, loser] = await Promise.all([
    tx.store.get(winnerId),
    tx.store.get(loserId),
  ]);
  if (winner) await tx.store.put({ ...winner, wins: winner.wins + 1 });
  if (loser) await tx.store.put({ ...loser, losses: loser.losses + 1 });
  await tx.done;
}

// Taxa de vitória com o "prior" de Wilson (mesma ideia do ranking de
// comentário do Reddit) -- sem isso, um clipe com 1 vitória e 0 derrotas
// (100%) ficaria acima de um com 40 vitórias e 5 derrotas (89%), o que não
// faz sentido pra ranquear com pouca amostra.
export function auraScore(clip: Pick<Clip, "wins" | "losses">): number {
  const n = clip.wins + clip.losses;
  if (n === 0) return 0;
  const p = clip.wins / n;
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return (center - margin) / denom;
}
