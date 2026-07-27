import { useEffect, useState } from "react";
import { useCamera, MAX_CLIP_MS } from "../hooks/useCamera";
import { uploadClip, listMyClips, type MyClip } from "../lib/api";

const AURA_LABELS = [
  "Farmando aura",
  "Aura máxima",
  "Zero aura",
  "Aura sombria",
  "Aura secreta",
];

const STATUS_LABEL: Record<MyClip["status"], { text: string; className: string }> = {
  pending: { text: "em revisão", className: "text-amber-300 bg-amber-500/10 ring-amber-400/30" },
  approved: { text: "aprovado", className: "text-emerald-300 bg-emerald-500/10 ring-emerald-400/30" },
  rejected: { text: "rejeitado", className: "text-rose-300 bg-rose-500/10 ring-rose-400/30" },
};

export function RecordView({ onSaved }: { onSaved: () => void }) {
  const { videoRef, status, isRecording, elapsedMs, start, record } = useCamera();
  const [uploading, setUploading] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [mine, setMine] = useState<MyClip[]>([]);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    listMyClips().then(setMine).catch(() => {});
  }, []);

  const handleRecord = async () => {
    const blob = await record();
    setUploading(true);
    try {
      const label = AURA_LABELS[Math.floor(Math.random() * AURA_LABELS.length)];
      await uploadClip(blob, label);
      setSavedPulse(true);
      setTimeout(() => setSavedPulse(false), 1400);
      onSaved();
      listMyClips().then(setMine).catch(() => {});
    } finally {
      setUploading(false);
    }
  };

  const secondsLeft = Math.max(0, Math.ceil((MAX_CLIP_MS - elapsedMs) / 1000));
  const busy = isRecording || uploading;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-black ring-1 ring-white/10 shadow-[0_0_60px_-15px_rgba(168,85,247,0.6)]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />
        {status === "requesting" && (
          <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">
            Pedindo acesso à câmera...
          </div>
        )}
        {status === "denied" && (
          <div className="absolute inset-0 grid place-items-center text-center text-white/70 text-sm p-6">
            Sem acesso à câmera. Libera a permissão nas configurações do navegador
            pra farmar aura.
          </div>
        )}
        {status === "unsupported" && (
          <div className="absolute inset-0 grid place-items-center text-center text-white/70 text-sm p-6">
            Esse navegador não suporta câmera. Tenta pelo Chrome ou Safari
            atualizado.
          </div>
        )}
        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-semibold text-white tabular-nums">
              {secondsLeft}s
            </span>
          </div>
        )}
        {uploading && !savedPulse && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 backdrop-blur-sm">
            <span className="text-sm font-semibold text-white/80">enviando...</span>
          </div>
        )}
        {savedPulse && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 backdrop-blur-sm text-center px-6">
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-300">
              enviado pra revisão ✦
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleRecord}
        disabled={status !== "ready" || busy}
        className="w-full max-w-sm py-4 rounded-2xl font-bold text-lg text-white bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 shadow-[0_0_40px_-8px_rgba(168,85,247,0.8)] disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition"
      >
        {isRecording ? "Farmando..." : uploading ? "Enviando..." : "Farmar aura"}
      </button>
      <p className="text-xs text-white/40 text-center max-w-sm">
        Clipe de até {MAX_CLIP_MS / 1000}s. Antes de entrar em batalha, passa por
        revisão rápida.
      </p>

      {mine.length > 0 && (
        <div className="w-full max-w-sm flex flex-col gap-1.5 mt-2">
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
            Meus clipes
          </p>
          {mine.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2 ring-1 ring-white/10">
              <span className="text-sm text-white/80 truncate">{c.label}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ring-1 shrink-0 ${STATUS_LABEL[c.status].className}`}>
                {STATUS_LABEL[c.status].text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
