const TOKEN_KEY = "six-seven:admin-token";

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface AdminClip {
  id: string;
  label: string;
  status: "pending" | "approved" | "rejected";
  wins: number;
  losses: number;
  reportCount: number;
  createdAt: string;
}

class UnauthorizedError extends Error {}

async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "X-Admin-Token": token ?? "", ...init?.headers },
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new UnauthorizedError("Token de admin inválido");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export { UnauthorizedError };

export async function listAdminClips(): Promise<AdminClip[]> {
  return adminApi<AdminClip[]>("/admin/clips");
}

export async function approveClip(id: string): Promise<void> {
  await adminApi<void>(`/admin/clips/${id}/approve`, { method: "POST" });
}

export async function rejectClip(id: string): Promise<void> {
  await adminApi<void>(`/admin/clips/${id}/reject`, { method: "POST" });
}

export async function deleteClip(id: string): Promise<void> {
  await adminApi<void>(`/admin/clips/${id}`, { method: "DELETE" });
}

export interface UploadLogEntry {
  id: string;
  label: string;
  deviceId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export async function listUploadLog(): Promise<UploadLogEntry[]> {
  return adminApi<UploadLogEntry[]>("/admin/uploads");
}

export function adminClipVideoUrl(id: string): string {
  const token = getAdminToken();
  return `/api/admin/clips/${id}/video?token=${encodeURIComponent(token ?? "")}`;
}
