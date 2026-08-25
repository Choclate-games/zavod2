/**
 * Чтение файла из `public/` одинаково в браузере и в головной проверке.
 *
 * `scripts/*-check.ts` гоняют демо без DOM и без WebGL (`CRITICAL_RULES` §66),
 * но модель и клипы им нужны настоящие: подсунь заглушку — и проверка начнёт
 * мерить риг, которого в игре нет.
 */
export async function readAsset(url: string): Promise<ArrayBuffer> {
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.arrayBuffer();
  }
  // Спецификатор собирается из кусков: иначе Vite потащит node:fs в
  // браузерный бандл и сборка упадёт на разрешении импорта.
  const fs = await import(/* @vite-ignore */ `${'node:fs'}/promises`);
  const buf = await fs.readFile(new URL(`../../public/${url}`, import.meta.url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
