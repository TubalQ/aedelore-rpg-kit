"use client";

import { useRef, useState } from "react";
import { RefreshCw, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";

// Genereras lokalt via /api/avatar (DiceBear "adventurer") - inga externa anrop.
function avatarUrl(seed: string): string {
  return `/api/avatar?seed=${encodeURIComponent(seed || "default")}`;
}

// Uppladdade bilder serveras via /api/media (dynamiskt, ingen 404-negativcache).
// Äldre poster lagrades som /uploads/… → skriv om till /api/media/… så de funkar utan DB-migrering.
function mediaUrl(imageUrl: string): string {
  return imageUrl.startsWith("/uploads/")
    ? `/api/media/${imageUrl.slice("/uploads/".length)}`
    : imageUrl;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function getInitialAvatarSeed(name: string): string {
  return name || randomSeed();
}

interface AvatarProps {
  seed: string;
  /** Uppladdad bild vinner över den genererade seed-avataren när satt. */
  imageUrl?: string;
  size?: number;
  className?: string;
}

export function Avatar({ seed, imageUrl, size = 48, className }: AvatarProps) {
  const src = imageUrl && imageUrl.length > 0 ? mediaUrl(imageUrl) : avatarUrl(seed);
  return (
    <img
      src={src}
      alt="Avatar"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("rounded-full bg-bg-elevated object-cover", className)}
    />
  );
}

interface AvatarEditorProps {
  seed: string;
  imageUrl?: string;
  size?: number;
  onSeedChange: (seed: string) => void;
  /** Töm ("") för att ta bort bilden och återgå till den genererade avataren. */
  onImageChange: (url: string) => void;
}

export function AvatarEditor({ seed, imageUrl, size = 64, onSeedChange, onImageChange }: AvatarEditorProps) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasImage = !!imageUrl && imageUrl.length > 0;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // tillåt att välja samma fil igen efteråt
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/characters/avatar", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "upload failed");
      }
      const { url } = await res.json();
      onImageChange(url as string);
    } catch {
      useToastStore.getState().addToast(t("character.avatarUploadError"), "error");
    } finally {
      setUploading(false);
    }
  }

  const btn =
    "flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-elevated hover:text-text-base transition-colors";

  return (
    <div className="flex items-center gap-3">
      <Avatar seed={seed} imageUrl={imageUrl} size={size} />
      <div className="flex flex-wrap gap-2">
        {hasImage ? (
          <button type="button" onClick={() => onImageChange("")} className={btn}>
            <X size={12} />
            {t("character.removeAvatar")}
          </button>
        ) : (
          <button type="button" onClick={() => onSeedChange(randomSeed())} className={btn}>
            <RefreshCw size={12} />
            {t("character.newAvatar")}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={cn(btn, "disabled:opacity-50")}
        >
          <Upload size={12} />
          {uploading ? t("character.uploadingAvatar") : t("character.uploadAvatar")}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}
