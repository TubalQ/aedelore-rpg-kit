"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/utils/wiki-admin";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

/** Upload (or clear) a cover image. Uploads via /api/wiki/admin/upload and
 *  stores the returned media URL. Shows a live preview. */
export function CoverImageInput({ value, onChange, label = "Cover image" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="block text-sm text-text-muted mb-1">{label}</label>
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-20 w-20 rounded object-cover border border-border bg-bg-base"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-border text-[10px] text-text-faint text-center">
            No image
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-base transition-colors hover:border-accent-gold disabled:opacity-50"
          >
            {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-left text-xs text-text-muted transition-colors hover:text-accent-red"
            >
              Remove
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
      {error && <p className="mt-1 text-sm text-accent-red">{error}</p>}
    </div>
  );
}
