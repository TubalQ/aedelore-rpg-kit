import { resolvePalettes, pickDefaultThemeId } from "@/lib/domain/themes";
import type { PalettesDefinition } from "@/systems/types";

// Blocking inline <head> script that applies the user's stored palette before
// first paint (no FOUC). Palettes are passed from the DB-backed active system
// (see layout.tsx); falls back to the bundled THEMES (see themes.ts helpers).
export function ThemeScript({ palettes }: { palettes?: PalettesDefinition }) {
  const source = resolvePalettes<PalettesDefinition>(palettes);
  const colorMap: Record<string, Record<string, string>> = {};
  for (const [id, theme] of Object.entries(source)) {
    colorMap[id] = theme.colors as Record<string, string>;
  }
  const defaultId = pickDefaultThemeId(colorMap);

  const js = `(function(){try{var t=${JSON.stringify(colorMap)};var id=localStorage.getItem("aedelore-theme")||"${defaultId}";var c=t[id]||t["${defaultId}"];if(c){var s=document.documentElement.style;for(var k in c)s.setProperty("--color-"+k,c[k]);document.documentElement.setAttribute("data-theme",id)}}catch(e){}})()`;

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
