import { useEffect, useState } from "react";
import {
  approveClip,
  adminClipVideoUrl,
  deleteClip,
  getAdminToken,
  listAdminClips,
  listUploadLog,
  rejectClip,
  setAdminToken,
  UnauthorizedError,
  type AdminClip,
  type UploadLogEntry,
} from "../lib/adminApi";

const STATUS_BADGE: Record<AdminClip["status"], string> = {
  pending: "text-amber-300 bg-amber-500/10 ring-amber-400/30",
  approved: "text-emerald-300 bg-emerald-500/10 ring-emerald-400/30",
  rejected: "text-rose-300 bg-rose-500/10 ring-rose-400/30",
};

function TokenGate({ onReady }: { onReady: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="max-w-xs mx-auto flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setAdminToken(value.trim());
        onReady();
      }}
    >
      <p className="text-sm text-white/60 text-center">Token de moderação</p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-white/5 ring-1 ring-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-fuchsia-400/60"
        placeholder="ADMIN_TOKEN"
        autoFocus
      />
      <button type="submit" className="bg-fuchsia-600 rounded-lg py-2 text-sm font-bold text-white">
        Entrar
      </button>
    </form>
  );
}

export function AdminView() {
  const [ready, setReady] = useState(!!getAdminToken());
  const [clips, setClips] = useState<AdminClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadLog, setUploadLog] = useState<UploadLogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listAdminClips(), listUploadLog()])
      .then(([clipsRes, logRes]) => {
        setClips(clipsRes);
        setUploadLog(logRes);
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          setReady(false);
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (ready) load();
    // load() não é memoizada -- incluir como dep recriaria o efeito (e
    // buscaria de novo) a cada render, não só quando `ready` muda.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return <TokenGate onReady={() => setReady(true)} />;

  const act = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusyId(id);
    try {
      await fn(id);
      setClips((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na ação");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
          Moderação · {clips.filter((c) => c.status === "pending").length} pendente(s)
        </p>
        <button type="button" onClick={load} className="text-xs text-white/40 hover:text-white">
          atualizar
        </button>
      </div>

      <div className="bg-white/5 rounded-xl ring-1 ring-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setLogOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-white/40 uppercase tracking-widest"
        >
          <span>Log de envios ({uploadLog.length})</span>
          <span>{logOpen ? "▲" : "▼"}</span>
        </button>
        {logOpen && (
          <ul className="px-3 pb-3 flex flex-col gap-1.5 max-h-48 overflow-y-auto text-xs">
            {uploadLog.length === 0 && <li className="text-white/40">Nenhum envio ainda.</li>}
            {uploadLog.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 text-white/60">
                <span className="truncate">
                  {entry.label} <span className="text-white/30">· {entry.deviceId.slice(0, 8)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-white/40">
                  {new Date(entry.createdAt).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-rose-300 text-sm">{error}</p>}
      {loading && <p className="text-white/50 text-sm">Carregando...</p>}
      {!loading && clips.length === 0 && <p className="text-white/50 text-sm">Nada pra revisar.</p>}

      {clips.map((clip) => (
        <div key={clip.id} className="bg-white/5 rounded-2xl ring-1 ring-white/10 overflow-hidden">
          <video
            src={adminClipVideoUrl(clip.id)}
            controls
            loop
            playsInline
            className="w-full aspect-video bg-black"
          />
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white truncate">{clip.label}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ring-1 shrink-0 ${STATUS_BADGE[clip.status]}`}>
                {clip.status}
              </span>
            </div>
            <p className="text-xs text-white/40 tabular-nums">
              {clip.wins}V · {clip.losses}D · {clip.reportCount} denúncia(s) ·{" "}
              {new Date(clip.createdAt).toLocaleString("pt-BR")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === clip.id}
                onClick={() => act(clip.id, approveClip)}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-sm font-bold text-white disabled:opacity-40"
              >
                aprovar
              </button>
              <button
                type="button"
                disabled={busyId === clip.id}
                onClick={() => act(clip.id, rejectClip)}
                className="flex-1 py-2 rounded-lg bg-rose-600 text-sm font-bold text-white disabled:opacity-40"
              >
                rejeitar
              </button>
              <button
                type="button"
                disabled={busyId === clip.id}
                onClick={() => {
                  if (window.confirm("Excluir esse clipe permanentemente?")) act(clip.id, deleteClip);
                }}
                className="flex-1 py-2 rounded-lg bg-white/10 text-sm font-bold text-white/70 disabled:opacity-40"
              >
                excluir
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
