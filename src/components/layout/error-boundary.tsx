"use client";

import { Component, type ReactNode } from "react";
import { reportError } from "@/lib/api/report-error";
import { translate, type TranslationKey } from "@/lib/i18n";
import { useLocaleStore } from "@/stores/locale-store";

const tr = (key: TranslationKey): string => translate(key, useLocaleStore.getState().locale);

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

const RELOADED_KEY = "aedelore-chunk-reload";

/** A script chunk that is gone, usually after a new version was deployed. */
function isChunkError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message)
  );
}

/**
 * Reload once for a missing chunk (F7): the fresh page has the new chunks.
 * The error page was shown instead, also to search robots, which otherwise
 * keep the server-rendered HTML. Not again within a minute, so a chunk that
 * really fails does not loop.
 */
function reloadForChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    if (isChunkError(error) && reloadForChunk()) return;
    reportError(error, "react-boundary");
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <h2 className="font-display text-xl text-accent-gold">{tr("error.somethingWrong")}</h2>
          <p className="text-text-muted text-sm">{tr("error.reloadHint")}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors text-sm"
          >
            {tr("common.retry")}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
