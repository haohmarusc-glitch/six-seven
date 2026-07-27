# six seven

Grave um clipe de câmera farmando aura. A comunidade vota em qual clipe
manda mais. Veja o ranking.

## Status: Fase 2 (multiplayer)

Clipes de dispositivos diferentes, votação entre desconhecidos, backend
real. Todo clipe passa por **moderação manual** antes de ficar público
(painel em `/admin`) — decisão deliberada considerando que o público é
majoritariamente adolescente.

- **Backend:** Node/Express + PostgreSQL (Drizzle ORM), em `server/`
- **Vídeo:** Replit Object Storage em produção; disco local em dev (ver
  `server/src/storage.ts` — a escolha é automática via a env var `REPL_ID`)
- **Identidade:** anônima por dispositivo (UUID no localStorage, sem
  cadastro) — suficiente pra impedir votar na própria batalha nesta fase
- **Segurança de conteúdo:** clipe só aparece pra outros depois de aprovado
  em `/admin`; um clipe já aprovado que acumular 3 denúncias de
  dispositivos diferentes volta sozinho pra revisão

## Configurando no Replit (primeira vez)

1. **Banco de dados** — aba Database do Replit, cria um Postgres (isso seta
   a secret `DATABASE_URL` sozinho)
2. **Token de moderação** — aba Secrets, adiciona `ADMIN_TOKEN` com um
   valor forte qualquer (é a senha do painel `/admin`)
3. **Object Storage** — aba Tools → Object Storage, cria o bucket padrão
   (sem isso, upload de clipe falha em produção)
4. **Aplica o schema no banco** (uma vez, e de novo sempre que
   `server/src/schema.ts` mudar):
   ```bash
   npm run db:push
   ```
5. Aperta **Run**

## Rodando localmente (fora do Replit)

Precisa de um Postgres local rodando e as env vars `DATABASE_URL` e
`ADMIN_TOKEN` setadas (sem `REPL_ID`, o vídeo cai automaticamente pro disco
local em `server/uploads/`, não precisa de Object Storage pra testar).

```bash
npm install                # instala raiz + server/ (é um npm workspace)
npm run db:push            # cria as tabelas
npm run dev:full            # builda o front + sobe o backend servindo tudo
```

Abre em `http://localhost:5173` (ou a porta de `PORT`, se setada). **Precisa
de HTTPS ou localhost** pra `getUserMedia` (acesso à câmera) funcionar — no
Replit isso já vem resolvido.

Editou o frontend? `npm run build` na raiz gera um novo `dist/`, que o
backend já serve na próxima requisição — não precisa reiniciar o `tsx watch`.

## Como funciona

- `src/hooks/useCamera.ts` — acesso à câmera + gravação via `MediaRecorder`
  (clipe de até 8s, ver `MAX_CLIP_MS`)
- `src/lib/api.ts` / `adminApi.ts` / `deviceId.ts` — cliente HTTP do
  frontend pro backend
- `src/components/RecordView.tsx` / `VoteView.tsx` / `LeaderboardView.tsx`
  / `AdminView.tsx` — as telas do app (as três primeiras navegadas por aba
  em `App.tsx`; `AdminView` só em `/admin`, fora da navegação normal)
- `server/src/schema.ts` — `clips` (com `status`: pending/approved/rejected),
  `votes`, `reports`
- `server/src/routes/clips.ts` — upload, sorteio de batalha (nunca contra o
  próprio dispositivo), voto, ranking (Wilson score — mesma lógica do
  ranking de comentário do Reddit, evita que 1 vitória em 1 voto fique
  acima de 40 vitórias em 45), denúncia
- `server/src/routes/admin.ts` — fila de revisão, aprovar/rejeitar
  (protegido por `ADMIN_TOKEN`, ver `middleware.ts`)
- `server/src/storage.ts` — abstração de storage de vídeo (Replit Object
  Storage ↔ disco local)
