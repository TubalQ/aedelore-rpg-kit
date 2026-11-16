import { resolvePalettes, pickDefaultThemeId, withOnAccent, withThemeAccent } from "@/lib/domain/themes";
import type { PalettesDefinition } from "@/systems/types";
import { inlineJson } from "@/lib/utils/inline-json";

// Blocking inline <head> script that applies the user's stored palette before
// first paint (no FOUC). Palettes are passed from the DB-backed active system
// (see layout.tsx); falls back to the bundled THEMES (see themes.ts helpers).
export function ThemeScript({ palettes, accent }: { palettes?: PalettesDefinition; accent?: { accentColor?: string; accentColorDim?: string } }) {
  const source = withOnAccent(withThemeAccent(resolvePalettes<PalettesDefinition>(palettes) as Record<string, { colors: Record<string, string> }>, accent));
  const colorMap: Record<string, Record<string, string>> = {};
  for (const [id, theme] of Object.entries(source)) {
    colorMap[id] = theme.colors as Record<string, string>;
  }
  const defaultId = pickDefaultThemeId(colorMap);

  // Palettes are admin-editable data: embedded escaped, never interpolated raw (W7).
  const js = `(function(){try{var t=${inlineJson(colorMap)};var d=${inlineJson(defaultId)};var id=localStorage.getItem("aedelore-theme")||d;var c=t[id]||t[d];if(c){var s=document.documentElement.style;for(var k in c)s.setProperty("--color-"+k,c[k]);var b=c["bg-base"]||"";var f=b.length===4?b[1]+b[1]+b[2]+b[2]+b[3]+b[3]:b.slice(1);var lum=f.length===6?(0.2126*parseInt(f.slice(0,2),16)+0.7152*parseInt(f.slice(2,4),16)+0.0722*parseInt(f.slice(4,6),16))/255:0;var sc=lum>0.5?"light":"dark";s.colorScheme=sc;document.documentElement.setAttribute("data-scheme",sc);document.documentElement.setAttribute("data-theme",id)}}catch(e){}})()`;

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
