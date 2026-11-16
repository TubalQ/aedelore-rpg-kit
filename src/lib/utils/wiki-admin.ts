export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/wiki/admin/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Uppladdningen misslyckades");
  const { url } = await res.json();
  return url as string;
}
