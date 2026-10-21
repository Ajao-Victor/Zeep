"use client";

import { useEffect, useState } from "react";
import { readThumbUrl, bytesForShare } from "@/lib/chat/blobs";
import { saveBlob } from "@/lib/chat/zip";
import type { FileRef } from "@/lib/chat/types";
import { readSession } from "@/lib/vault/session";

export function FileChip({ file }: { file: FileRef }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const image = file.mime.startsWith("image/");

  useEffect(() => {
    const session = readSession();
    if (!session || !image) return;
    let url = "";
    let stop = false;
    void readThumbUrl(session.network, session.keys.vaultKey, file.id).then((next) => {
      if (stop) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      if (!next) setMissing(true);
      else {
        url = next;
        setThumb(next);
      }
    });
    return () => {
      stop = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, image]);

  async function load() {
    const session = readSession();
    if (!session) return null;
    const loaded = await bytesForShare(session.network, session.keys.vaultKey, file.id);
    if (!loaded) {
      setMissing(true);
      return null;
    }
    return loaded;
  }

  async function save() {
    const loaded = await load();
    if (!loaded) return;
    saveBlob(new Blob([new Uint8Array(loaded.bytes)], { type: loaded.mime }), loaded.name);
  }

  async function share() {
    const loaded = await load();
    if (!loaded) return;
    const blob = new Blob([new Uint8Array(loaded.bytes)], { type: loaded.mime });
    const shareFile = new File([blob], loaded.name, { type: loaded.mime });
    if (navigator.share && navigator.canShare?.({ files: [shareFile] })) {
      await navigator.share({ files: [shareFile] }).catch(() => saveBlob(blob, loaded.name));
      return;
    }
    saveBlob(blob, loaded.name);
  }

  if (missing) {
    return <p className="mt-2 text-[13px] text-faint">{image ? "Image" : "File"} ({file.name}) is on another device</p>;
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {thumb ? <img src={thumb} alt="" className="h-12 w-12 rounded-md object-cover" /> : null}
      <span className="min-w-0 truncate text-[13px] text-muted">{file.name}</span>
      <button type="button" onClick={() => void save()} className="shrink-0 text-[12px] text-gold hover:underline">
        Download
      </button>
      {typeof navigator !== "undefined" && "share" in navigator ? (
        <button type="button" onClick={() => void share()} className="shrink-0 text-[12px] text-gold hover:underline">
          Share
        </button>
      ) : null}
    </div>
  );
}
