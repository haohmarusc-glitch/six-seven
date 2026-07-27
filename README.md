# six seven

Grave um clipe de câmera farmando aura, deixe outra pessoa (ou você mesmo,
por enquanto) votar em qual clipe manda mais, veja o ranking.

## Status: protótipo local (Fase 1)

Esta é a base do jogo em modo **single-device**: os clipes ficam só no
IndexedDB do navegador, nada é enviado pra um servidor. O objetivo aqui é
validar se o loop **gravar → votar → ranking** é divertido antes de investir
em backend, hospedagem de vídeo e moderação — que só fazem sentido se o
loop já provar que funciona.

Próxima fase (multiplayer de verdade, clipes de gente diferente, votação
cross-device) depende de decisões de infra ainda não tomadas: onde hospedar
vídeo, backend de votos, moderação de conteúdo (importante — público é
majoritariamente adolescente).

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173` (ou a porta da env var `PORT`, se setada —
compatível com o padrão do Replit). **Precisa de HTTPS ou localhost** pra
`getUserMedia` (acesso à câmera) funcionar — em produção isso já vem
resolvido pelo Replit.

## Como funciona

- `src/hooks/useCamera.ts` — acesso à câmera + gravação via `MediaRecorder`
  (clipe de até 8s, ver `MAX_CLIP_MS`)
- `src/lib/db.ts` — clipes salvos no IndexedDB (`idb`); ranking calculado
  via Wilson score (mesma lógica do ranking de comentário do Reddit — evita
  que 1 vitória em 1 voto fique acima de 40 vitórias em 45)
- `src/components/RecordView.tsx` / `VoteView.tsx` / `LeaderboardView.tsx`
  — as três telas do app, navegadas por abas em `App.tsx`
