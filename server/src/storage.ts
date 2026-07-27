import { promises as fs } from "fs";
import path from "path";
import { Client as ObjectStorageClient } from "@replit/object-storage";

export interface VideoStorage {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

// Replit injeta REPL_ID em qualquer ambiente Replit (dev ou deployment) --
// só nesse caso o bucket padrão do Object Storage existe de verdade. Fora
// do Replit (dev local, este sandbox), cai pro disco local -- só essa parte
// do storage não dá pra validar fora do Replit; o resto do fluxo (upload,
// aprovação, batalha, voto) já é testado ponta a ponta com esse fallback.
class ReplitStorage implements VideoStorage {
  private client = new ObjectStorageClient();

  async save(key: string, buffer: Buffer): Promise<void> {
    const result = await this.client.uploadFromBytes(key, buffer);
    if (!result.ok) throw new Error(`Falha no upload pro Object Storage: ${result.error.message}`);
  }

  async read(key: string): Promise<Buffer> {
    const result = await this.client.downloadAsBytes(key);
    if (!result.ok) throw new Error(`Falha ao ler do Object Storage: ${result.error.message}`);
    return result.value[0];
  }

  async remove(key: string): Promise<void> {
    const result = await this.client.delete(key, { ignoreNotFound: true });
    if (!result.ok) throw new Error(`Falha ao apagar do Object Storage: ${result.error.message}`);
  }
}

class LocalDiskStorage implements VideoStorage {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private pathFor(key: string) {
    // key vem de crypto.randomUUID() (ver routes/clips.ts) -- nunca contém
    // separador de caminho, mas normaliza mesmo assim antes de tocar o disco.
    return path.join(this.dir, path.basename(key));
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.pathFor(key), buffer);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.pathFor(key), { force: true });
  }
}

export const videoStorage: VideoStorage = process.env.REPL_ID
  ? new ReplitStorage()
  : new LocalDiskStorage(path.resolve(import.meta.dirname, "..", "uploads"));
