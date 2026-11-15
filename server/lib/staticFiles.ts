import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/** The file under root for a URL path, or null if it is outside root or missing. Folders serve their index.html. */
export async function findFile(root: string, urlPath: string): Promise<string | null> {
  let path: string;
  try {
    path = resolve(root, '.' + decodeURIComponent(urlPath));
  } catch {
    return null; // malformed %-escape
  }
  if (path !== root && !path.startsWith(root + sep)) return null; // ../ tricks
  const info = await stat(path).catch(() => null);
  if (info?.isDirectory()) return findFile(root, urlPath.replace(/\/?$/, '/index.html'));
  return info?.isFile() ? path : null;
}
