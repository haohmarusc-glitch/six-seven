const KEY = "six-seven:nickname";

// Igual ao device-id: salvo uma vez no localStorage e reusado, mas editável
// -- só serve pra assinar comentários, não é conta de verdade.
export function getNickname(): string | null {
  return localStorage.getItem(KEY);
}

export function setNickname(nickname: string): void {
  localStorage.setItem(KEY, nickname);
}
