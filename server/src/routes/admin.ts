import { Router } from "express";
import { eq, ne, sql } from "drizzle-orm";
import { db } from "../db.js";
import { clipsTable } from "../schema.js";
import { videoStorage } from "../storage.js";
import { requireAdmin, getIdParam } from "../middleware.js";

const router = Router();

// Log de envios -- todo clipe já enviado, mais recente primeiro, independente
// de status (a lista de moderação acima já esconde rejeitado). É só
// histórico/observabilidade pro admin, não faz parte do fluxo de revisão.
const UPLOAD_LOG_LIMIT = 30;

router.get("/admin/uploads", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: clipsTable.id,
      label: clipsTable.label,
      deviceId: clipsTable.deviceId,
      status: clipsTable.status,
      createdAt: clipsTable.createdAt,
    })
    .from(clipsTable)
    .orderBy(sql`${clipsTable.createdAt} desc`)
    .limit(UPLOAD_LOG_LIMIT);
  res.json(rows);
});

router.get("/admin/clips", requireAdmin, async (_req, res) => {
  // Pendente primeiro (é o que precisa de ação), depois o resto pra dar
  // contexto/histórico -- ordenado do mais antigo pro mais novo dentro de
  // cada status, pra revisar em ordem de chegada.
  const rows = await db
    .select()
    .from(clipsTable)
    .where(ne(clipsTable.status, "rejected"))
    .orderBy(sql`case when ${clipsTable.status} = 'pending' then 0 else 1 end, ${clipsTable.createdAt} asc`);
  res.json(rows);
});

// Vídeo pra revisão -- sem a checagem de "approved" da rota pública, senão
// nunca daria pra ver o que tá pendente.
router.get("/admin/clips/:id/video", requireAdmin, async (req, res) => {
  const id = getIdParam(req, res);
  if (!id) return;
  const [clip] = await db.select().from(clipsTable).where(eq(clipsTable.id, id));
  if (!clip) {
    res.status(404).end();
    return;
  }
  const buffer = await videoStorage.read(clip.videoKey);
  res.setHeader("Content-Type", clip.contentType);
  res.send(buffer);
});

router.post("/admin/clips/:id/approve", requireAdmin, async (req, res) => {
  const id = getIdParam(req, res);
  if (!id) return;
  const [clip] = await db
    .update(clipsTable)
    .set({ status: "approved", reportCount: 0 })
    .where(eq(clipsTable.id, id))
    .returning({ id: clipsTable.id });
  if (!clip) {
    res.status(404).end();
    return;
  }
  res.status(204).end();
});

router.post("/admin/clips/:id/reject", requireAdmin, async (req, res) => {
  const id = getIdParam(req, res);
  if (!id) return;
  const [clip] = await db.select().from(clipsTable).where(eq(clipsTable.id, id));
  if (!clip) {
    res.status(404).end();
    return;
  }
  await db.update(clipsTable).set({ status: "rejected" }).where(eq(clipsTable.id, clip.id));
  // Rejeitado não precisa manter o vídeo ocupando espaço.
  await videoStorage.remove(clip.videoKey);
  res.status(204).end();
});

router.delete("/admin/clips/:id", requireAdmin, async (req, res) => {
  const id = getIdParam(req, res);
  if (!id) return;
  const [clip] = await db
    .delete(clipsTable)
    .where(eq(clipsTable.id, id))
    .returning({ videoKey: clipsTable.videoKey });
  if (!clip) {
    res.status(404).end();
    return;
  }
  await videoStorage.remove(clip.videoKey);
  res.status(204).end();
});

export default router;
