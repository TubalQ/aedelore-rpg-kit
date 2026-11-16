/**
 * Where to go after sign-in (F5): a path on this site only, never another
 * origin ("//evil.example" and "/\evil.example" are read as other hosts).
 */
export function safeCallback(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  return raw;
}
