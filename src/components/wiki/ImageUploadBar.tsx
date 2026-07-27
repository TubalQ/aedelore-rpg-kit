"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/utils/wiki-admin";
import { useT } from "@/lib/i18n";

interface ImageUploadBarProps {
  onError: (msg: string) => void;
}

export default function ImageUploadBar({ onError }: ImageUploadBarProps) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadedUrl(null);
    try {
      const url = await uploadImage(file);
      setUploadedUrl(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : t("wikiAdmin.uploadError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <label className="text-sm text-text-muted">{t("wikiAdmin.content")}</label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-sm text-accent-gold hover:text-accent-gold/80"
        >
          {uploading ? t("wikiAdmin.uploading") : t("wikiAdmin.uploadImage")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      {uploadedUrl && (
        <div className="flex items-center gap-2 p-2 bg-bg-surface border border-border rounded text-sm">
          <span className="text-text-muted">{t("wikiAdmin.imageUrl")}</span>
          <code className="text-accent-gold select-all flex-1 truncate">{uploadedUrl}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(uploadedUrl);
              setUploadedUrl(null);
            }}
            className="text-xs text-accent-gold hover:text-accent-gold/80 shrink-0"
          >
            {t("wikiAdmin.copy")}
          </button>
        </div>
      )}
    </div>
  );
}
