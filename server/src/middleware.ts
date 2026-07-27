import type { NextFunction, Request, Response } from "express";

// Identidade anônima por dispositivo -- o cliente gera um UUID e guarda no
// localStorage (ver client/src/lib/deviceId.ts), manda em todo request. Não
// é autenticação de verdade (dá pra falsificar limpando o storage), só o
// suficiente pra impedir votar na própria batalha e saber de quem é cada
// clipe/denúncia nesta fase. Cadastro de verdade é próximo passo natural
// se o app crescer.
declare global {
  namespace Express {
    interface Request {
      deviceId: string;
    }
  }
}

export function requireDeviceId(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.header("x-device-id");
  if (!deviceId || typeof deviceId !== "string" || deviceId.length > 100) {
    res.status(400).json({ error: "Cabeçalho X-Device-Id ausente ou inválido" });
    return;
  }
  req.deviceId = deviceId;
  next();
}

// req.params.id vem tipado como string | string[] no Express 5 (rotas com
// padrão de repetição podem produzir array) -- pras nossas rotas /:id isso
// nunca acontece na prática, mas o drizzle rejeita string[] com um erro de
// overload nada óbvio. Extrai e narrowa num só lugar; responde 400 sozinho
// se vier errado, então quem chama só precisa checar null.
export function getIdParam(req: Request, res: Response): string | null {
  const id = req.params.id;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Parâmetro id inválido" });
    return null;
  }
  return id;
}

// Segredo compartilhado simples pra tela de moderação -- proporcional ao
// estágio do projeto (dono único revisando clipe pendente), não um sistema
// de conta completo. ADMIN_TOKEN precisa estar setado; sem ele, a tela de
// moderação fica inacessível por padrão (fail-closed), não aberta.
//
// Aceita o token no header X-Admin-Token (chamadas via fetch) OU na
// querystring ?token= (a tag <video src> não consegue mandar header
// customizado, então a prévia de vídeo pendente no painel de admin precisa
// desse fallback).
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(503).json({ error: "Moderação não configurada (ADMIN_TOKEN ausente)" });
    return;
  }
  const provided = req.header("x-admin-token") ?? req.query.token;
  if (provided !== expected) {
    res.status(401).json({ error: "Token de admin inválido" });
    return;
  }
  next();
}
