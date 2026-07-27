import { getDeviceId } from "./deviceId";

export type ClipStatus = "pending" | "approved" | "rejected";

export interface MyClip {
  id: string;
  label: string;
  status: ClipStatus;
  wins: number;
  losses: number;
  createdAt: string;
}

export interface BattleContestant {
  id: string;
  label: string;
  auraLevel: string | null; // null = ainda sem voto ("??" na tela)
}

export interface LeaderboardEntry {
  id: string;
  label: string;
  wins: number;
  losses: number;
  score: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "X-Device-Id": getDeviceId(), ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function uploadClip(blob: Blob, label: string): Promise<MyClip> {
  const form = new FormData();
  form.append("video", blob, "clip.webm");
  form.append("label", label);
  return api<MyClip>("/clips", { method: "POST", body: form });
}

export async function listMyClips(): Promise<MyClip[]> {
  return api<MyClip[]>("/clips/mine");
}

export async function getBattlePair(forceId?: string): Promise<BattleContestant[] | null> {
  const qs = forceId ? `?forceId=${encodeURIComponent(forceId)}` : "";
  const { pair } = await api<{ pair: BattleContestant[] | null }>(`/clips/battle${qs}`);
  return pair;
}

export async function castVote(winnerId: string, loserId: string): Promise<void> {
  await api<void>("/votes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ winnerId, loserId }),
  });
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return api<LeaderboardEntry[]>("/clips/leaderboard");
}

export async function reportClip(id: string): Promise<void> {
  await api<void>(`/clips/${id}/report`, { method: "POST" });
}

export async function deleteClip(id: string): Promise<void> {
  await api<void>(`/clips/${id}`, { method: "DELETE" });
}

export function clipVideoUrl(id: string): string {
  return `/api/clips/${id}/video`;
}
