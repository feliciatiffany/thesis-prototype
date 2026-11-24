import { useEffect, useState } from "react";

/**
 * Files a person adds are kept in the browser (IndexedDB), so an image or
 * video is still on the board after a refresh. A frame stores "file:<id>".
 */

const urls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("doubt-canvas", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFile(file: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  urls.set(id, URL.createObjectURL(file));
  return `file:${id}`;
}

/** Turn a frame's `src` into something an <img> or <video> can load. */
export function useSrc(src: string): string {
  const fileId = src.startsWith("file:") ? src.slice(5) : "";
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!fileId || urls.has(fileId)) return;
    let live = true;
    openDb().then((db) => {
      const request = db.transaction("files").objectStore("files").get(fileId);
      request.onsuccess = () => {
        if (!live || !(request.result instanceof Blob)) return;
        const url = URL.createObjectURL(request.result);
        urls.set(fileId, url);
        setLoaded({ id: fileId, url });
      };
    });
    return () => {
      live = false;
    };
  }, [fileId]);

  if (!fileId) return src;
  return urls.get(fileId) ?? (loaded?.id === fileId ? loaded.url : "");
}
