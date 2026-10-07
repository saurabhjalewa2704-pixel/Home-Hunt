/** Turn a stored image reference into something an <img> can load. */
export function imageSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("storage:")) return `/api/image?path=${encodeURIComponent(path.slice("storage:".length))}`;
  if (path.startsWith("photos:")) return `/api/image?path=${encodeURIComponent("photos/" + path.slice("photos:".length))}`;
  return path;
}
