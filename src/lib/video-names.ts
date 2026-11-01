export function storageVideoName(name: string) {
  if (/^[\x00-\x7f]*$/.test(name) && !name.startsWith('utf8-')) return name;
  const base = name.replace(/\.mp4$/i, '');
  const hex = Array.from(new TextEncoder().encode(base), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `utf8-${hex}.mp4`;
}
export function displayVideoName(name: string) {
  const match = /^utf8-((?:[a-f0-9]{2})+)\.mp4$/i.exec(name);
  if (!match) return name;
  try {
    const bytes = Uint8Array.from(match[1].match(/.{2}/g) ?? [], (pair) => parseInt(pair, 16));
    return `${new TextDecoder('utf-8', { fatal: true }).decode(bytes)}.mp4`;
  } catch { return name; }
}