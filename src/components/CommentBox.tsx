import { useEffect, useState } from "react";
import { getComments, postComment, type Comment } from "../lib/api";
import { getNickname, setNickname } from "../lib/nickname";

export function CommentBox({ clipId }: { clipId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNicknameField] = useState(() => getNickname() ?? "");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getComments(clipId)
      .then(setComments)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar comentários"))
      .finally(() => setLoading(false));
  }, [clipId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNickname = nickname.trim();
    const trimmedText = text.trim();
    if (!trimmedNickname || !trimmedText) return;

    setSending(true);
    setError(null);
    try {
      const comment = await postComment(clipId, trimmedNickname, trimmedText);
      setNickname(trimmedNickname); // salva pra reusar da próxima vez, sem pedir de novo
      setComments((prev) => [...prev, comment]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao comentar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      {loading ? (
        <p className="text-white/40 text-xs">Carregando comentários...</p>
      ) : comments.length === 0 ? (
        <p className="text-white/40 text-xs">Nenhum comentário ainda. Seja o primeiro.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="leading-snug">
              <span className="font-bold text-fuchsia-300">{c.nickname}</span>{" "}
              <span className="text-white/70 break-words">{c.body}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-1.5 mt-auto pt-1">
        <input
          value={nickname}
          onChange={(e) => setNicknameField(e.target.value)}
          placeholder="Seu nickname"
          maxLength={24}
          className="bg-white/10 ring-1 ring-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:ring-fuchsia-400/60"
        />
        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um comentário..."
            maxLength={280}
            className="flex-1 min-w-0 bg-white/10 ring-1 ring-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:ring-fuchsia-400/60"
          />
          <button
            type="submit"
            disabled={sending || !nickname.trim() || !text.trim()}
            className="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-xs font-bold text-white disabled:opacity-40 shrink-0"
          >
            enviar
          </button>
        </div>
        {error && <p className="text-rose-300 text-[11px]">{error}</p>}
      </form>
    </div>
  );
}
