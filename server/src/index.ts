import express from "express";
import path from "path";
import clipsRouter from "./routes/clips.js";
import adminRouter from "./routes/admin.js";

const app = express();
app.use(express.json());

app.use("/api", clipsRouter);
app.use("/api", adminRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve o build do frontend (npm run build no diretório raiz gera dist/) --
// mesmo processo/porta serve API e site, sem CORS nem proxy pra configurar
// no deploy.
const clientDist = path.resolve(import.meta.dirname, "..", "..", "dist");
app.use(express.static(clientDist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const port = process.env.PORT ? Number(process.env.PORT) : 5173;
app.listen(port, "0.0.0.0", () => {
  console.log(`six-seven server on :${port}`);
});
