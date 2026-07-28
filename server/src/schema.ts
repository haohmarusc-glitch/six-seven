import { pgTable, text, timestamp, integer, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";

export const clipStatus = pgEnum("clip_status", ["pending", "approved", "rejected"]);

export const clipsTable = pgTable("clips", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: text("device_id").notNull(),
  label: text("label").notNull(),
  // Chave do arquivo de vídeo no storage (Replit Object Storage em produção,
  // disco local em dev -- ver storage.ts). Nunca exposta direto ao cliente;
  // o vídeo sempre é servido através de /api/clips/:id/video, que checa
  // status antes de liberar os bytes.
  videoKey: text("video_key").notNull(),
  contentType: text("content_type").notNull(),
  status: clipStatus("status").notNull().default("pending"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  reportCount: integer("report_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const votesTable = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  winnerId: uuid("winner_id").notNull().references(() => clipsTable.id, { onDelete: "cascade" }),
  loserId: uuid("loser_id").notNull().references(() => clipsTable.id, { onDelete: "cascade" }),
  voterDeviceId: text("voter_device_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportsTable = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clipId: uuid("clip_id").notNull().references(() => clipsTable.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Um dispositivo só conta uma vez por clipe -- sem isso, um único
    // dispositivo malicioso poderia sozinho acumular denúncias suficientes
    // pra derrubar qualquer clipe aprovado de volta pra revisão.
    uniqueIndex("reports_clip_device_unique").on(table.clipId, table.deviceId),
  ],
);

export const commentsTable = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clipId: uuid("clip_id").notNull().references(() => clipsTable.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  nickname: text("nickname").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
