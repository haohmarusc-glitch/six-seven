import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPathImport from "ffmpeg-static";

// O .d.ts do ffmpeg-static declara um default export tipado, mas sob
// NodeNext + esModuleInterop o binding importado às vezes resolve pro
// namespace do módulo em vez do valor -- reatribuir com o tipo explícito
// força o valor certo (a string do caminho binário) na checagem de tipos.
const ffmpegBinary: string | null = ffmpegPathImport as unknown as string | null;

// Sem ANTHROPIC_API_KEY configurada, o client fica null e todo clipe cai
// pra revisão manual -- nunca auto-aprova sem checagem (ver screenClip).
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

async function extractFrame(videoBuffer: Buffer): Promise<Buffer> {
  if (!ffmpegBinary) throw new Error("Binário do ffmpeg-static não encontrado");
  const inPath = path.join(os.tmpdir(), `${randomUUID()}.webm`);
  const outPath = path.join(os.tmpdir(), `${randomUUID()}.jpg`);
  await writeFile(inPath, videoBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegBinary, ["-y", "-i", inPath, "-frames:v", "1", "-update", "1", "-q:v", "3", outPath]);
      proc.on("error", reject);
      proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}`))));
    });
    return await readFile(outPath);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

// Pré-triagem por IA: pega o primeiro frame do clipe e pede pra Claude
// classificar como CLEAN ou REVIEW. CLEAN auto-aprova; qualquer outra coisa
// (REVIEW, resposta inesperada, ou falha na extração do frame / chamada da
// API) cai pra fila de revisão manual do /admin -- nunca auto-aprova no
// escuro. É um filtro rápido e barato (Haiku), não um substituto total pra
// moderação humana.
export async function screenClip(videoBuffer: Buffer): Promise<"approved" | "pending"> {
  if (!client) return "pending";

  try {
    const frame = await extractFrame(videoBuffer);
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 16,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame.toString("base64") } },
            {
              type: "text",
              text:
                'Este é um frame de um vídeo enviado por um usuário para um app de vídeos curtos de gestos/poses ("aura farming"). ' +
                "Responda APENAS com uma palavra: CLEAN se a imagem for apropriada (sem nudez, violência explícita, conteúdo ilegal, " +
                "símbolos de ódio, ou quadro em branco/corrompido), ou REVIEW se houver qualquer dúvida.",
            },
          ],
        },
      ],
    });
    const text = response.content.find((block) => block.type === "text")?.text?.trim().toUpperCase() ?? "";
    return text.startsWith("CLEAN") ? "approved" : "pending";
  } catch {
    return "pending";
  }
}
