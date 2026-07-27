import { useState } from "react";
import { RecordView } from "./components/RecordView";
import { VoteView } from "./components/VoteView";
import { LeaderboardView } from "./components/LeaderboardView";
import { AdminView } from "./components/AdminView";

type Tab = "record" | "vote" | "rank";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "record", label: "Farmar", emoji: "🎥" },
  { key: "vote", label: "Batalha", emoji: "⚔️" },
  { key: "rank", label: "Ranking", emoji: "👑" },
];

// /admin não aparece na navegação normal de propósito -- não é feature do
// jogador, é o painel de moderação (ver conversa: clipe só fica público
// depois de aprovado).
const isAdminRoute = window.location.pathname === "/admin";

function App() {
  const [tab, setTab] = useState<Tab>("record");
  // Sobe toda vez que um clipe novo é salvo/votado, pra Vote/Leaderboard
  // recarregarem do backend sem precisar de um estado global.
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  // Clipe "convocado" a partir do botão batalhar do ranking -- força esse
  // clipe pra próxima batalha, com adversário sorteado.
  const [challengerId, setChallengerId] = useState<string | null>(null);
  const handleChallenge = (clipId: string) => {
    setChallengerId(clipId);
    setTab("vote");
  };

  return (
    <div className="min-h-dvh bg-[#0a0a12] text-white flex flex-col">
      <header className="pt-8 pb-4 px-4 text-center">
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-300 to-cyan-300">
            six seven
          </span>
        </h1>
        <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
          {isAdminRoute ? "painel de moderação" : "quem farma mais aura?"}
        </p>
      </header>

      <main className={`flex-1 px-4 flex items-start justify-center ${isAdminRoute ? "pb-8" : "pb-28"}`}>
        <div className="w-full pt-2">
          {isAdminRoute ? (
            <AdminView />
          ) : (
            <>
              {tab === "record" && <RecordView onSaved={bump} />}
              {tab === "vote" && (
                <VoteView
                  refreshKey={refreshKey}
                  challengerId={challengerId}
                  onChallengerConsumed={() => setChallengerId(null)}
                />
              )}
              {tab === "rank" && (
                <LeaderboardView refreshKey={refreshKey} onChallenge={handleChallenge} />
              )}
            </>
          )}
        </div>
      </main>

      {!isAdminRoute && (
        <nav className="fixed bottom-0 inset-x-0 bg-black/70 backdrop-blur-lg border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="flex max-w-md mx-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3.5 flex flex-col items-center gap-0.5 text-xs font-semibold transition ${
                  tab === t.key ? "text-fuchsia-300" : "text-white/40"
                }`}
              >
                <span className="text-lg leading-none">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
