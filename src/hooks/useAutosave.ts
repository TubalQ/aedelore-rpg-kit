"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FLUSH_BEFORE_LOGOUT_EVENT, type FlushBeforeLogoutDetail } from "@/hooks/useAutoLogout";
import { useToastStore } from "@/stores/toast-store";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1500;
const SAVED_VISIBLE_MS = 2000;
/** Retries after leaving the page with a failed save (F2), about 37 s in all. */
const RETRY_AFTER_LEAVE_MS = [2000, 5000, 10000, 20000];
const LOST_TOAST_MS = 30_000;
/** Retries of a failed save while the page is open, then every 30 s (F3). */
const RETRY_WHILE_OPEN_MS = [5000, 10000, 20000, 30000];

interface AutosaveOptions<P> {
  /** Persists one batched patch. Rejects on failure. */
  save: (patch: P) => Promise<unknown>;
  /** Combines an older patch with a newer one (newer wins). */
  merge: (older: P, newer: P) => P;
  /** Top-level keys a patch touches (to protect them from server refreshes). */
  keysOf: (patch: P) => string[];
  /** Shown if changes still cannot be saved after leaving the page (F2). */
  lostMessage: string;
}

export interface Autosave<P> {
  status: SaveStatus;
  /** Queue a change; saved after a short pause, or at once with `immediate`. */
  schedule: (patch: P, immediate?: boolean) => void;
  /** Save everything queued now. Resolves false if the save failed. */
  flush: () => Promise<boolean>;
  /** Keys with local changes not yet confirmed by the server. */
  dirtyKeys: () => Set<string>;
}

/**
 * Debounced autosave shared by the character sheet and the session editor.
 *  - One save in flight at a time; changes made meanwhile are batched.
 *  - A failed save is put back in the queue (newer changes win) and the status
 *    turns "error" until a retry succeeds: nothing is dropped silently.
 *  - The browser warns before closing the tab with unsaved changes, and the
 *    queue is flushed when the component unmounts (in-app navigation). If that
 *    save fails it is retried for a while, and if it never lands an error
 *    toast says so: the status pill is gone with the page (F2).
 */
export function useAutosave<P>({ save, merge, keysOf, lostMessage }: AutosaveOptions<P>): Autosave<P> {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pendingRef = useRef<P | null>(null);
  const inFlightRef = useRef<{ patch: P; promise: Promise<boolean> } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedRef = useRef(false);
  const retryCountRef = useRef(0);
  const optionsRef = useRef({ save, merge, keysOf, lostMessage });
  useEffect(() => {
    optionsRef.current = { save, merge, keysOf, lostMessage };
  }, [save, merge, keysOf, lostMessage]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Wait for the save already running; its changes must land first. Another
    // flush may start a save while this one waits (F11: it then answered
    // "saved" with that save still running, so a lock could land first), so
    // wait until none is running.
    while (inFlightRef.current) await inFlightRef.current.promise;
    const patch = pendingRef.current;
    if (patch === null) return !failedRef.current;
    pendingRef.current = null;

    const { save: doSave, merge: doMerge } = optionsRef.current;
    setStatus("saving");
    const promise = doSave(patch).then(
      () => true,
      () => false,
    );
    inFlightRef.current = { patch, promise };
    const ok = await promise;
    inFlightRef.current = null;

    if (ok) {
      failedRef.current = false;
      retryCountRef.current = 0;
      if (pendingRef.current === null) {
        setStatus("saved");
        // "Saved" is shown briefly, then the indicator goes quiet.
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), SAVED_VISIBLE_MS);
      } else {
        setStatus("unsaved");
      }
    } else {
      failedRef.current = true;
      pendingRef.current = pendingRef.current === null ? patch : doMerge(patch, pendingRef.current);
      setStatus("error");
    }
    return ok;
  }, []);

  const schedule = useCallback(
    (patch: P, immediate = false) => {
      const { merge: doMerge } = optionsRef.current;
      pendingRef.current = pendingRef.current === null ? patch : doMerge(pendingRef.current, patch);
      setStatus("unsaved");
      if (timerRef.current) clearTimeout(timerRef.current);
      if (immediate) {
        void flush();
      } else {
        timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
      }
    },
    [flush],
  );

  const dirtyKeys = useCallback((): Set<string> => {
    const { keysOf: doKeys } = optionsRef.current;
    const keys = new Set<string>();
    if (pendingRef.current !== null) doKeys(pendingRef.current).forEach((k) => keys.add(k));
    if (inFlightRef.current) doKeys(inFlightRef.current.patch).forEach((k) => keys.add(k));
    return keys;
  }, []);

  // A failed save tries again by itself (F3): a 502 during a restart or a
  // dropped signal must not leave the change unsaved until someone presses
  // Retry. Each new failure sets "error" again and schedules the next try.
  useEffect(() => {
    if (status !== "error") return;
    const delay = RETRY_WHILE_OPEN_MS[Math.min(retryCountRef.current, RETRY_WHILE_OPEN_MS.length - 1)];
    const id = setTimeout(() => {
      retryCountRef.current += 1;
      void flush();
    }, delay);
    return () => clearTimeout(id);
  }, [status, flush]);

  // Back online: save what failed at once instead of waiting for the timer.
  useEffect(() => {
    const onOnline = () => {
      if (failedRef.current) void flush();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  // The idle sign-out asks open editors to save first.
  useEffect(() => {
    // The sign-out waits for this save (signOutAfterSaving).
    const onFlushRequest = (e: Event) => {
      const saving = flush();
      if (e instanceof CustomEvent) (e.detail as FlushBeforeLogoutDetail | null)?.saves.push(saving);
    };
    window.addEventListener(FLUSH_BEFORE_LOGOUT_EVENT, onFlushRequest);
    return () => window.removeEventListener(FLUSH_BEFORE_LOGOUT_EVENT, onFlushRequest);
  }, [flush]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingRef.current !== null || inFlightRef.current || failedRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Leaving the page inside the app: save what is queued. The mutation
      // lives in the QueryClient, so it completes (and can be retried) after
      // the unmount.
      void (async () => {
        if (await flush()) return;
        for (const ms of RETRY_AFTER_LEAVE_MS) {
          await new Promise((resolve) => setTimeout(resolve, ms));
          if (await flush()) return;
        }
        useToastStore.getState().addToast(optionsRef.current.lostMessage, "error", LOST_TOAST_MS);
      })();
    };
  }, [flush]);

  return { status, schedule, flush, dirtyKeys };
}
