import { Router } from "express";
import multer from "multer";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../db.js";
import { clipsTable, votesTable, reportsTable } from "../schema.js";
import { videoStorage } from "../storage.js";
import { requireDeviceId, getIdParam } from "../middleware.js";
import { auraScore } from "../aura.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // clipe é curto (até 8s no cliente), 25MB é folga generosa
});

// Reaprovar um clipe que já passou da moderação, mas acumulou denúncia
// depois -- puxa de volta pra fila de revisão em vez de derrubar na hora
// (evita que uma denúncia isolada mal-intencionada já apague o clipe).
const REPORT_THRESHOLD = 3;

router.post("/clips", requireDeviceId, upload.single("video"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Arquivo de vídeo ausente" });
    return;
  }
  const label = typeof req.body?.label === "string" && req.body.label.trim() ? req.body.label.trim().slice(0, 60) : "Farmando aura";

  const [clip] = await db
    .insert(clipsTable)
    .values({
      deviceId: req.deviceId,
      label,
      videoKey: crypto.randomUUID(),
      contentType: req.file.mimetype || "video/webm",
      status: "pending",
    })
    .returning();

  await videoStorage.save(clip.videoKey, req.file.buffer);

  res.status(201).json({ id: clip.id, status: clip.status });
});

// Meus clipes -- pra RecordView mostrar se o que a pessoa gravou já foi
// aprovado, ainda tá pendente, ou foi rejeitado.
router.get("/clips/mine", requireDeviceId, async (req, res) => {
  const rows = await db
    .select({
      id: clipsTable.id,
      label: clipsTable.label,
      status: clipsTable.status,
      wins: clipsTable.wins,
      losses: clipsTable.losses,
      createdAt: clipsTable.createdAt,
    })
    .from(clipsTable)
    .where(eq(clipsTable.deviceId, req.deviceId))
    .orderBy(sql`${clipsTable.createdAt} desc`);
  res.json(rows);
});

// Serve os bytes do vídeo -- só libera se o clipe está aprovado (rota de
// admin tem a própria versão sem essa checagem, pra revisar pendente).
router.get("/clips/:id/video", async (req, res) => {
  const id = getIdParam(req, res);
  if (!id) return;
  const [clip] = await db.select().from(clipsTable).where(eq(clipsTable.id, id));
  if (!clip || clip.status !== "approved") {
    res.status(404).end();
    return;
  }
  const buffer = await videoStorage.read(clip.videoKey);
  res.setHeader("Content-Type", clip.contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(buffer);
});

async function pickBattlePair(excludeDeviceId: string, forceId?: string) {
  // Só clipes aprovados e de OUTRO dispositivo entram no sorteio -- evita
  // que alguém vote na própria batalha pra se autopromover.
  const pool = await db
    .select({ id: clipsTable.id, label: clipsTable.label, wins: clipsTable.wins, losses: clipsTable.losses })
    .from(clipsTable)
    .where(and(eq(clipsTable.status, "approved"), ne(clipsTable.deviceId, excludeDeviceId)));

  if (forceId) {
    const forced = pool.find((c) => c.id === forceId);
    const rest = pool.filter((c) => c.id !== forceId);
    if (forced && rest.length > 0) {
      return [forced, rest[Math.floor(Math.random() * rest.length)]];
    }
  }

  if (pool.length < 2) return null;
  const a = Math.floor(Math.random() * pool.length);
  let b = Math.floor(Math.random() * pool.length);
  while (b === a) b = Math.floor(Math.random() * pool.length);
  return [pool[a], pool[b]];
}

router.get("/clips/battle", requireDeviceId, async (req, res) => {
  const forceId = typeof req.query.forceId === "string" ? req.query.forceId : undefined;
  const pair = await pickBattlePair(req.deviceId, forceId);
  if (!pair) {
    res.json({ pair: null });
    return;
  }
  res.json({
    pair: pair.map((c) => ({ id: c.id, label: c.label, auraLevel: auraLevelOf(c) })),
  });
});

function auraLevelOf(clip: { wins: number; losses: number }): string | null {
  const n = clip.wins + clip.losses;
  if (n === 0) return null;
  return String(Math.round(auraScore(clip) * 99)).padStart(2, "0");
}

router.post("/votes", requireDeviceId, async (req, res) => {
  const { winnerId, loserId } = req.body ?? {};
  if (typeof winnerId !== "string" || typeof loserId !== "string" || winnerId === loserId) {
    res.status(400).json({ error: "winnerId/loserId inválidos" });
    return;
  }

  const rows = await db
    .select({ id: clipsTable.id, deviceId: clipsTable.deviceId, status: clipsTable.status })
    .from(clipsTable)
    .where(sql`${clipsTable.id} in (${winnerId}, ${loserId})`);

  if (rows.length !== 2 || rows.some((c) => c.status !== "approved" || c.deviceId === req.deviceId)) {
    res.status(400).json({ error: "Voto inválido (clipe não aprovado ou é seu)" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(votesTable).values({ winnerId, loserId, voterDeviceId: req.deviceId });
    await tx.update(clipsTable).set({ wins: sql`${clipsTable.wins} + 1` }).where(eq(clipsTable.id, winnerId));
    await tx.update(clipsTable).set({ losses: sql`${clipsTable.losses} + 1` }).where(eq(clipsTable.id, loserId));
  });

  res.status(204).end();
});

router.get("/clips/leaderboard", async (_req, res) => {
  const rows = await db
    .select({ id: clipsTable.id, label: clipsTable.label, wins: clipsTable.wins, losses: clipsTable.losses })
    .from(clipsTable)
    .where(eq(clipsTable.status, "approved"));

  const ranked = rows
    .map((c) => ({ ...c, score: auraScore(c) }))
    .sort((a, b) => b.score - a.score);

  res.json(ranked);
});

router.post("/clips/:id/report", requireDeviceId, async (req, res) => {
  const id = getIdParam(req, res);
  if (!id) return;
  const [clip] = await db.select().from(clipsTable).where(eq(clipsTable.id, id));
  if (!clip) {
    res.status(404).end();
    return;
  }

  // onConflictDoNothing por causa da unique (clipId, deviceId) -- mesmo
  // dispositivo denunciando o mesmo clipe de novo não conta segunda vez.
  const inserted = await db
    .insert(reportsTable)
    .values({ clipId: clip.id, deviceId: req.deviceId })
    .onConflictDoNothing()
    .returning({ id: reportsTable.id });

  if (inserted.length === 0) {
    res.status(204).end();
    return;
  }

  const [updated] = await db
    .update(clipsTable)
    .set({ reportCount: sql`${clipsTable.reportCount} + 1` })
    .where(eq(clipsTable.id, clip.id))
    .returning({ reportCount: clipsTable.reportCount, status: clipsTable.status });

  // Denúncia acumulada demais num clipe já aprovado -- puxa de volta pra
  // fila de revisão em vez de manter público até alguém checar o painel.
  if (updated.status === "approved" && updated.reportCount >= REPORT_THRESHOLD) {
    await db.update(clipsTable).set({ status: "pending" }).where(eq(clipsTable.id, clip.id));
  }

  res.status(204).end();
});

export default router;
