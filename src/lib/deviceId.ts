const KEY = "six-seven:device-id";

// Identidade anônima por dispositivo -- gerada uma vez, guardada no
// localStorage, mandada em todo request pro backend (header X-Device-Id).
// Não é conta de verdade: limpar o storage gera uma identidade nova. É só
// o suficiente pra impedir votar na própria batalha nesta fase.
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
