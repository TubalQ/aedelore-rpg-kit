// localStorage holds conveniences only (theme, language, sidebar). It throws
// when storage is blocked (private mode, site data off), which took the whole
// app down to the error page (F9). A blocked read gives the default, a blocked
// write is skipped, and the console says so once.

let warned = false;
function warnOnce(err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn("[storage] localStorage is not available; settings are not remembered", err);
}

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    warnOnce(err);
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    warnOnce(err);
  }
}
