function removeKeysWithPrefix(storage: Storage, prefix: string): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  for (const k of keys) storage.removeItem(k);
}

/** Remove chaves `dbx.*` do localStorage e sessionStorage (perfil, pedidos, inventário, rascunhos, etc.). */
export function clearDemoBrowserState(): void {
  if (typeof window === "undefined") return;
  removeKeysWithPrefix(localStorage, "dbx.");
  removeKeysWithPrefix(sessionStorage, "dbx.");
}
